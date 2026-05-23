# Finarc — Personal Finance Hub

A self-hosted, modern personal finance operating system. Track accounts, budgets, investments (stocks, MF, ETF, gold, bonds, FD, PF), credit cards, loans, recurring payments, and dues — all in one place.

---

## Deploy on Vercel (Step-by-Step)

### Step 1: Get a Free Database

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Click "Create Project" → give it any name (e.g., "finarc")
3. Once created, you'll see a connection string like:
   ```
   postgresql://neondb_owner:aBcDeF123@ep-cool-name-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Copy this full string — you'll need it in Step 3

### Step 2: Deploy to Vercel

1. Fork this repo to your GitHub account
2. Go to [vercel.com](https://vercel.com) → "Add New Project"
3. Import your forked repo
4. Before clicking "Deploy", go to **Environment Variables** section

### Step 3: Add Environment Variable

1. Click "Environment Variables" in the deploy screen
2. Add:
   - **Key:** `DATABASE_URL`
   - **Value:** paste your Neon connection string from Step 1
   - Example: `postgresql://neondb_owner:aBcDeF123@ep-cool-name-12345.us-east-2.aws.neon.tech/neondb?sslmode=require`
3. **Important:** Make sure "Production" is selected under Environments (not just Development)
4. Click "Save"

### Step 4: Deploy

1. Click "Deploy"
2. Wait 2-3 minutes for the build to complete
3. The database tables are created automatically during build
4. Open your app URL — you'll see the PIN screen

### Step 5: Login

- Default PIN: `123456`
- Change it in Settings → Preferences after first login

That's it. No terminal commands needed.

---

## Alternative Database Providers

Instead of Neon, you can use any PostgreSQL provider. Just paste their connection string as `DATABASE_URL`:

| Provider | Free Tier | Connection String Format |
|----------|-----------|------------------------|
| [Neon](https://neon.tech) | 0.5 GB | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require` |
| [Supabase](https://supabase.com) | 500 MB | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| [Aiven](https://aiven.io) | 5 GB | `postgresql://user:pass@xxx.aivencloud.com:port/defaultdb?sslmode=require` |
| [CockroachDB](https://cockroachlabs.cloud) | 10 GB | `postgresql://user:pass@xxx.cockroachlabs.cloud:26257/defaultdb?sslmode=require` |

The URL **must** start with `postgresql://` or `postgres://`.

---

## Self-Host with Docker

```bash
git clone https://github.com/YOUR_USERNAME/finarc.git
cd finarc
docker compose up --build
```

Opens at http://localhost:3000. PostgreSQL included in the Docker setup. Default PIN: `123456`.

---

## Run Locally (Development)

```bash
# Prerequisites: Node.js 18+, PostgreSQL running locally
cp .env.example .env   # edit DATABASE_URL if needed
npm install
npm run db:push        # creates all tables
npm run db:seed        # optional: adds default categories
npm run dev            # starts at http://localhost:3000
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
| `DATABASE_URL` | Yes | PostgreSQL connection string (must start with `postgresql://`) |

All other config (Telegram bot token, OpenAI key, currency, etc.) is managed through the Settings UI inside the app. No additional environment variables needed.

## Troubleshooting

**Build fails with "DATABASE_URL not found"**
→ You didn't add the environment variable in Vercel. Go to Settings → Environment Variables → add it.

**Build fails with "URL must start with postgresql://"**
→ Your connection string is wrong. Make sure it starts with `postgresql://` not something else.

**PIN 123456 doesn't work**
→ Database connection failed. Check your DATABASE_URL is correct and the database is accessible.

**Charts show black tooltip in dark mode**
→ Hard refresh (Ctrl+Shift+R) to clear cached CSS.
