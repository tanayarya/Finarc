import { prisma } from "@/lib/prisma";
import type { z } from "zod";
import { recurringCreateSchema, recurringUpdateSchema } from "@/lib/validators";
import { nextOccurrence } from "@/lib/finance/dates";
import { isAfter, isSameDay } from "date-fns";

export async function createRecurringRule(raw: z.infer<typeof recurringCreateSchema>) {
  const input = recurringCreateSchema.parse(raw);
  return prisma.recurringRule.create({
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
  });
  let count = 0;
  for (const rule of due) {
    let cursor = new Date(rule.nextRunDate);
    let safety = 0;
    while (!isAfter(cursor, now) && safety < 365) {
      if (rule.endDate && isAfter(cursor, rule.endDate)) break;
      const skipped = rule.skippedDates.some((d) => isSameDay(d, cursor));
      if (!skipped) {
        // For CREDIT_PAYMENT: use actual credit card balance instead of fixed amount
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

        await prisma.transaction.create({
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
