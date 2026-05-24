import { Decimal } from "decimal.js";
import {
  addDays,
  endOfDay,
  endOfMonth,
  isAfter,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { Account, SavingsInterestFrequency, Transaction } from "@prisma/client";

import { applyTxnToBalance } from "@/lib/finance/balances";
import { toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const MARKER_PREFIX = "SAVINGS_INTEREST";

type AccountLite = Account & {
  savingsInterestRate: Decimal | null;
  savingsInterestFrequency: SavingsInterestFrequency | null;
};

type TxnLite = Pick<
  Transaction,
  "type" | "amount" | "accountId" | "fromAccountId" | "toAccountId" | "occurredAt"
>;

export interface SavingsInterestReview {
  accountId: string;
  accountName: string;
  frequency: SavingsInterestFrequency;
  rate: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  amount: Decimal;
}

export function savingsInterestMarker(accountId: string, periodStart: Date, periodEnd: Date) {
  return [
    MARKER_PREFIX,
    accountId,
    startOfDay(periodStart).toISOString().slice(0, 10),
    startOfDay(periodEnd).toISOString().slice(0, 10),
  ].join(":");
}

export function savingsInterestPeriod(
  frequency: SavingsInterestFrequency,
  today = new Date()
): { periodStart: Date; periodEnd: Date; dueDate: Date } {
  const monthStart = startOfMonth(today);
  if (frequency === "MONTHLY") {
    const periodStart = startOfMonth(subMonths(monthStart, 1));
    return {
      periodStart,
      periodEnd: endOfMonth(periodStart),
      dueDate: monthStart,
    };
  }

  const currentQuarterStartMonth = Math.floor(monthStart.getMonth() / 3) * 3;
  const currentQuarterStart = new Date(monthStart.getFullYear(), currentQuarterStartMonth, 1);
  const previousQuarterStart = new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth() - 3, 1);
  const previousQuarterEnd = endOfDay(new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth(), 0));
  return {
    periodStart: previousQuarterStart,
    periodEnd: previousQuarterEnd,
    dueDate: currentQuarterStart,
  };
}

export async function computeSavingsInterest(
  accountId: string,
  periodStart: Date,
  periodEnd: Date,
  annualRate: Decimal.Value
) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");
  if (account.type !== "SAVINGS") throw new Error("Savings interest can only be calculated for savings accounts");

  const effectiveStart = isAfter(startOfDay(account.createdAt), startOfDay(periodStart))
    ? startOfDay(account.createdAt)
    : startOfDay(periodStart);
  const effectiveEnd = endOfDay(periodEnd);
  if (isAfter(effectiveStart, effectiveEnd)) return new Decimal(0);

  const txns = await prisma.transaction.findMany({
    where: {
      occurredAt: { lte: effectiveEnd },
      OR: [
        { accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId },
      ],
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
      occurredAt: true,
    },
  });

  let balance = toMoney(account.openingBalance);
  const periodTxns: TxnLite[] = [];
  for (const txn of txns) {
    if (txn.occurredAt < effectiveStart) {
      balance = applyTxnToBalance(account, balance, txn);
    } else {
      periodTxns.push(txn);
    }
  }

  let product = new Decimal(0);
  let cursor = effectiveStart;
  let idx = 0;
  while (cursor <= effectiveEnd) {
    const dayEnd = endOfDay(cursor);
    while (idx < periodTxns.length && periodTxns[idx].occurredAt <= dayEnd) {
      balance = applyTxnToBalance(account, balance, periodTxns[idx]);
      idx += 1;
    }
    product = product.plus(Decimal.max(balance, 0));
    cursor = addDays(cursor, 1);
  }

  return product.mul(new Decimal(annualRate)).div(36500).toDecimalPlaces(2);
}

export async function pendingSavingsInterestReviews(today = new Date()): Promise<SavingsInterestReview[]> {
  const accounts = await prisma.account.findMany({
    where: {
      archived: false,
      type: "SAVINGS",
      savingsInterestRate: { not: null },
      savingsInterestFrequency: { not: null },
    },
    orderBy: { name: "asc" },
  });

  const reviews: SavingsInterestReview[] = [];
  for (const account of accounts as AccountLite[]) {
    if (!account.savingsInterestRate || account.savingsInterestRate.lte(0) || !account.savingsInterestFrequency) continue;
    const period = savingsInterestPeriod(account.savingsInterestFrequency, today);
    if (period.dueDate > today) continue;
    const marker = savingsInterestMarker(account.id, period.periodStart, period.periodEnd);
    const existing = await prisma.transaction.findFirst({
      where: { accountId: account.id, notes: marker },
      select: { id: true },
    });
    if (existing) continue;
    const amount = await computeSavingsInterest(account.id, period.periodStart, period.periodEnd, account.savingsInterestRate);
    if (amount.lte(0)) continue;
    reviews.push({
      accountId: account.id,
      accountName: account.name,
      frequency: account.savingsInterestFrequency,
      rate: account.savingsInterestRate.toString(),
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.dueDate,
      amount,
    });
  }
  return reviews;
}

export async function approveSavingsInterest(input: {
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  amount?: Decimal.Value;
}) {
  const account = await prisma.account.findUnique({ where: { id: input.accountId } });
  if (!account || account.type !== "SAVINGS") throw new Error("Savings account not found");
  if (!account.savingsInterestRate) throw new Error("Savings interest rate is not configured");

  const marker = savingsInterestMarker(account.id, input.periodStart, input.periodEnd);
  const existing = await prisma.transaction.findFirst({ where: { accountId: account.id, notes: marker } });
  if (existing) return existing;

  const expected = await computeSavingsInterest(account.id, input.periodStart, input.periodEnd, account.savingsInterestRate);
  const amount = input.amount === undefined ? expected : new Decimal(input.amount).toDecimalPlaces(2);
  if (!amount.isFinite() || amount.lte(0)) throw new Error("Interest amount must be greater than zero");

  const dueDate = addDays(endOfDay(input.periodEnd), 1);
  const label = `${input.periodStart.toLocaleDateString("en-IN", { month: "short", year: "numeric" })} - ${input.periodEnd.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
  return prisma.transaction.create({
    data: {
      type: "INCOME",
      amount,
      occurredAt: startOfDay(dueDate),
      description: `Savings interest: ${account.name} (${label})`,
      notes: marker,
      accountId: account.id,
    },
  });
}
