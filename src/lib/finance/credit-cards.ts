import { Decimal } from "decimal.js";
import { addMonths, differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";

import { prisma } from "@/lib/prisma";
import { computeAccountBalance } from "@/lib/finance/balances";
import { ZERO } from "@/lib/money";

export function nextCreditDueDate(dueDay: number, anchor = new Date()) {
  const today = startOfDay(anchor);
  const day = clampBillingDay(dueDay);
  let dueDate = withBillingDay(today, day);
  if (dueDate < today) dueDate = withBillingDay(addMonths(today, 1), day);
  return dueDate;
}

export function daysUntilCreditDue(dueDay: number, anchor = new Date()) {
  return differenceInCalendarDays(nextCreditDueDate(dueDay, anchor), startOfDay(anchor));
}

export function dueMonthRelation(statementDay: number | null | undefined, dueDay: number | null | undefined) {
  if (!statementDay || !dueDay) return null;
  return dueDay <= statementDay ? "next_month" : "same_month";
}

export function statementDateForDueDate(dueDate: Date, statementDay: number, dueDay: number) {
  const statementMonth = dueDay <= statementDay ? addMonths(startOfDay(dueDate), -1) : startOfDay(dueDate);
  return withBillingDay(statementMonth, clampBillingDay(statementDay));
}

export async function computeCreditStatementPaymentAmount(accountId: string, paymentDate = new Date()) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.type !== "CREDIT") throw new Error("Credit account not found");

  const currentBalance = await computeAccountBalance(accountId, endOfDay(paymentDate));
  if (currentBalance.lte(0)) return ZERO;

  if (!account.statementDay || !account.dueDay) {
    return currentBalance;
  }

  const dueDate = nextCreditDueDate(account.dueDay, paymentDate);
  const statementDate = statementDateForDueDate(dueDate, account.statementDay, account.dueDay);
  const statementBalance = await computeAccountBalance(accountId, endOfDay(statementDate));
  if (statementBalance.lte(0)) return ZERO;

  const creditsAfterStatement = await prisma.transaction.findMany({
    where: {
      occurredAt: { gt: endOfDay(statementDate), lte: endOfDay(paymentDate) },
      OR: [
        { type: "CREDIT_PAYMENT", toAccountId: accountId },
        { type: "INCOME", accountId },
      ],
    },
    select: { amount: true },
  });

  const credits = creditsAfterStatement.reduce(
    (total, txn) => total.plus(txn.amount.toString()),
    new Decimal(0)
  );
  const statementDue = Decimal.max(statementBalance.minus(credits), 0);
  return Decimal.min(statementDue, currentBalance);
}

function withBillingDay(date: Date, day: number) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), Math.min(day, lastDay)));
}

function clampBillingDay(day: number) {
  return Math.min(Math.max(day, 1), 28);
}
