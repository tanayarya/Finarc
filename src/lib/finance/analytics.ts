import { prisma } from "@/lib/prisma";
import { add, sub, toMoney, ZERO, type Money } from "@/lib/money";
import { eachDayOfInterval, eachMonthOfInterval, format, isSameDay, isSameMonth } from "date-fns";
import type { DateRange } from "./dates";

export interface SeriesPoint {
  date: string; // ISO date or month label
  income: number;
  expense: number;
  net: number;
}

export interface CategoryShare {
  categoryId: string;
  name: string;
  color: string | null;
  amount: number;
  share: number;
}

export interface AccountShare {
  accountId: string;
  name: string;
  type: string;
  amount: number;
  share: number;
}

export async function totalsForRange(range: DateRange) {
  const txns = await prisma.transaction.findMany({
    where: { occurredAt: { gte: range.from, lte: range.to } },
    select: { type: true, amount: true, account: { select: { type: true } }, trade: { select: { id: true } } },
  });
  let income = ZERO;
  let expense = ZERO;
  for (const t of txns) {
    if (t.trade) continue;
    if (t.type === "INCOME" && t.account?.type !== "CREDIT") income = add(income, t.amount);
    else if (t.type === "EXPENSE") expense = add(expense, t.amount);
  }
  return {
    income,
    expense,
    net: sub(income, expense) as Money,
    savingsRate: income.isZero() ? 0 : sub(income, expense).div(income).toNumber(),
  };
}

export async function incomeExpenseSeries(range: DateRange): Promise<SeriesPoint[]> {
  const txns = await prisma.transaction.findMany({
    where: { occurredAt: { gte: range.from, lte: range.to } },
    select: { type: true, amount: true, occurredAt: true, account: { select: { type: true } }, trade: { select: { id: true } } },
    orderBy: { occurredAt: "asc" },
  });

  const useDaily = range.kind === "WEEK" || (range.kind === "CUSTOM" && diffDays(range.from, range.to) <= 45);

  if (useDaily) {
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    return days.map((d) => {
      const dayTxns = txns.filter((t) => isSameDay(t.occurredAt, d) && !t.trade);
      const income = dayTxns
        .filter((t) => t.type === "INCOME" && t.account?.type !== "CREDIT")
        .reduce((acc, t) => acc + Number(t.amount), 0);
      const expense = dayTxns
        .filter((t) => t.type === "EXPENSE")
        .reduce((acc, t) => acc + Number(t.amount), 0);
      return {
        date: format(d, "MMM d"),
        income: round(income),
        expense: round(expense),
        net: round(income - expense),
      };
    });
  }

  const months = eachMonthOfInterval({ start: range.from, end: range.to });
  return months.map((m) => {
    const monthTxns = txns.filter((t) => isSameMonth(t.occurredAt, m) && !t.trade);
    const income = monthTxns
      .filter((t) => t.type === "INCOME" && t.account?.type !== "CREDIT")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = monthTxns
      .filter((t) => t.type === "EXPENSE")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    return {
      date: format(m, "MMM yyyy"),
      income: round(income),
      expense: round(expense),
      net: round(income - expense),
    };
  });
}

export async function categoryBreakdown(range: DateRange): Promise<CategoryShare[]> {
  const txns = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      occurredAt: { gte: range.from, lte: range.to },
      categoryId: { not: null },
      trade: null,
    },
    select: { amount: true, category: true, categoryId: true },
  });
  const totals = new Map<string, { name: string; color: string | null; amount: number }>();
  for (const t of txns) {
    if (!t.categoryId || !t.category) continue;
    const prev = totals.get(t.categoryId) ?? {
      name: t.category.name,
      color: t.category.color,
      amount: 0,
    };
    prev.amount += Number(t.amount);
    totals.set(t.categoryId, prev);
  }
  const total = Array.from(totals.values()).reduce((a, b) => a + b.amount, 0);
  return Array.from(totals.entries())
    .map(([categoryId, v]) => ({
      categoryId,
      name: v.name,
      color: v.color,
      amount: round(v.amount),
      share: total === 0 ? 0 : v.amount / total,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function accountDistribution(): Promise<AccountShare[]> {
  const accounts = await prisma.account.findMany({ where: { archived: false } });
  const txns = await prisma.transaction.findMany({
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });

  const balances = accounts.map((a) => {
    let bal = toMoney(a.openingBalance);
    for (const t of txns) {
      const amt = toMoney(t.amount);
      if (a.type === "SAVINGS" || a.type === "CASH" || a.type === "INVESTMENT") {
        if (t.type === "INCOME" && t.accountId === a.id) bal = bal.plus(amt);
        if (t.type === "EXPENSE" && t.accountId === a.id) bal = bal.minus(amt);
        if (t.type === "TRANSFER" && t.fromAccountId === a.id) bal = bal.minus(amt);
        if (t.type === "TRANSFER" && t.toAccountId === a.id) bal = bal.plus(amt);
        if ((t.type === "CREDIT_PAYMENT" || t.type === "LOAN_PAYMENT") && t.fromAccountId === a.id)
          bal = bal.minus(amt);
      } else if (a.type === "CREDIT") {
        if (t.type === "EXPENSE" && t.accountId === a.id) bal = bal.plus(amt);
        if (t.type === "CREDIT_PAYMENT" && t.toAccountId === a.id) bal = bal.minus(amt);
        if (t.type === "INCOME" && t.accountId === a.id) bal = bal.minus(amt);
      } else if (a.type === "LOAN") {
        if (t.type === "LOAN_PAYMENT" && t.toAccountId === a.id) bal = bal.minus(amt);
      }
    }
    return { account: a, balance: bal.toNumber() };
  });

  // Distribution shows where assets sit (positive only)
  const assets = balances.filter(({ account, balance }) =>
    (["SAVINGS", "CASH", "INVESTMENT"].includes(account.type) && balance > 0) ||
    (["CREDIT", "LOAN"].includes(account.type) && balance < 0)
  );
  const total = assets.reduce((a, b) => a + Math.abs(b.balance), 0);
  return assets
    .map(({ account, balance }) => ({
      accountId: account.id,
      name: account.name,
      type: account.type,
      amount: round(Math.abs(balance)),
      share: total === 0 ? 0 : Math.abs(balance) / total,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function round(n: number, dp = 2) {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

function diffDays(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
