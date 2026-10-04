import time
import bleach
import re
import requests
import logging
import html
import os
import string
import secrets
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.core.mail import EmailMessage
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


def generate_random_alphanumeric(length: int = 8) -> str:
    """
    Generates a cryptographically secure random alphanumeric string
    of specified length containing both letters and digits.
    """
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(secrets.choice(chars) for _ in range(length))
        if any(c.isdigit() for c in code) and any(c.isalpha() for c in code):
            return code


def generate_quote_reference_id(client_request) -> str:
    """
    Generates the quote reference name following the format:
    QUOTE_GBT_<date of creation the quote>_<name of client>_<random 8 numbers and letters>
    Example: QUOTE_GBT_20261004_John_Doe_A7X2K9M4
    """
    created_at = getattr(client_request, 'created_at', None) or timezone.now()
    date_format = getattr(settings, 'QUOTE_DATE_FORMAT', '%Y%m%d')
    date_str = created_at.strftime(date_format)

    raw_client_name = getattr(client_request, 'client_name', '') or 'Client'
    clean_name = re.sub(r'[^a-zA-Z0-9]+', '_', raw_client_name.strip()).strip('_')
    if not clean_name:
        clean_name = 'Client'

    random_code = generate_random_alphanumeric(8)
    return f"QUOTE_GBT_{date_str}_{clean_name}_{random_code}"



def sanitize_text(text: str) -> str:
    """
    Sanitizes user input string using bleach to protect against Cross-Site Scripting (XSS).
    Strips all HTML tags and removes javascript/event content.
    """
    if not isinstance(text, str):
        return text
    # Strip HTML tags
    cleaned = bleach.clean(text, tags=[], attributes={}, strip=True)
    # Remove remaining JS code like alert('xss') if any script content was left in raw text
    cleaned = re.sub(r'alert\([^)]*\)', '', cleaned)
    cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
    # Remove extra whitespace
    return ' '.join(cleaned.split())


def get_client_ip(request):
    """
    Retrieves the client's IP address from request headers.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
    return ip


def rate_limit_ip(max_requests=5, window_seconds=3600):
    """
    Decorator for views to enforce rate limiting by IP address.
    Default: max 5 requests per IP address per hour (3600s).
    Returns HTTP 429 Too Many Requests if limit is exceeded.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            ip = get_client_ip(request)
            cache_key = f"rate_limit_{ip}"

            requests_list = cache.get(cache_key, [])
            now = time.time()

            # Filter out requests older than window_seconds
            requests_list = [req_time for req_time in requests_list if now - req_time < window_seconds]

            if len(requests_list) >= max_requests:
                return JsonResponse(
                    {
                        "error": "Too Many Requests",
                        "detail": f"Rate limit exceeded. Maximum {max_requests} requests per hour allowed.",
                        "retry_after_seconds": int(window_seconds - (now - requests_list[0]))
                    },
                    status=429
                )

            requests_list.append(now)
            cache.set(cache_key, requests_list, window_seconds)

            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def send_telegram_message(text: str, chat_id=None, parse_mode: str = "HTML") -> bool:
    """
    Sends a message via Telegram Bot API with HTML parse mode by default.
    Handles missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID gracefully without raising exceptions.
    """
    bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    target_chat_id = chat_id or getattr(settings, 'TELEGRAM_CHAT_ID', None)

    if not bot_token:
        logger.warning("Telegram Bot configuration missing (TELEGRAM_BOT_TOKEN). Skipping message dispatch.")
        return False

    if not target_chat_id:
        logger.warning("Telegram chat ID missing (TELEGRAM_CHAT_ID / target_chat_id). Skipping message dispatch.")
        return False

    telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": str(target_chat_id),
        "text": text,
        "parse_mode": parse_mode
    }

    try:
        response = requests.post(telegram_url, json=payload, timeout=5)
        if response.status_code == 200:
            logger.info(f"Telegram message sent successfully to chat_id {target_chat_id}.")
            return True
        else:
            logger.error(f"Failed to send Telegram message. Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Exception while sending Telegram message: {str(e)}")
        return False


