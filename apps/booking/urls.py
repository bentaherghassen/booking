from django.urls import path
from .views import submit_client_request, telegram_webhook

app_name = 'booking'

urlpatterns = [
    path('submit-request/', submit_client_request, name='submit_client_request'),
    path('telegram/webhook/', telegram_webhook, name='telegram_webhook'),
]
