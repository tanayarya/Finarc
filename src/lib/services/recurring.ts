import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import type { z } from "zod";
import { recurringCreateSchema, recurringUpdateSchema } from "@/lib/validators";
import { nextOccurrence } from "@/lib/finance/dates";
import { isAfter, isSameDay } from "date-fns";

export async function createRecurringRule(raw: z.infer<typeof recurringCreateSchema>) {
  const input = recurringCreateSchema.parse(raw);
  const rule = await prisma.recurringRule.create({
    data: {
      name: input.name,
      type: input.type,
      amount: input.amount,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      nextRunDate: input.startDate,
      description: input.description ?? null,
      accountId: input.accountId ?? null,
      toAccountId: input.toAccountId ?? null,
      categoryId: input.categoryId ?? null,
    },
  });
  if (input.holdingId) {
    await prisma.holding.update({
      where: { id: input.holdingId },
      data: { sipRuleId: rule.id },
    });
  }
  return rule;
}

export async function updateRecurringRule(
  id: string,
  raw: z.infer<typeof recurringUpdateSchema>
) {
  const input = recurringUpdateSchema.parse(raw);
  const existing = await prisma.recurringRule.findUnique({ where: { id } });
  if (!existing) throw new Error("Rule not found");

  const data: Record<string, unknown> = {
    name: input.name,
    amount: input.amount,
    frequency: input.frequency,
    interval: input.interval,
    endDate: input.endDate ?? undefined,
    description: input.description ?? undefined,
    status: input.status,
  };

  if (input.skipDate) {
    const already = existing.skippedDates.some((d) => isSameDay(d, input.skipDate!));
    if (!already) data.skippedDates = [...existing.skippedDates, input.skipDate];
    // If we skipped the next run, advance it
    if (isSameDay(existing.nextRunDate, input.skipDate)) {
      data.nextRunDate = nextOccurrence(
        existing.nextRunDate,
        existing.frequency,
        existing.interval
      );
    }
  }

  return prisma.recurringRule.update({ where: { id }, data });
}

export async function deleteRecurringRule(id: string) {
  return prisma.recurringRule.delete({ where: { id } });
}

/**
 * Advance every active rule whose nextRunDate is in the past, materializing
 * a Transaction for each occurrence. Returns the number of generated txns.
 * Designed to be safe to call on every dashboard load.
 */
export async function materializeDueRecurring(now = new Date()): Promise<number> {
  const due = await prisma.recurringRule.findMany({
    where: { status: "ACTIVE", nextRunDate: { lte: now } },
    include: { sipHoldings: true },
  });
  let count = 0;
  for (const rule of due) {
    let cursor = new Date(rule.nextRunDate);
    let safety = 0;
    while (!isAfter(cursor, now) && safety < 365) {
      if (rule.endDate && isAfter(cursor, rule.endDate)) break;
      const skipped = rule.skippedDates.some((d) => isSameDay(d, cursor));
      if (!skipped) {
        // For CREDIT_PAYMENT: use actual credit card balance instead of fixed amount.
        // For LOAN_PAYMENT: cap the recurring payment to outstanding principal.
        let paymentAmount = rule.amount;
        if (rule.type === "CREDIT_PAYMENT" && rule.toAccountId) {
          const { computeAccountBalance } = await import("@/lib/finance/balances");
          const creditBalance = await computeAccountBalance(rule.toAccountId);
          // Only pay if there's an outstanding balance
          if (creditBalance.greaterThan(0)) {
            paymentAmount = creditBalance as any; // Decimal compatible
          } else {
            // No balance due — skip this occurrence
            cursor = nextOccurrence(cursor, rule.frequency, rule.interval);
            safety += 1;
            continue;
          }
        }
        if (rule.type === "LOAN_PAYMENT" && rule.toAccountId) {
          const { computeAccountBalance } = await import("@/lib/finance/balances");
          const loanBalance = await computeAccountBalance(rule.toAccountId);
          if (loanBalance.greaterThan(0)) {
            paymentAmount = loanBalance.lessThan(rule.amount) ? (loanBalance as any) : rule.amount;
          } else {
            cursor = nextOccurrence(cursor, rule.frequency, rule.interval);
            safety += 1;
            continue;
          }
        }

        const txn = await prisma.transaction.create({
          data: {
            type: rule.type,
            amount: paymentAmount.toString(),
            occurredAt: cursor,
            description: rule.description ?? rule.name,
            accountId: (rule.type === "TRANSFER" || rule.type === "CREDIT_PAYMENT" || rule.type === "LOAN_PAYMENT") ? null : rule.accountId,
            fromAccountId: (rule.type === "TRANSFER" || rule.type === "CREDIT_PAYMENT" || rule.type === "LOAN_PAYMENT") ? rule.accountId : null,
            toAccountId: (rule.type === "TRANSFER" || rule.type === "CREDIT_PAYMENT" || rule.type === "LOAN_PAYMENT") ? rule.toAccountId : null,
            categoryId: rule.categoryId,
            recurringRuleId: rule.id,
          },
        });
        const rdHolding = rule.sipHoldings.find((h) => h.assetClass === "RECURRING_DEPOSIT");
        if (rdHolding && rule.type === "EXPENSE") {
          await applyRecurringDepositInstallment(rdHolding.id, paymentAmount.toString(), cursor, txn.id);
        }
        count += 1;
      }
      cursor = nextOccurrence(cursor, rule.frequency, rule.interval);
      safety += 1;
    }
    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: { nextRunDate: cursor },
    });
  }
  return count;
}

async function applyRecurringDepositInstallment(
  holdingId: string,
  amount: string,
  occurredAt: Date,
  transactionId: string
) {
  const holding = await prisma.holding.findUnique({ where: { id: holdingId } });
  if (!holding || holding.archived || holding.assetClass !== "RECURRING_DEPOSIT") return;

  const installment = new Decimal(amount);
  const currentUnits = new Decimal(holding.units.toString());
  const nextUnits = currentUnits.plus(installment);
  const principal = holding.principalAmount
    ? new Decimal(holding.principalAmount.toString()).plus(installment)
    : nextUnits;

  await prisma.$transaction([
    prisma.trade.create({
      data: {
        holdingId,
        action: "SIP_BUY",
        units: installment.toFixed(6),
        price: "1.0000",
        amount: installment.toFixed(2),
        netAmount: installment.toFixed(2),
        occurredAt,
        transactionId,
      },
    }),
    prisma.holding.update({
      where: { id: holdingId },
      data: {
        units: nextUnits.toFixed(6),
        avgBuyPrice: "1.0000",
        currentPrice: "1.0000",
        principalAmount: principal.toFixed(2),
      },
    }),
  ]);
}
