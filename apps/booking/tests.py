import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core import mail
from django.core.files.base import ContentFile
from rest_framework.test import APIClient
from rest_framework import status
from django.core.cache import cache

from apps.booking.models import ClientRequest
from apps.booking.utils import (
    send_telegram_notification,
    send_telegram_message,
    send_client_quote_email,
    send_admin_notification_email,
    handle_telegram_webhook_update,
    generate_quote_reference_id,
)
from apps.booking.tasks import send_dual_quote_emails_task


class ClientRequestAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('booking:submit_client_request')
        cache.clear()

    @patch('apps.booking.tasks.send_dual_quote_emails_task.delay')
    def test_submit_valid_client_request(self, mock_celery_task):
        payload = {
            "client_name": "Test Client",
            "company_name": "Test Corp",
            "email": "test@example.com",
            "project_type": "AI Automation",
            "description": "We need an automated workflow for PDF invoice processing.",
            "budget_range": "$5k - $10k"
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['client_name'], "Test Client")
        
        # Verify quote naming convention: QUOTE_GBT_<date of creation the quote>_<name of client>_<random 8 numbers and letters>
        ref_id = response.data['reference_id']
        self.assertTrue(ref_id.startswith("QUOTE_GBT_"))
        self.assertIn("Test_Client", ref_id)
        self.assertIn(f"{ref_id}.pdf", response.data['pdf_url'])

        # Verify model object creation
        obj = ClientRequest.objects.get(email="test@example.com")
        self.assertEqual(obj.client_name, "Test Client")
        self.assertIsNotNone(obj.ai_estimated_price)

        # Verify Celery dual email task was triggered asynchronously
        mock_celery_task.assert_called_once_with(obj.id, response.data['reference_id'])

    def test_generate_quote_reference_id_format(self):
        req = ClientRequest.objects.create(
            client_name="Sarah Connor",
            email="sarah@example.com",
            project_type="AI Automation",
            description="Testing quote reference naming specification.",
            ai_estimated_price=4500.00
        )
        quote_name = generate_quote_reference_id(req)
        date_str = req.created_at.strftime('%Y%m%d')
        # Format: QUOTE_GBT_<date of creation the quote>_<name of client>_<random 8 numbers and letters>
        pattern = rf"^QUOTE_GBT_{date_str}_Sarah_Connor_[A-Z0-9]{{8}}$"
        self.assertRegex(quote_name, pattern)
        # Verify 8 random characters has both letters and numbers
        random_suffix = quote_name.split('_')[-1]
        self.assertEqual(len(random_suffix), 8)
        self.assertTrue(any(c.isalpha() for c in random_suffix))
        self.assertTrue(any(c.isdigit() for c in random_suffix))

    def test_xss_sanitization(self):
        payload = {
            "client_name": "John <script>alert('xss')</script> Doe",
            "company_name": "Evil<iframe src='bad.com'></iframe> Inc",
            "email": "hacker@example.com",
            "project_type": "Web Development",
            "description": "Building a site <img src=x onerror=alert(1)> with safe description text.",
            "budget_range": "$10k+"
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['client_name'], "John Doe")
        self.assertEqual(response.data['company_name'], "Evil Inc")
        self.assertNotIn("<script>", response.data['client_name'])
        self.assertNotIn("onerror", response.data['description'])

    def test_rate_limiting_5_per_hour(self):
        payload = {
            "client_name": "Rate Limit Tester",
            "company_name": "Test Co",
            "email": "ratelimit@example.com",
            "project_type": "Consultation",
            "description": "Rate limit testing description for API validation.",
            "budget_range": "$1k - $5k"
        }

        # Make 5 successful requests
        for i in range(5):
            res = self.client.post(self.url, payload, format='json')
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # 6th request should fail with 429 Too Many Requests
        res_6 = self.client.post(self.url, payload, format='json')
        self.assertEqual(res_6.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        data = json.loads(res_6.content)
        self.assertEqual(data['error'], "Too Many Requests")

    def test_invalid_validation(self):
        payload = {
            "client_name": "",
            "email": "invalid-email",
            "project_type": "AI Automation",
            "description": "short"
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertIn('client_name', response.data)
        self.assertIn('description', response.data)

    @override_settings(TELEGRAM_BOT_TOKEN="test_token", TELEGRAM_CHAT_ID="12345678")
    @patch("requests.post")
    def test_send_telegram_notification_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        req = ClientRequest.objects.create(
            client_name="Alice Telegram",
            email="alice@example.com",
            project_type="AI Automation",
            description="Testing telegram integration workflow.",
            ai_estimated_price=6500.00
        )

        success = send_telegram_notification(req, "GBT-2026-TEST")
        self.assertTrue(success)
        mock_post.assert_called_once()

    @override_settings(TELEGRAM_BOT_TOKEN="", TELEGRAM_CHAT_ID="")
    def test_send_telegram_notification_missing_credentials(self):
        req = ClientRequest.objects.create(
            client_name="Bob NoTelegram",
            email="bob@example.com",
            project_type="Consultation",
            description="Testing missing credentials.",
            ai_estimated_price=2500.00
        )
        success = send_telegram_notification(req, "GBT-2026-TEST2")
        self.assertFalse(success)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        EMAIL_HOST_USER='test@bentaherghassen.com'
    )
    def test_send_client_quote_email_success(self):
        req = ClientRequest.objects.create(
            client_name="Email Client",
            email="emailclient@example.com",
            project_type="AI Automation",
            description="Testing email quote dispatch functionality.",
            ai_estimated_price=6500.00
        )

        success = send_client_quote_email(req, "GBT-2026-EMAIL-01")
        self.assertTrue(success)
        self.assertEqual(len(mail.outbox), 1)
        sent_msg = mail.outbox[0]
        self.assertIn("Email Client", sent_msg.body)
        self.assertEqual(sent_msg.to, ["emailclient@example.com"])
        self.assertIn("GBT-2026-EMAIL-01", sent_msg.subject)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        EMAIL_HOST_USER='test@bentaherghassen.com',
        ADMIN_EMAIL='admin@bentaherghassen.com'
    )
    def test_send_admin_notification_email_success(self):
        req = ClientRequest.objects.create(
            client_name="Admin Test Client",
            company_name="Innovate Ltd",
            email="admintest@example.com",
            project_type="Web Development",
            description="Developing high scale platform for AI workflows.",
            budget_range="$10k+",
            ai_estimated_price=12500.00
        )

        success = send_admin_notification_email(req, "GBT-2026-ADMIN-01")
        self.assertTrue(success)
        self.assertEqual(len(mail.outbox), 1)
        sent_msg = mail.outbox[0]
        self.assertIn("admin@bentaherghassen.com", sent_msg.to)
        self.assertIn("Admin Test Client", sent_msg.body)
        self.assertIn("Innovate Ltd", sent_msg.body)
        self.assertIn("GBT-2026-ADMIN-01", sent_msg.subject)
        self.assertIn("New Lead Alert", sent_msg.subject)


