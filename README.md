# Finarc — Personal Finance Hub

A self-hosted, modern personal finance operating system. Tracks accounts as ledger entities, enforces correct credit/loan logic, and surfaces actionable analytics across budgets, cash flow, and obligations.

## Stack

- Next.js 14 (App Router, RSC, standalone build)
- TypeScript, React 18, Tailwind CSS, shadcn/ui (Radix primitives)
- Prisma ORM + PostgreSQL
- decimal.js for money math, Zod for validation
- SWR + react-hook-form
- Recharts for analytics
- Docker for deployment

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then open http://localhost:3000.

The first run applies migrations automatically. Seed the default categories with:

```bash
docker compose exec app sh -c "npx tsx prisma/seed.ts"
```

## Run locally

```bash
cp .env.example .env   # adjust DATABASE_URL if needed
npm install
npx prisma migrate dev --name init
npm run db:seed         # optional default categories
npm run dev
```

## Modules

- **Dashboard** — net worth, cash flow trend, category breakdown, account distribution, budget health, credit obligations, recent activity, upcoming recurring transactions, with Week / Month / Year / Custom range filters.
- **Accounts** — Savings, Cash, Credit, Loan, Investment. Ledger semantics: balances flow from transactions only.
- **Transactions** — Income, Expense, Transfer, Credit payment, Loan payment. Filtering by type, account, and free-text search.
- **Budgets** — Custom categories, weekly / monthly / yearly periods, healthy / near-limit / over-budget status.
- **Investments** — Preview module with dashboard placement reserved for Phase 3.
- **Reports** — Trend, category, account, and budget reporting with date ranges.
- **Settings** — Theme, preferences, JSON backup export, and import.

## Financial logic highlights

- Account balances are derived from the immutable transaction ledger plus an opening balance. Manual balance editing after creation is intentionally disabled to keep the ledger consistent.
- Credit purchases create a single expense (consumes the budget category) and increase the credit liability. Credit payments move money from an asset to the credit account without creating a duplicate expense.
- Loan payments move from an asset to the loan account, reducing the principal owed.
- Transfers do not affect budgets, income, or expense metrics.
- Recurring rules support skip and pause; each occurrence materializes as a real transaction.

## Project structure

```
src/
  app/               # Next.js routes (pages + API)
  components/
    ui/              # shadcn primitives (button, card, dialog, ...)
    dashboard/
    transactions/
    accounts/
    budgets/
    categories/
    layout/          # sidebar, top bar, mobile bottom nav, FAB
  hooks/             # SWR data hooks
  lib/
    finance/         # balances, budgets, analytics, dates, recurring
    services/        # write-side business logic
    money.ts         # decimal-safe math
    validators.ts    # zod schemas (single source of truth)
prisma/
  schema.prisma
  seed.ts
```