def send_telegram_notification(client_request, reference_id) -> bool:
    """
    Sends a formatted notification message to a Telegram chat/channel via Telegram Bot API
    when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in Django settings / env variables.
    User fields are safely escaped using html.escape() to prevent Telegram HTML parse errors.
    """
    bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    chat_id = getattr(settings, 'TELEGRAM_CHAT_ID', None)

    if not bot_token or not chat_id:
        logger.info("Telegram Bot configuration missing (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). Skipping notification.")
        return False

    client_name = html.escape(client_request.client_name or '')
    company_name = html.escape(client_request.company_name or 'N/A')
    email = html.escape(client_request.email or '')
    project_type = html.escape(client_request.project_type or '')
    budget_range = html.escape(client_request.budget_range or 'N/A')
    description = html.escape(client_request.description or '')

    price_str = f"{client_request.ai_estimated_price:,.2f}" if client_request.ai_estimated_price else "0.00"

    message_text = (
        f"🚨 <b>New Consultation Request Received!</b>\n\n"
        f"<b>Reference:</b> <code>{html.escape(reference_id)}</code>\n"
        f"<b>Client Name:</b> {client_name}\n"
        f"<b>Company:</b> {company_name}\n"
        f"<b>Email:</b> {email}\n"
        f"<b>Project Type:</b> {project_type}\n"
        f"<b>Budget Range:</b> {budget_range}\n"
        f"<b>Estimate:</b> ${price_str}\n\n"
        f"<b>Description:</b>\n<i>{description}</i>"
    )

    return send_telegram_message(message_text, chat_id=chat_id, parse_mode="HTML")


def handle_telegram_webhook_update(update_data: dict) -> dict:
    """
    Processes incoming Telegram webhook update dictionaries.
    Safely verifies message.text, extracts commands (/start, /help),
    loads response strings from external text templates, and replies in HTML parse mode.
    """
    if not isinstance(update_data, dict):
        logger.warning("Received invalid non-dict Telegram webhook payload.")
        return {"status": "ignored", "reason": "invalid_payload"}

    message = update_data.get('message') or update_data.get('edited_message')
    if not isinstance(message, dict):
        logger.info("Telegram update does not contain a message object. Ignoring.")
        return {"status": "ignored", "reason": "no_message"}

    text = message.get('text')
    if not text or not isinstance(text, str):
        logger.info("Telegram message contains no valid text. Ignoring.")
        return {"status": "ignored", "reason": "no_text"}

    chat = message.get('chat')
    chat_id = chat.get('id') if isinstance(chat, dict) else None
    if not chat_id:
        chat_id = getattr(settings, 'TELEGRAM_CHAT_ID', None)

    from_user = message.get('from')
    first_name = from_user.get('first_name', '') if isinstance(from_user, dict) else ''
    username = from_user.get('username', '') if isinstance(from_user, dict) else ''

    cleaned_text = text.strip()
    if not cleaned_text:
        return {"status": "ignored", "reason": "empty_text"}

    first_word = cleaned_text.split()[0].lower()
    command = first_word.split('@')[0]

    template_map = {
        '/start': 'telegram/start.txt',
        '/help': 'telegram/help.txt',
    }

    if command not in template_map:
        logger.info(f"Received non-handled command/message: {command}")
        return {"status": "ignored", "command": command}

    template_name = template_map[command]
    context = {
        'first_name': first_name,
        'username': username,
        'command': command,
        'chat_id': chat_id,
    }

    try:
        reply_text = render_to_string(template_name, context).strip()
    except Exception as e:
        logger.error(f"Failed to render Telegram template {template_name}: {str(e)}")
        return {"status": "error", "error": f"Template rendering failed: {str(e)}"}

    sent = send_telegram_message(reply_text, chat_id=chat_id, parse_mode="HTML")
    return {
        "status": "ok",
        "command": command,
        "sent": sent,
        "chat_id": chat_id,
        "reply_text": reply_text
    }


def attach_pdf_if_available(email_message: EmailMessage, client_request, reference_id: str) -> None:
    """
    Helper function to attach the generated PDF bill to an EmailMessage instance if available.
    """
    if not client_request.pdf_bill:
        return

    try:
        if hasattr(client_request.pdf_bill, 'path') and os.path.exists(client_request.pdf_bill.path):
            email_message.attach_file(client_request.pdf_bill.path, mimetype="application/pdf")
        elif hasattr(client_request.pdf_bill, 'file'):
            client_request.pdf_bill.open('rb')
            email_message.attach(
                f"{reference_id}.pdf",
                client_request.pdf_bill.read(),
                "application/pdf"
            )
    except Exception as e:
        logger.warning(f"Could not attach PDF bill for reference {reference_id}: {str(e)}")


