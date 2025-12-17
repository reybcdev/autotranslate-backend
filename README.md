# autotranslate-backend

Backend service for AutoTranslate SaaS platform - Node.js/Express with BullMQ job queues, Stripe payments, and translation API integrations.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Queue:** BullMQ + Redis
- **Payments:** Stripe
- **Translation APIs:** Google Translate, DeepL

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

## Environment Variables

See `.env.example` for required environment variables.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/files/upload-url` | POST | Get signed upload URL |
| `/api/files` | GET | List user files |
| `/api/translations` | POST | Create translation job |
| `/api/translations/:id` | GET | Get translation status |
| `/api/payments/checkout` | POST | Create Stripe checkout |
| `/api/webhooks/stripe` | POST | Stripe webhook handler |

## Project Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── queues/          # BullMQ queue definitions
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utilities
├── workers/         # Background job workers
├── app.js           # Express app setup
└── server.js        # Entry point
```

## Deployment

### Railway

1. Connect GitHub repository
2. Add environment variables
3. Deploy

### Docker

```bash
docker build -t autotranslate-backend .
docker run -p 3001:3001 --env-file .env autotranslate-backend
```

## License

ISC
