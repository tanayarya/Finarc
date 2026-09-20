import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { accountCreateSchema, accountUpdateSchema } from "@/lib/validators";
import { computeAccountBalance } from "@/lib/finance/balances";
import { toMoney, ZERO } from "@/lib/money";
import type { DateRange } from "@/lib/finance/dates";

export interface AccountPeriodInsights {
  range: { kind: DateRange["kind"]; from: Date; to: Date; label: string };
  totalCredits: string;
  totalDebits: string;
  incomeReceived: string;
  interestCredited: string;
  cardSpend: string;
  paymentsReceived: string;
  refundsReceived: string;
  topCategories: Array<{ categoryId: string; name: string; color: string | null; amount: string }>;
  transactionCount: number;
}

export async function createAccount(raw: z.infer<typeof accountCreateSchema>) {
  const input = accountCreateSchema.parse(raw);
  return prisma.account.create({
    data: {
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalance: input.openingBalance,
      creditLimit: input.creditLimit ?? null,
      statementDay: input.statementDay ?? null,
      dueDay: input.dueDay ?? null,
      loanPrincipal: input.loanPrincipal ?? null,
      loanStartDate: input.loanStartDate ?? null,
      loanEndDate: input.loanEndDate ?? null,
      institution: input.institution ?? null,
      notes: input.notes ?? null,
      savingsInterestRate: input.type === "SAVINGS" ? input.savingsInterestRate ?? null : null,
      savingsInterestFrequency: input.type === "SAVINGS" ? input.savingsInterestFrequency ?? null : null,
      color: input.color ?? null,
      icon: input.icon ?? null,
    },
  });
}

export async function updateAccount(id: string, raw: z.infer<typeof accountUpdateSchema>) {
  const input = accountUpdateSchema.parse(raw);
  // Manual balance editing is intentionally not supported. openingBalance is locked
  // to preserve the ledger guarantee.
  return prisma.account.update({
    where: { id },
    data: {
      name: input.name,
      creditLimit: input.creditLimit ?? undefined,
      statementDay: input.statementDay ?? undefined,
      dueDay: input.dueDay ?? undefined,
      institution: input.institution ?? undefined,
      notes: input.notes ?? undefined,
      savingsInterestRate: input.savingsInterestRate === undefined ? undefined : input.savingsInterestRate,
      savingsInterestFrequency: input.savingsInterestFrequency === undefined ? undefined : input.savingsInterestFrequency,
      color: input.color ?? undefined,
      icon: input.icon ?? undefined,
      archived: input.archived ?? undefined,
    },
  });
}

