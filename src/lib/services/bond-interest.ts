import { Decimal } from "decimal.js";
import { addMonths, addYears, endOfDay, startOfDay } from "date-fns";
import type { Holding } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MARKER_PREFIX = "BOND_INTEREST";
const REVIEWED_PREFIX = "reviewed:";

export interface BondInterestReview {
  holdingId: string;
  name: string;
  accountId: string;
  accountName: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  principal: Decimal;
  rate: Decimal;
  tdsRate: Decimal;
  grossInterest: Decimal;
  tdsAmount: Decimal;
  netAmount: Decimal;
}

export function bondInterestMarker(holdingId: string, periodStart: Date, periodEnd: Date) {
  return [
    MARKER_PREFIX,
    holdingId,
    startOfDay(periodStart).toISOString().slice(0, 10),
    startOfDay(periodEnd).toISOString().slice(0, 10),
  ].join(":");
}

function reviewedBondInterestTag(marker: string) {
  return `${REVIEWED_PREFIX}${marker}`;
}

export async function pendingBondInterestReviews(today = new Date()): Promise<BondInterestReview[]> {
  const holdings = await prisma.holding.findMany({
    where: {
      archived: false,
      type: "BOND",
      interestRate: { not: null },
      interestFreq: { not: null },
    },
    include: {
      account: true,
      trades: { where: { action: { in: ["BUY", "SIP_BUY"] } }, orderBy: { occurredAt: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const reviews: BondInterestReview[] = [];
  for (const holding of holdings) {
    if (holding.sipRuleId) {
      await prisma.recurringRule.delete({ where: { id: holding.sipRuleId } }).catch(() => {});
      await prisma.holding.update({ where: { id: holding.id }, data: { sipRuleId: null } }).catch(() => {});
    }
    const periods = bondInterestPeriods(holding, today);
    const period = await firstUnpostedBondPeriod(holding, periods);
    if (!period) continue;
    const principal = holding.principalAmount
      ? new Decimal(holding.principalAmount.toString())
      : new Decimal(holding.units.toString()).mul(holding.avgBuyPrice.toString());
    const rate = new Decimal(holding.interestRate!.toString());
    const tdsRate = holding.bondTdsRate ? new Decimal(holding.bondTdsRate.toString()) : new Decimal(10);
    const days = Math.max(0, Math.round((startOfDay(period.periodEnd).getTime() - startOfDay(period.periodStart).getTime()) / 86400000));
    const grossInterest = principal.mul(rate).mul(days).div(36500).toDecimalPlaces(2);
    if (grossInterest.lte(0)) continue;
    const tdsAmount = grossInterest.mul(tdsRate).div(100).toDecimalPlaces(2);
    reviews.push({
      holdingId: holding.id,
      name: holding.name,
      accountId: holding.accountId,
      accountName: holding.account.name,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.dueDate,
      principal,
      rate,
      tdsRate,
      grossInterest,
      tdsAmount,
      netAmount: grossInterest.minus(tdsAmount).toDecimalPlaces(2),
    });
  }
  return reviews;
}

export async function approveBondInterest(input: {
  holdingId: string;
  periodStart: Date;
  periodEnd: Date;
  grossInterest?: Decimal.Value;
  tdsAmount?: Decimal.Value;
  netAmount?: Decimal.Value;
}) {
  const holding = await prisma.holding.findUnique({ where: { id: input.holdingId } });
  if (!holding || holding.type !== "BOND") throw new Error("Bond holding not found");

  const marker = bondInterestMarker(holding.id, input.periodStart, input.periodEnd);
  const existing = await prisma.transaction.findFirst({ where: { notes: { startsWith: marker } } });
  if (existing) {
    await markBondInterestReviewed(holding.id, marker);
    return existing;
  }

  const reviews = await pendingBondInterestReviews(endOfDay(input.periodEnd));
  const review = reviews.find((r) => r.holdingId === holding.id && bondInterestMarker(r.holdingId, r.periodStart, r.periodEnd) === marker);
  const grossInterest = input.grossInterest !== undefined
    ? new Decimal(input.grossInterest).toDecimalPlaces(2)
    : review?.grossInterest ?? new Decimal(0);
  const tdsAmount = input.tdsAmount !== undefined
    ? new Decimal(input.tdsAmount).toDecimalPlaces(2)
    : review?.tdsAmount ?? new Decimal(0);
  const netAmount = input.netAmount !== undefined
    ? new Decimal(input.netAmount).toDecimalPlaces(2)
    : grossInterest.minus(tdsAmount).toDecimalPlaces(2);
  if (!netAmount.isFinite() || netAmount.lte(0)) throw new Error("Net credited amount must be greater than zero");

  const txn = await prisma.transaction.create({
    data: {
      type: "INCOME",
      amount: netAmount,
      occurredAt: startOfDay(input.periodEnd),
      description: `Bond interest: ${holding.name}`,
      notes: `${marker}; gross=${grossInterest.toFixed(2)}; tds=${tdsAmount.toFixed(2)}`,
      accountId: holding.accountId,
    },
  });

  await prisma.trade.create({
    data: {
      holdingId: holding.id,
      action: "INTEREST",
      units: "0",
      price: "0",
      amount: grossInterest.toFixed(2),
      charges: tdsAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      occurredAt: txn.occurredAt,
      transactionId: txn.id,
      notes: `TDS ${tdsAmount.toFixed(2)}`,
    },
  });
  await markBondInterestReviewed(holding.id, marker);

  return txn;
}

async function firstUnpostedBondPeriod(
  holding: Pick<Holding, "id" | "tags">,
  periods: Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }>
) {
  for (const period of periods) {
    const marker = bondInterestMarker(holding.id, period.periodStart, period.periodEnd);
    if (holding.tags.includes(reviewedBondInterestTag(marker))) continue;
    const existing = await prisma.transaction.findFirst({
      where: { notes: { startsWith: marker } },
      select: { id: true },
    });
    if (!existing) return period;
    await markBondInterestReviewed(holding.id, marker);
  }
  return null;
}

async function markBondInterestReviewed(holdingId: string, marker: string) {
  const tag = reviewedBondInterestTag(marker);
  const holding = await prisma.holding.findUnique({ where: { id: holdingId }, select: { tags: true } });
  if (!holding || holding.tags.includes(tag)) return;
  await prisma.holding.update({
    where: { id: holdingId },
    data: { tags: [...holding.tags, tag] },
  });
}

function bondInterestPeriods(
  holding: Holding & { trades: Array<{ occurredAt: Date }> },
  today: Date
): Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }> {
  if (!holding.interestFreq || !holding.interestRate) return [];
  const purchaseDate = startOfDay(holding.trades[0]?.occurredAt ?? holding.createdAt);
  const maturityDate = holding.maturityDate ? startOfDay(holding.maturityDate) : null;

  if (holding.interestFreq === "ON_MATURITY") {
    if (!maturityDate || maturityDate > today) return [];
    return [{ periodStart: purchaseDate, periodEnd: maturityDate, dueDate: maturityDate }];
  }

  const interval = holding.interestFreq === "MONTHLY" ? 1 : holding.interestFreq === "QUARTERLY" ? 3 : holding.interestFreq === "HALF_YEARLY" ? 6 : 12;
  const firstDue = firstBondDueDate(purchaseDate, holding.bondPayoutDay, interval);
  const periods: Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }> = [];
  let previous = purchaseDate;
  let due = firstDue;
  while (due <= today && (!maturityDate || due <= maturityDate)) {
    periods.push({ periodStart: previous, periodEnd: due, dueDate: due });
    previous = due;
    due = addMonths(due, interval);
  }
  return periods;
}

function firstBondDueDate(purchaseDate: Date, payoutDay: number | null, intervalMonths: number) {
  if (intervalMonths === 12 && !payoutDay) return addYears(purchaseDate, 1);
  const day = Math.min(Math.max(payoutDay ?? purchaseDate.getDate(), 1), 31);
  let due = withDay(purchaseDate, day);
  if (due <= purchaseDate) due = addMonths(due, intervalMonths);
  return due;
}

function withDay(date: Date, day: number) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return startOfDay(new Date(year, month, Math.min(day, lastDay)));
}
