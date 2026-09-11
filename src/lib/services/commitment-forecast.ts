import { addDays } from "date-fns";
import { Decimal } from "decimal.js";
import { DueStatus, DueType, TransactionType } from "@prisma/client";

import { computeAllBalances } from "@/lib/finance/balances";
import { nextCreditDueDate, computeCreditStatementPaymentAmount } from "@/lib/finance/credit-cards";
import { occurrencesBetween } from "@/lib/finance/recurring";
import { endOfFinanceDay, startOfFinanceDay } from "@/lib/finance/dates";
import { toMoney, ZERO } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const FORECAST_DAYS = 90;
const LIQUID_ACCOUNT_TYPES = new Set(["SAVINGS", "CASH"]);

export interface CommitmentForecast {
  horizonDays: number;
  liquidBalance: string;
  liquidAccountCount: number;
  next30Days: {
    inflow: string;
    outflow: string;
    net: string;
    projectedBalance: string;
  };
  monthlyKnownOutflow: string;
  runwayMonths: number | null;
}

interface PendingEvent {
  date: string;
  delta: Decimal;
}

/**
 * Read-only projection of scheduled cash movement. It intentionally excludes
 * unscheduled spending, future card charges, and investment sale proceeds.
 */
export async function getCommitmentForecast(): Promise<CommitmentForecast> {
  const today = startOfFinanceDay(new Date());
  const horizonEnd = endOfFinanceDay(addDays(today, FORECAST_DAYS - 1));

  const [balances, rules, dues] = await Promise.all([
    computeAllBalances(),
    prisma.recurringRule.findMany({ where: { status: "ACTIVE" } }),
    prisma.due.findMany({
      where: {
        type: DueType.PAYABLE,
        status: { in: [DueStatus.PENDING, DueStatus.PARTIAL] },
        dueDate: { gte: today, lte: horizonEnd },
      },
    }),
  ]);

  const liquidBalances = balances.filter(({ account }) => LIQUID_ACCOUNT_TYPES.has(account.type));
  const liquidAccountIds = new Set(liquidBalances.map(({ account }) => account.id));
  const liquidBalance = liquidBalances.reduce((total, { balance }) => total.plus(Decimal.max(balance, ZERO)), ZERO);
  const events: PendingEvent[] = [];

  for (const rule of rules) {
    // Credit-card rules dynamically pay the statement amount. Forecast those
    // as card dues below instead of showing the rule's fixed placeholder value.
    if (rule.type === TransactionType.CREDIT_PAYMENT) continue;

    for (const date of occurrencesBetween(rule, today, horizonEnd)) {
      const delta = recurringDelta(rule.type, rule.amount, rule.accountId, rule.toAccountId, liquidAccountIds);
      if (delta.isZero()) continue;

      events.push({
        date: date.toISOString(),
        delta,
      });
    }
  }

  const creditAccounts = balances
    .map(({ account }) => account)
    .filter((account) => account.type === "CREDIT" && account.dueDay);

  for (const account of creditAccounts) {
    const dueDate = nextCreditDueDate(account.dueDay!, today);
    if (dueDate > horizonEnd) continue;

    const amount = await computeCreditStatementPaymentAmount(account.id, dueDate);
    if (amount.lte(0)) continue;

    events.push({
      date: dueDate.toISOString(),
      delta: amount.negated(),
    });
  }

  for (const due of dues) {
    const remaining = toMoney(due.amount).minus(due.amountSettled);
    if (remaining.lte(0) || !due.dueDate) continue;

    events.push({
      date: due.dueDate.toISOString(),
      delta: remaining.negated(),
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  let next30Inflow = ZERO;
  let next30Outflow = ZERO;
  let totalOutflow = ZERO;
  const thirtyDayEnd = endOfFinanceDay(addDays(today, 29));
  for (const event of events) {
    if (event.delta.isNegative()) totalOutflow = totalOutflow.plus(event.delta.abs());
    if (new Date(event.date) > thirtyDayEnd) continue;
    if (event.delta.isNegative()) next30Outflow = next30Outflow.plus(event.delta.abs());
    else next30Inflow = next30Inflow.plus(event.delta);
  }

  const monthlyKnownOutflow = totalOutflow
    .div(FORECAST_DAYS)
    .mul(30.4375)
    .toDecimalPlaces(2);
  const runwayMonths = monthlyKnownOutflow.gt(0)
    ? liquidBalance.div(monthlyKnownOutflow).toDecimalPlaces(1).toNumber()
    : null;
  const next30Net = next30Inflow.minus(next30Outflow);

  return {
    horizonDays: FORECAST_DAYS,
    liquidBalance: liquidBalance.toFixed(2),
    liquidAccountCount: liquidBalances.length,
    next30Days: {
      inflow: next30Inflow.toFixed(2),
      outflow: next30Outflow.toFixed(2),
      net: next30Net.toFixed(2),
      projectedBalance: liquidBalance.plus(next30Net).toFixed(2),
    },
    monthlyKnownOutflow: monthlyKnownOutflow.toFixed(2),
    runwayMonths,
  };
}

function recurringDelta(
  type: TransactionType,
  amount: Decimal,
  accountId: string | null,
  toAccountId: string | null,
  liquidAccountIds: Set<string>
) {
  const value = toMoney(amount);
  const accountIsLiquid = accountId ? liquidAccountIds.has(accountId) : false;
  const destinationIsLiquid = toAccountId ? liquidAccountIds.has(toAccountId) : false;

  if (type === TransactionType.INCOME) return accountIsLiquid ? value : ZERO;
  if (type === TransactionType.EXPENSE) return accountIsLiquid ? value.negated() : ZERO;
  if (type === TransactionType.LOAN_PAYMENT) return accountIsLiquid ? value.negated() : ZERO;
  if (type === TransactionType.TRANSFER) {
    if (accountIsLiquid === destinationIsLiquid) return ZERO;
    return accountIsLiquid ? value.negated() : value;
  }

  return ZERO;
}