export async function listAccountsWithBalance(options: { includeArchived?: boolean } = {}) {
  const accounts = await prisma.account.findMany({
    where: options.includeArchived ? undefined : { archived: false },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  const txns = await prisma.transaction.findMany({
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });
  // Use shared helper for consistency
  const { applyTxnToBalance } = await import("@/lib/finance/balances");
  const { toMoney } = await import("@/lib/money");
  return accounts.map((a) => {
    let bal = toMoney(a.openingBalance);
    for (const t of txns) bal = applyTxnToBalance(a, bal, t);
    return { ...a, balance: bal.toFixed(2) };
  });
}

export async function getAccountDetails(id: string, range?: DateRange) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return null;
  const accountTransactionsWhere = {
    OR: [{ accountId: id }, { fromAccountId: id }, { toAccountId: id }],
  };
  const [balance, recentTxns, periodTransactions] = await Promise.all([
    computeAccountBalance(id),
    prisma.transaction.findMany({
      where: accountTransactionsWhere,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 25,
      include: { category: true, account: true, fromAccount: true, toAccount: true },
    }),
    range && (account.type === "SAVINGS" || account.type === "CREDIT")
      ? prisma.transaction.findMany({
          where: {
            AND: [
              accountTransactionsWhere,
              { occurredAt: { gte: range.from, lte: range.to } },
            ],
          },
          select: {
            type: true,
            amount: true,
            accountId: true,
            fromAccountId: true,
            toAccountId: true,
            notes: true,
            categoryId: true,
            category: { select: { id: true, name: true, color: true } },
            trade: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const insights = range && (account.type === "SAVINGS" || account.type === "CREDIT")
    ? buildAccountPeriodInsights(account.type, id, range, periodTransactions)
    : null;

  return { account, balance: balance.toFixed(2), recentTransactions: recentTxns, insights };
}

type InsightTransaction = {
  type: string;
  amount: Prisma.Decimal;
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  notes: string | null;
  categoryId: string | null;
  category: { id: string; name: string; color: string | null } | null;
  trade: { id: string } | null;
};

function buildAccountPeriodInsights(
  accountType: "SAVINGS" | "CREDIT",
  accountId: string,
  range: DateRange,
  transactions: InsightTransaction[]
): AccountPeriodInsights {
  let totalCredits = ZERO;
  let totalDebits = ZERO;
  let incomeReceived = ZERO;
  let interestCredited = ZERO;
  let cardSpend = ZERO;
  let paymentsReceived = ZERO;
  let refundsReceived = ZERO;
  const categories = new Map<string, { categoryId: string; name: string; color: string | null; amount: ReturnType<typeof toMoney> }>();

  for (const transaction of transactions) {
    const amount = toMoney(transaction.amount);
    const isIncome = transaction.type === "INCOME" && transaction.accountId === accountId;
    const isExpense = transaction.type === "EXPENSE" && transaction.accountId === accountId;
    const isTransferIn = transaction.type === "TRANSFER" && transaction.toAccountId === accountId;
    const isTransferOut = transaction.type === "TRANSFER" && transaction.fromAccountId === accountId;
    const isCardPayment = transaction.type === "CREDIT_PAYMENT" && transaction.toAccountId === accountId;
    const isPaymentOut = (transaction.type === "CREDIT_PAYMENT" || transaction.type === "LOAN_PAYMENT") && transaction.fromAccountId === accountId;

    if (accountType === "SAVINGS") {
      if (isIncome) {
        incomeReceived = incomeReceived.plus(amount);
        totalCredits = totalCredits.plus(amount);
        if (transaction.notes?.startsWith("SAVINGS_INTEREST:")) interestCredited = interestCredited.plus(amount);
      }
      if (isTransferIn) totalCredits = totalCredits.plus(amount);
      if (isExpense || isTransferOut || isPaymentOut) totalDebits = totalDebits.plus(amount);
    } else {
      if (isExpense) cardSpend = cardSpend.plus(amount);
      if (isCardPayment) paymentsReceived = paymentsReceived.plus(amount);
      if (isIncome) refundsReceived = refundsReceived.plus(amount);
    }

    if (isExpense && !transaction.trade && transaction.categoryId && transaction.category) {
      const current = categories.get(transaction.categoryId) ?? {
        categoryId: transaction.category.id,
        name: transaction.category.name,
        color: transaction.category.color,
        amount: ZERO,
      };
      current.amount = current.amount.plus(amount);
      categories.set(transaction.categoryId, current);
    }
  }

  return {
    range: { kind: range.kind, from: range.from, to: range.to, label: range.label },
    totalCredits: totalCredits.toFixed(2),
    totalDebits: totalDebits.toFixed(2),
    incomeReceived: incomeReceived.toFixed(2),
    interestCredited: interestCredited.toFixed(2),
    cardSpend: cardSpend.toFixed(2),
    paymentsReceived: paymentsReceived.toFixed(2),
    refundsReceived: refundsReceived.toFixed(2),
    topCategories: Array.from(categories.values())
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .slice(0, 3)
      .map((category) => ({ ...category, amount: category.amount.toFixed(2) })),
    transactionCount: transactions.length,
  };
}

export async function archiveAccount(id: string) {
  return prisma.account.update({ where: { id }, data: { archived: true } });
}
