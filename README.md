# Amader™ — E-commerce Platform

A modern rebuild of the Amader™ organic-goods store (previously Botble/Laravel/MySQL)
onto a Node/TypeScript stack: a NestJS API, a Next.js storefront, and a Next.js admin
dashboard, sharing a Prisma/PostgreSQL data layer across a pnpm/Turborepo monorepo.

## Tech stack

| Layer         | Technology                                      |
| ------------- | ------------------------------------------------ |
| API           | NestJS 11, Prisma 7, PostgreSQL                   |
| Storefront    | Next.js 16 (App Router), React 19, Tailwind CSS 4, next-intl |
| Admin panel   | Next.js 16 (App Router), React 19, Tailwind CSS 4, TanStack Query, Chart.js |
| Shared code   | TypeScript workspace packages (`packages/*`)      |
| Monorepo tooling | pnpm workspaces, Turborepo                     |
| Media storage | Cloudflare R2 (S3-compatible)                     |

## Monorepo layout

```
apps/
  backend/    NestJS API — all business logic, auth, admin + storefront endpoints
  web/        Next.js storefront (amadere.com) — locales: en, bn
  admin/      Next.js admin dashboard — products, orders, customers, marketing, etc.
packages/
  db/         Prisma schema, migrations, seed script, DB client (@amader/db)
  shared/     Types/utilities shared between backend and both frontends (@amader/shared)
  ui/         Storefront design-system components (@amader/ui)
  admin-ui/   Admin dashboard design-system components (@amader/admin-ui)
```

Each app/package is an independent workspace with its own `package.json`; Turborepo
orchestrates running scripts across all of them (or a subset, via `--filter`).

## Prerequisites

- Node.js ≥ 20
- pnpm 11 (`corepack enable` will pick up the version pinned in `package.json`)
- Docker (for local PostgreSQL)

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Start PostgreSQL**

   ```bash
   docker compose up -d postgres
   ```

   This starts Postgres on `localhost:5433` (user/password/db: `amader`/`amader`/`amader`,
   see `docker-compose.yml`).

3. **Configure environment variables**

   Copy the example env files and fill in real values:

   ```bash
   cp .env.example .env                       # backend API
   cp apps/admin/.env.example apps/admin/.env.local
   cp apps/web/.env.example apps/web/.env.local
   ```

   At minimum, the backend needs `DATABASE_URL` (already correct for the Docker Postgres
   above) and JWT secrets (`ADMIN_JWT_ACCESS_SECRET`, `ADMIN_JWT_REFRESH_SECRET`,
   `CUSTOMER_JWT_ACCESS_SECRET`, `CUSTOMER_JWT_REFRESH_SECRET`) — generate each with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   R2 (media uploads), SMTP (emails/2FA codes), and Google OAuth are optional locally —
   the app runs without them, just with those specific features disabled/logged instead
   of sent. See the comments in `.env.example` for details on each variable.

4. **Run database migrations and seed data**

   ```bash
   pnpm --filter @amader/db prisma:migrate
   pnpm --filter @amader/db prisma:seed
   ```

   The seed script creates a super admin account using `SUPER_ADMIN_EMAIL` /
   `SUPER_ADMIN_PASSWORD` from your `.env`.

## Running the apps

Run everything at once from the repo root:

```bash
pnpm dev
```

Or run a single app during focused work:

```bash
pnpm --filter @amader/backend dev   # API           → http://localhost:3000
pnpm --filter @amader/web dev       # Storefront     → http://localhost:3001
pnpm --filter @amader/admin dev     # Admin dashboard → http://localhost:3004
```

The backend serves interactive Swagger API docs at `http://localhost:3000/api/docs` once
running. Both frontends' typed API clients are generated from that same schema:

```bash
pnpm --filter @amader/admin typegen
pnpm --filter @amader/web typegen
```

## Other scripts

```bash
pnpm build   # Build all apps/packages (turbo run build)
pnpm lint    # Lint all apps/packages
pnpm test    # Run backend test suite (jest)
```

## Deployment

`.github/workflows/deploy.yml` deploys on push to `master`. It runs
`prisma migrate deploy` automatically as part of the pipeline — schema changes ship with
no manual step. One-off data backfills (raw SQL, not migrations) still need to be run
manually against the production database.

## License

Proprietary — all rights reserved by Amader Ltd. Not licensed for external use or
redistribution.
