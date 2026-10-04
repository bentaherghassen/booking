# bentaherghassen booking

This repository provides a business request and consultation portal for **Ghassen ben Taher** (AI Automation Specialist & Software Engineer). It features a modern **React (Vite, Tailwind CSS v4)** frontend and a robust **Django REST Framework** backend.

---

## Technical Stack & Architecture

### Frontend
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **HTTP Client**: Axios (`frontend/src/services/api.ts`)
- **Sanitization**: DOMPurify for client-side content rendering
- **UI Components**: Lucide Icons, interactive multi-step progress bar, client testimonials carousel, quote PDF downloader, and Calendly booking modal.

### Backend
- **Framework**: Django 6 + Django REST Framework 3
- **Rate Limiting**: Custom IP-based rate limiter middleware/decorator (`apps/booking/utils.py`), enforcing a maximum of **5 requests per IP address per hour** (returns `429 Too Many Requests`).
- **Data Sanitization & Security**: Input sanitization via `bleach` and regex strip routines against XSS attacks.
- **Quote Engine & PDF Generation**: Calculates AI/engineering project estimates and dynamically generates downloadable PDF quote bills using `reportlab`.
- **Telegram Workflow Integration**: Sends instant alerts for new consultation submissions directly to Telegram chats/channels via Telegram Bot API (`send_telegram_notification`) and processes `/start` and `/help` bot commands via webhook (`/api/telegram/webhook/`).
- **Asynchronous Dual Email Dispatch (Celery)**: Dispatches two HTML emails with attached PDF bills on submission: client confirmation quote (`templates/emails/client_quote.html`) and admin lead alert (`templates/emails/admin_notification.html` to `ADMIN_EMAIL`).

---

## Gmail SMTP Email Workflow Setup

To configure Gmail SMTP to send client confirmation emails with attached PDF quotes:

1. **Enable 2-Step Verification on Gmail**:
   - Go to your Google Account Settings > Security.
   - Enable 2-Step Verification if not already enabled.

2. **Generate a Gmail App Password**:
   - Search for **App Passwords** in Google Account settings.
   - Generate a new App Password for "Mail" (16-character passcode).

3. **Configure Environment Variables**:
   Add the following variables to your environment or `.env` file:
   ```env
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT=587
   EMAIL_USE_TLS=True
   EMAIL_HOST_USER="your_gmail_address@gmail.com"
   EMAIL_HOST_PASSWORD="your_16_char_app_password"
   DEFAULT_FROM_EMAIL="Ghassen ben Taher <your_gmail_address@gmail.com>"
   ```

---

## Telegram Bot Integration Setup

To enable instant Telegram notifications whenever a client submits a request:

1. **Create a Telegram Bot**:
   - Search for `@BotFather` on Telegram and create a new bot using `/newbot`.
   - Copy the generated API token (e.g. `7890123456:ABCdefGhIJKlmNoPQRstuVWXyz`).

2. **Get your Chat ID**:
   - Start a conversation with your bot or add it to your admin Telegram group/channel.
   - Use a bot like `@userinfobot` or call `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` to retrieve your `chat_id`.

3. **Configure Environment Variables**:
   Add the following variables to your environment or `.env` file:
   ```env
   TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
   TELEGRAM_CHAT_ID="your_telegram_chat_id"
   ```

---

## API Documentation

### POST `/api/submit-request/`

Submits client details, calculates consultation price quote, generates PDF quote bill, triggers Telegram alert & Gmail quote email, and logs request into Django database.

#### Request Headers
```http
Content-Type: application/json
```

#### Request Body
```json
{
  "client_name": "Jane Doe",
  "company_name": "Acme Corp",
  "email": "jane@acme.com",
  "project_type": "AI Automation",
  "description": "We need an automated multi-agent system for processing PDF invoices.",
  "budget_range": "$5k - $10k"
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "reference_id": "QUOTE_GBT_20261004_Jane_Doe_A8K2M9X4",
  "client_name": "Jane Doe",
  "company_name": "Acme Corp",
  "email": "jane@acme.com",
  "project_type": "AI Automation",
  "description": "We need an automated multi-agent system for processing PDF invoices.",
  "budget_range": "$5k - $10k",
  "ai_estimated_price": 6500.0,
  "formatted_price": "$6,500.00",
  "estimated_timeline": "1 - 3 Weeks",
  "pdf_url": "/media/quotes/QUOTE_GBT_20261004_Jane_Doe_A8K2M9X4.pdf",
  "booking_url": "https://calendly.com/bentaherghassen/consultation?ref=QUOTE_GBT_20261004_Jane_Doe_A8K2M9X4",
  "created_at": "2026-10-04T14:30:00.000Z"
}
```

#### Rate Limit Response (`429 Too Many Requests`)
Triggered if more than 5 requests originate from the same IP address within 1 hour:
```json
{
  "error": "Too Many Requests",
  "detail": "Rate limit exceeded. Maximum 5 requests per hour allowed.",
  "retry_after_seconds": 3540
}
```

### POST `/api/telegram/webhook/`

Processes incoming Telegram webhook updates for bot commands (`/start`, `/help`). Responses are loaded from external text templates (`templates/telegram/`) and dispatched using HTML parse mode.

#### Request Body
```json
{
  "update_id": 10001,
  "message": {
    "message_id": 1,
    "from": {
      "id": 8137222626,
      "first_name": "Ghassen"
    },
    "chat": {
      "id": 8137222626,
      "type": "private"
    },
    "text": "/start"
  }
}
```

#### Success Response (`200 OK`)
```json
{
  "status": "ok",
  "command": "/start",
  "sent": true,
  "chat_id": 8137222626,
  "reply_text": "..."
}
```

---

## Setup & Running Instructions

### Backend (Django)
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run migrations:
   ```bash
   python manage.py migrate --settings=config.settings.dev
   ```
3. Run backend unit & integration tests:
   ```bash
   python manage.py test apps.booking --settings=config.settings.dev
   ```
4. Start Django development server:
   ```bash
   python manage.py runserver --settings=config.settings.dev 0.0.0.0:8000
   ```

### Frontend (React + Vite)
1. Install npm packages:
   ```bash
   cd frontend
   npm install
   ```
2. Build frontend production assets:
   ```bash
   npm run build
   ```
3. Run Vite development server:
   ```bash
   npm run dev
   ```

---

## Security & Defense Features

1. **XSS Protection**: HTML tags and script injections in user inputs (`client_name`, `company_name`, `description`) are stripped on both backend (using `bleach`) and frontend (using `DOMPurify`).
2. **Rate Limiting**: IP-based rate limiting safeguards the endpoint against spam and Denial of Service (DoS) attempts.
3. **CORS & DRF Permissions**: Standard Django CORS header and DRF permissions configured to ensure controlled endpoint access.
