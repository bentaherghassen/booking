import os
import random
from decimal import Decimal
from django.conf import settings
from django.core.files.base import ContentFile
from rest_framework import serializers, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import io
import json
import logging

from .models import ClientRequest
from .tasks import send_dual_quote_emails_task
from .utils import (
    sanitize_text,
    rate_limit_ip,
    send_telegram_notification,
    send_client_quote_email,
    send_admin_notification_email,
    handle_telegram_webhook_update,
    generate_quote_reference_id,
)

logger = logging.getLogger(__name__)

class ClientRequestSerializer(serializers.Serializer):
    client_name = serializers.CharField(max_length=255)
    company_name = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField()
    project_type = serializers.CharField(max_length=100)
    description = serializers.CharField()
    budget_range = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)

    def validate_client_name(self, value):
        sanitized = sanitize_text(value)
        if not sanitized:
            raise serializers.ValidationError("Client name cannot be empty.")
        return sanitized

    def validate_company_name(self, value):
        return sanitize_text(value) if value else ""

    def validate_description(self, value):
        sanitized = sanitize_text(value)
        if not sanitized or len(sanitized) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters.")
        return sanitized

def calculate_ai_estimate(project_type, budget_range, description):
    """
    Simulates AI pricing engine logic to generate estimated cost & timeline.
    """
    base_price = Decimal("3500.00")
    timeline = "2 - 3 Weeks"

    if project_type == "AI Automation":
        base_price = Decimal("6500.00")
        timeline = "1 - 3 Weeks"
        if budget_range == "$10k+":
            base_price = Decimal("12500.00")
        elif budget_range == "$1k - $5k":
            base_price = Decimal("3800.00")
    elif project_type == "Web Development":
        base_price = Decimal("5000.00")
        timeline = "3 - 5 Weeks"
        if budget_range == "$10k+":
            base_price = Decimal("15000.00")
        elif budget_range == "$1k - $5k":
            base_price = Decimal("4200.00")
    elif project_type == "Consultation":
        base_price = Decimal("2500.00")
        timeline = "1 - 5 Days"
        if budget_range == "$10k+":
            base_price = Decimal("5000.00")
        elif budget_range == "$1k - $5k":
            base_price = Decimal("1800.00")

    # Add minor adjustment based on description length
    if len(description) > 200:
        base_price += Decimal("500.00")

    return base_price, timeline

def generate_pdf_quote(client_request, reference_id):
    """
    Generates a PDF quote bill using ReportLab and saves it to the ClientRequest model.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    story = []

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=22,
        textColor=colors.HexColor('#2563EB'),
        spaceAfter=12
    )
    story.append(Paragraph("Ghassen Ben Taher - Business Consultation Quote", title_style))
    story.append(Spacer(1, 10))

    meta_text = f"<b>Reference ID:</b> {reference_id}<br/>" \
                f"<b>Date:</b> {client_request.created_at.strftime('%Y-%m-%d %H:%M')}<br/>" \
                f"<b>Client:</b> {client_request.client_name}<br/>" \
                f"<b>Company:</b> {client_request.company_name or 'N/A'}<br/>" \
                f"<b>Email:</b> {client_request.email}"
    story.append(Paragraph(meta_text, styles['Normal']))
    story.append(Spacer(1, 15))

    data = [
        ["Service Category", "Budget Range", "Estimated Quote"],
        [client_request.project_type, client_request.budget_range or "Standard", f"${client_request.ai_estimated_price:,.2f}"]
    ]
    t = Table(data, colWidths=[200, 150, 150])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3B82F6')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F8FAFC')),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
    ]))
    story.append(t)
    story.append(Spacer(1, 20))

    story.append(Paragraph("<b>Project Description & Scope Brief:</b>", styles['Heading3']))
    story.append(Spacer(1, 5))
    story.append(Paragraph(client_request.description, styles['Normal']))

    doc.build(story)
    pdf_content = buffer.getvalue()
    buffer.close()

    filename = f"{reference_id}.pdf"
    client_request.pdf_bill.save(filename, ContentFile(pdf_content), save=True)


@api_view(['POST'])
@permission_classes([AllowAny])
@rate_limit_ip(max_requests=5, window_seconds=3600)
def submit_client_request(request):
    """
    POST /api/submit-request/
    Receives request data, sanitizes inputs, triggers AI pricing flow, generates PDF,
    sends Telegram workflow notification & Gmail SMTP quote email, saves ClientRequest, and returns JSON payload.
    """
    serializer = ClientRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    # Calculate estimated price
    estimated_price, timeline = calculate_ai_estimate(
        data['project_type'],
        data.get('budget_range', ''),
        data['description']
    )

    client_req = ClientRequest.objects.create(
        client_name=data['client_name'],
        company_name=data.get('company_name', ''),
        email=data['email'],
        project_type=data['project_type'],
        description=data['description'],
        budget_range=data.get('budget_range', ''),
        ai_estimated_price=estimated_price,
        status='QUOTED'
    )

    reference_id = generate_quote_reference_id(client_req)

    # Generate PDF Quote Bill
    try:
        generate_pdf_quote(client_req, reference_id)
        pdf_url = client_req.pdf_bill.url if client_req.pdf_bill else None
    except Exception as e:
        pdf_url = None

    # Send Telegram bot alert
    send_telegram_notification(client_req, reference_id)

    # Trigger asynchronous Celery task for dual email dispatch (Client Quote + Admin Lead Notification)
    try:
        send_dual_quote_emails_task.delay(client_req.id, reference_id)
    except Exception as e:
        logger.error(f"Failed to dispatch Celery email task for {reference_id}: {e}")
        # Synchronous fallback dispatch
        send_client_quote_email(client_req, reference_id)
        send_admin_notification_email(client_req, reference_id)

    booking_url = f"https://calendly.com/bentaherghassen/consultation?ref={reference_id}"

    return Response({
        "success": True,
        "reference_id": reference_id,
        "client_name": client_req.client_name,
        "company_name": client_req.company_name,
        "email": client_req.email,
        "project_type": client_req.project_type,
        "description": client_req.description,
        "budget_range": client_req.budget_range,
        "ai_estimated_price": float(client_req.ai_estimated_price),
        "formatted_price": f"${client_req.ai_estimated_price:,.2f}",
        "estimated_timeline": timeline,
        "pdf_url": pdf_url,
        "booking_url": booking_url,
        "created_at": client_req.created_at.isoformat()
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_webhook(request):
    """
    POST /api/telegram/webhook/
    Processes incoming webhook updates from Telegram Bot API.
    Robustly handles standard bot commands (/start, /help) using external templates.
    Gracefully handles non-dict payloads by returning 200 OK.
    """
    data = request.data
    if not isinstance(data, dict):
        return Response({"status": "ignored", "reason": "invalid_payload"}, status=status.HTTP_200_OK)

    result = handle_telegram_webhook_update(data)
    return Response(result, status=status.HTTP_200_OK)



