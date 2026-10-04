import logging
from celery import shared_task

from .models import ClientRequest
from .utils import send_client_quote_email, send_admin_notification_email

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_dual_quote_emails_task(self, client_request_id: int, reference_id: str) -> dict:
    """
    Asynchronous Celery task that dispatches two separate emails:
      1. Client Email: HTML quotation confirmation using templates/emails/client_quote.html,
         attached with generated PDF bill if available.
      2. Admin Email: Detailed lead summary email sent to ADMIN_EMAIL using
         templates/emails/admin_notification.html, also attaching the PDF bill.
    """
    logger.info(f"Executing send_dual_quote_emails_task for ClientRequest ID: {client_request_id}, Ref: {reference_id}")

    try:
        client_request = ClientRequest.objects.get(id=client_request_id)
    except ClientRequest.DoesNotExist:
        logger.error(f"ClientRequest with id {client_request_id} does not exist. Aborting Celery task.")
        return {
            "success": False,
            "error": f"ClientRequest with id {client_request_id} not found"
        }

    results = {
        "client_email_sent": False,
        "admin_email_sent": False
    }

    # 1. Dispatch Client Confirmation Email
    try:
        results["client_email_sent"] = send_client_quote_email(client_request, reference_id)
    except Exception as exc:
        logger.error(f"Failed to dispatch client quote email for {reference_id}: {str(exc)}", exc_info=True)

    # 2. Dispatch Admin Notification Email
    try:
        results["admin_email_sent"] = send_admin_notification_email(client_request, reference_id)
    except Exception as exc:
        logger.error(f"Failed to dispatch admin notification email for {reference_id}: {str(exc)}", exc_info=True)

    logger.info(
        f"Completed send_dual_quote_emails_task for {reference_id}. "
        f"Client email: {results['client_email_sent']}, Admin email: {results['admin_email_sent']}"
    )

    return results
