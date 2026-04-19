# BillFlow Billing Engine

BillFlow is a full-stack billing engine demo for SaaS-style subscription products. It includes a TypeScript/Express API, a Prisma/PostgreSQL data model, Redis-backed background workers, Stripe integration points, and a React dashboard for managing plans, subscriptions, usage, invoices, payments, webhooks, and audit logs.

The project is useful as a reference implementation for building a tenant-aware billing system with usage metering, subscription lifecycle operations, invoice tracking, dunning hooks, and webhook delivery.

## What This Project Does

- Creates and manages tenants.
- Defines pricing plans with feature limits.
- Creates, upgrades, cancels, and lists subscriptions.
- Records usage events and summarizes metered consumption.
- Generates and tracks invoices and payments.
- Receives Stripe webhook events.
- Registers outbound webhook endpoints and tracks delivery attempts.
- Stores audit logs for billing-system changes.
- Provides a React admin dashboard for the billing workflow.

## Tech Stack

Backend:

- Node.js, Express, TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ workers
- Stripe SDK
- Zod validation

Frontend:

- React
- TypeScript
- Vite
- TanStack Query
- React Router
- Lucide icons

## Repository Structure

```text
.
├── backend/              # Express API, Prisma schema, workers, services
│   ├── prisma/           # Database schema and migrations
│   └── src/
│       ├── routes/       # HTTP route handlers
│       ├── services/     # Billing, Stripe, invoice, webhook logic
│       ├── jobs/         # BullMQ workers
│       ├── middleware/   # Auth, validation, rate limiting, errors
│       └── config/       # Environment, Redis, Prisma, queues
├── frontend/             # React/Vite dashboard
│   └── src/
│       ├── pages/        # Dashboard pages
│       ├── components/   # Shared layout
│       ├── lib/          # API client and utilities
│       └── types/        # Frontend types
├── docker-compose.yml    # Redis for local development
├── .env.example          # Environment variable template
└── README.md
```

## Prerequisites

- Node.js 20 or newer
- npm
- Docker, for local Redis
- A PostgreSQL database URL

The `.env.example` file is configured for a hosted PostgreSQL URL, such as Neon. A local PostgreSQL instance also works as long as `DATABASE_URL` points to it.

## Environment Setup

Create a root `.env` file from the example:

```bash
cp .env.example .env
```

Then update at least:

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
REDIS_URL="redis://localhost:6379"
PORT=4000
NODE_ENV="development"
```

Stripe values can stay as placeholders for local UI/API exploration, but real Stripe webhook and payment flows require valid Stripe test credentials.

## Running Locally

Start Redis:

```bash
docker compose up -d redis
```

Install and start the backend:

```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

The API runs on:

```text
http://localhost:4000
```

In a second terminal, install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs on:

```text
http://localhost:5173
```

The frontend proxies `/api` requests to the backend. If the backend is not running, the dashboard will show a centered retry message instead of staying on an endless loading state.

## Development Auth

Protected API routes support a development shortcut when `NODE_ENV="development"`:

```http
X-Tenant-Id: <tenant-id>
```

The frontend automatically creates or discovers a demo tenant on first load and sends this header for API requests.

For production-style auth, use a bearer JWT signed with `JWT_SECRET` containing:

```json
{
  "tenantId": "tenant_uuid",
  "role": "admin"
}
```

## API Areas

Base API path:

```text
/api/v1
```

Common routes:

```text
POST   /tenants
GET    /tenants/:id
PATCH  /tenants/:id

GET    /plans
GET    /plans/:id
POST   /plans
PATCH  /plans/:id
DELETE /plans/:id

GET    /subscriptions
POST   /subscriptions
GET    /subscriptions/:id
POST   /subscriptions/:id/upgrade
POST   /subscriptions/:id/cancel

GET    /usage
POST   /usage

GET    /invoices
GET    /invoices/:id
POST   /invoices/:id/void

GET    /payments
GET    /payments/:id

POST   /webhooks/endpoints
GET    /webhooks/endpoints
PATCH  /webhooks/endpoints/:id
DELETE /webhooks/endpoints/:id
GET    /webhooks/deliveries

POST   /stripe/webhook
GET    /audit-logs
GET    /health
```

## Background Workers

The backend starts BullMQ workers with the API server:

- `usage-flush`: periodically flushes usage from Redis into PostgreSQL.
- `dunning`: handles failed-payment recovery workflows.
- `webhook-delivery`: dispatches outbound webhook events.

Redis must be running before the backend starts.

## Useful Scripts

Backend:

```bash
npm run dev          # Start API with tsx watch
npm run build        # Compile TypeScript
npm run start        # Run compiled server
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run development migrations
npm run db:push      # Push schema without a migration
npm run db:studio    # Open Prisma Studio
npm run lint         # Type-check backend
```

Frontend:

```bash
npm run dev      # Start Vite dev server
npm run build    # Type-check and build production assets
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

API smoke test:

```bash
cd backend
chmod +x test-api.sh
./test-api.sh
```

Run the smoke test only after the backend, database, and Redis are running.

## Data Model Overview

The Prisma schema includes:

- `Tenant`
- `Plan`
- `PlanFeature`
- `Subscription`
- `UsageRecord`
- `Invoice`
- `InvoiceLineItem`
- `Payment`
- `DunningAttempt`
- `WebhookEndpoint`
- `WebhookDelivery`
- `AuditLog`

Prices and invoice amounts are stored as integers in the smallest currency unit, such as cents or paise.

## Troubleshooting

If the frontend says the billing system did not respond:

- Make sure the backend is running on `http://localhost:4000`.
- Make sure `DATABASE_URL` is valid.
- Make sure Redis is running with `docker compose up -d redis`.
- Check backend logs for Prisma, Redis, or Stripe configuration errors.

If protected endpoints return `401` during local development:

- Confirm `NODE_ENV="development"`.
- Send `X-Tenant-Id` with a valid tenant ID.

If Prisma commands fail:

- Check that the root `.env` file exists.
- Confirm the database accepts connections from your machine.
- Re-run `npm run db:generate` after schema changes.

## Project Status

This is a development/demo billing engine. It is structured like a production service, but production use would still require hardening around authentication, tenant onboarding, Stripe configuration, secrets management, deployment, observability, and automated tests.