class CeleryDualDispatchEmailTestCase(TestCase):
    def setUp(self):
        mail.outbox.clear()

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        EMAIL_HOST_USER='sender@bentaherghassen.com',
        ADMIN_EMAIL='admin@bentaherghassen.com'
    )
    def test_send_dual_quote_emails_task_dispatches_two_emails_with_pdf(self):
        req = ClientRequest.objects.create(
            client_name="Dual Dispatch Client",
            company_name="Dual Corp",
            email="dual@client.com",
            project_type="AI Automation",
            description="Dual email dispatch requirement test description.",
            budget_range="$5k - $10k",
            ai_estimated_price=7500.00
        )
        # Attach a dummy PDF bill
        req.pdf_bill.save("quote_test.pdf", ContentFile(b"%PDF-1.4 dummy pdf content"), save=True)

        result = send_dual_quote_emails_task(req.id, "GBT-2026-DUAL-01")
        self.assertTrue(result["client_email_sent"])
        self.assertTrue(result["admin_email_sent"])

        # Verify two emails were dispatched
        self.assertEqual(len(mail.outbox), 2)

        # 1. Client Email Verification
        client_email = next((m for m in mail.outbox if "dual@client.com" in m.to), None)
        self.assertIsNotNone(client_email)
        self.assertIn("Dual Dispatch Client", client_email.body)
        self.assertIn("GBT-2026-DUAL-01", client_email.subject)
        self.assertEqual(len(client_email.attachments), 1)

        # 2. Admin Email Verification
        admin_email = next((m for m in mail.outbox if "admin@bentaherghassen.com" in m.to), None)
        self.assertIsNotNone(admin_email)
        self.assertIn("Dual Dispatch Client", admin_email.body)
        self.assertIn("Dual Corp", admin_email.body)
        self.assertIn("New Lead Alert", admin_email.subject)
        self.assertIn("GBT-2026-DUAL-01", admin_email.subject)
        self.assertEqual(len(admin_email.attachments), 1)

    def test_send_dual_quote_emails_task_nonexistent_id(self):
        result = send_dual_quote_emails_task(999999, "GBT-2026-NONEXISTENT")
        self.assertFalse(result["success"])
        self.assertIn("not found", result["error"])


class TelegramBotWebhookCommandsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.webhook_url = reverse('booking:telegram_webhook')

    @override_settings(TELEGRAM_BOT_TOKEN="mock_bot_token", TELEGRAM_CHAT_ID="98765432")
    @patch("requests.post")
    def test_telegram_webhook_start_command(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        payload = {
            "update_id": 10001,
            "message": {
                "message_id": 42,
                "from": {
                    "id": 98765432,
                    "first_name": "Ghassen",
                    "username": "ghassen_bt"
                },
                "chat": {
                    "id": 98765432,
                    "type": "private"
                },
                "text": "/start"
            }
        }

        response = self.client.post(self.webhook_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')
        self.assertEqual(response.data['command'], '/start')
        self.assertTrue(response.data['sent'])

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        sent_json = call_kwargs['json']
        self.assertEqual(sent_json['chat_id'], '98765432')
        self.assertEqual(sent_json['parse_mode'], 'HTML')
        self.assertIn("Welcome, Ghassen!", sent_json['text'])
        self.assertIn("What do you want to build or consult on today?", sent_json['text'])

    @override_settings(TELEGRAM_BOT_TOKEN="mock_bot_token", TELEGRAM_CHAT_ID="98765432")
    @patch("requests.post")
    def test_telegram_webhook_help_command(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        payload = {
            "update_id": 10002,
            "message": {
                "message_id": 43,
                "from": {
                    "id": 98765432,
                    "first_name": "Ghassen",
                    "username": "ghassen_bt"
                },
                "chat": {
                    "id": 98765432,
                    "type": "private"
                },
                "text": "/help@bentaherghassen_booking_bot"
            }
        }

        response = self.client.post(self.webhook_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')
        self.assertEqual(response.data['command'], '/help')
        self.assertTrue(response.data['sent'])

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        sent_json = call_kwargs['json']
        self.assertEqual(sent_json['parse_mode'], 'HTML')
        self.assertIn("Consultation Bot Help", sent_json['text'])
        self.assertIn("/start", sent_json['text'])
        self.assertIn("/help", sent_json['text'])

    def test_telegram_webhook_safe_handling_non_text_message(self):
        # Update with photo instead of text
        payload = {
            "update_id": 10003,
            "message": {
                "message_id": 44,
                "chat": {"id": 98765432},
                "photo": [{"file_id": "xyz123"}]
            }
        }
        response = self.client.post(self.webhook_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ignored')
        self.assertEqual(response.data['reason'], 'no_text')

    def test_telegram_webhook_safe_handling_non_dict_update(self):
        response = self.client.post(self.webhook_url, ["non-dict-update"], format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ignored')
        self.assertEqual(response.data['reason'], 'invalid_payload')

    @override_settings(TELEGRAM_BOT_TOKEN="", TELEGRAM_CHAT_ID="")
    def test_telegram_webhook_missing_bot_credentials_graceful(self):
        payload = {
            "update_id": 10004,
            "message": {
                "message_id": 45,
                "chat": {"id": 98765432},
                "text": "/start"
            }
        }
        # Missing bot token shouldn't crash the server
        response = self.client.post(self.webhook_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')
        self.assertFalse(response.data['sent'])