def send_client_quote_email(client_request, reference_id: str) -> bool:
    """
    Sends an automated confirmation email to the client using Django EmailMessage.
    Loads HTML content from templates/emails/client_quote.html via render_to_string.
    Attaches generated PDF bill if available.
    """
    host_user = getattr(settings, 'EMAIL_HOST_USER', '')
    if not host_user and getattr(settings, 'EMAIL_BACKEND', '') == 'django.core.mail.backends.smtp.EmailBackend':
        logger.info("Gmail SMTP EMAIL_HOST_USER not configured. Skipping client email workflow.")
        return False

    subject = f"Your Consultation Quote & Scope Assessment [{reference_id}] - Ghassen ben Taher"
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@bentaherghassen.com')
    to_email = [client_request.email]

    booking_url = f"https://calendly.com/bentaherghassen/consultation?ref={reference_id}"

    price_str = f"{client_request.ai_estimated_price:,.2f}" if client_request.ai_estimated_price else "0.00"

    context = {
        'client_name': client_request.client_name,
        'company_name': client_request.company_name or 'N/A',
        'email': client_request.email,
        'reference_id': reference_id,
        'project_type': client_request.project_type,
        'budget_range': client_request.budget_range or 'N/A',
        'estimated_price': price_str,
        'description': client_request.description,
        'booking_url': booking_url,
    }

    try:
        html_content = render_to_string('emails/client_quote.html', context)
    except Exception as e:
        logger.error(f"Failed to render client_quote.html for {reference_id}: {str(e)}")
        return False

    email = EmailMessage(
        subject=subject,
        body=html_content,
        from_email=from_email,
        to=to_email,
    )
    email.content_subtype = "html"

    # Attach generated PDF bill if available
    attach_pdf_if_available(email, client_request, reference_id)

    try:
        email.send(fail_silently=False)
        logger.info(f"Quote confirmation email sent successfully to {client_request.email} for {reference_id}.")
        return True
    except Exception as e:
        logger.error(f"Failed to send client quote email to {client_request.email}: {str(e)}")
        return False


def send_admin_notification_email(client_request, reference_id: str) -> bool:
    """
    Sends a detailed lead summary email to the administrator address (ADMIN_EMAIL).
    Loads HTML content from templates/emails/admin_notification.html via render_to_string.
    Attaches generated PDF bill if available.
    """
    host_user = getattr(settings, 'EMAIL_HOST_USER', '')
    if not host_user and getattr(settings, 'EMAIL_BACKEND', '') == 'django.core.mail.backends.smtp.EmailBackend':
        logger.info("Gmail SMTP EMAIL_HOST_USER not configured. Skipping admin email workflow.")
        return False

    admin_email = getattr(settings, 'ADMIN_EMAIL', None) or getattr(settings, 'DEFAULT_FROM_EMAIL', '')
    if not admin_email:
        logger.warning("ADMIN_EMAIL is not configured. Skipping admin notification email.")
        return False

    subject = f"[New Lead Alert] Consultation Request - {client_request.client_name} [{reference_id}]"
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@bentaherghassen.com')
    to_email = [admin_email]

    price_str = f"{client_request.ai_estimated_price:,.2f}" if client_request.ai_estimated_price else "0.00"
    created_at_str = client_request.created_at.strftime('%Y-%m-%d %H:%M') if getattr(client_request, 'created_at', None) else 'Just now'

    context = {
        'client_name': client_request.client_name,
        'company_name': client_request.company_name or 'N/A',
        'email': client_request.email,
        'reference_id': reference_id,
        'project_type': client_request.project_type,
        'budget_range': client_request.budget_range or 'N/A',
        'estimated_price': price_str,
        'description': client_request.description,
        'created_at': created_at_str,
        'admin_email': admin_email,
    }

    try:
        html_content = render_to_string('emails/admin_notification.html', context)
    except Exception as e:
        logger.error(f"Failed to render admin_notification.html for {reference_id}: {str(e)}")
        return False

    email = EmailMessage(
        subject=subject,
        body=html_content,
        from_email=from_email,
        to=to_email,
    )
    email.content_subtype = "html"

    # Attach generated PDF bill if available
    attach_pdf_if_available(email, client_request, reference_id)

    try:
        email.send(fail_silently=False)
        logger.info(f"Admin notification email sent successfully to {admin_email} for {reference_id}.")
        return True
    except Exception as e:
        logger.error(f"Failed to send admin notification email to {admin_email}: {str(e)}")
        return False
