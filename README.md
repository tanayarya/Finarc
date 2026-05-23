# Finarc — Personal Finance Hub

A self-hosted, modern personal finance operating system. Track accounts, budgets, investments (stocks, MF, ETF, gold, bonds, FD, PF), credit cards, loans, recurring payments, and dues — all in one place.

## One-Click Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Ffinarc&env=DATABASE_URL&envDescription=PostgreSQL%20connection%20string.%20Get%20a%20free%20DB%20from%20neon.tech&envLink=https%3A%2F%2Fneon.tech&project-name=finarc&repository-name=finarc)

### Steps:
1. Click the button above
2. Get a free PostgreSQL database from [neon.tech](https://neon.tech) (takes 30 seconds)
3. Paste the connection string as `DATABASE_URL` when Vercel asks
4. Deploy — the schema is applied automatically during build
5. Open your app — default PIN is `123456`

That's it. No commands needed.

---

## Self-Host with Docker

```bash
git clone https://github.com/YOUR_USERNAME/finarc.git
cd finarc
docker compose up --build
```

Opens at http://localhost:3000. PostgreSQL included. Default PIN: `123456`.

---

## Run Locally (Development)

```bash
# Prerequisites: Node.js 18+, PostgreSQL running
cp .env.example .env   # edit DATABASE_URL if needed
npm install
npm run db:push
npm run db:seed        # optional: adds default categories
npm run dev
```

---

## Stack

- Next.js 14 (App Router) · TypeScript · React 18
- Tailwind CSS · shadcn/ui (Radix primitives)
- Prisma ORM · PostgreSQL
- Recharts · SWR · react-hook-form · Zod
- decimal.js for money math
- yahoo-finance2 (stocks) · mfapi.in (mutual funds) · gold-api.com (gold/silver)
- Telegram Bot API (notifications + transaction input)
- OpenAI / Ollama (AI assistant)
- PWA (installable on mobile)
- Docker for self-hosting

## Features

- **Dashboard** — Net worth, cash flow, budget health, credit obligations, portfolio widget
- **Accounts** — Savings, Cash, Credit, Loan, Investment (ledger-style balances)
- **Transactions** — Income, Expense, Transfer, Credit/Loan payments, tax deductible flag
- **Investments** — Stocks, MF, ETF, Gold, Silver, Bonds, FD, PF, Recurring Deposits
- **Budgets** — Weekly/Monthly/Yearly with status indicators
- **Recurring** — Auto-materialize, SIP, EMI, credit card auto-pay (actual balance)
- **Dues** — Track money lent/borrowed with settlement flow
- **Reports** — Trends, categories, net worth history, cash flow waterfall, distribution
- **AI Chat** — OpenAI or Ollama powered financial assistant
- **Telegram Bot** — Notifications + natural language transaction recording
- **Settings** — Currency, theme, PIN, trading charges, backup/restore, CSV export

## Default PIN

`123456` — change it in Settings → Preferences after first login.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

All other config (Telegram, OpenAI, currency, etc.) is managed through the Settings UI.
