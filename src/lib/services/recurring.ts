import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import type { z } from "zod";
import { recurringCreateSchema, recurringUpdateSchema } from "@/lib/validators";
import { nextOccurrence } from "@/lib/finance/dates";
import { addDays, isAfter, isSameDay, startOfDay } from "date-fns";
import type { Holding } from "@prisma/client";
import { fetchMFNavForDate } from "@/lib/services/investments";

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
  await reconcileUnlinkedRecurringInvestmentTransactions(now);
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
          const { computeCreditStatementPaymentAmount } = await import("@/lib/finance/credit-cards");
          const statementDue = await computeCreditStatementPaymentAmount(rule.toAccountId, cursor);
          // Only pay the statement balance due for this card cycle.
          if (statementDue.greaterThan(0)) {
            paymentAmount = statementDue as any; // Decimal compatible
          } else {
            // No statement balance due — skip this occurrence
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

        const investmentHolding = await findRecurringInvestmentHolding(rule);
        const investmentPlan = investmentHolding && rule.type === "EXPENSE"
          ? await buildRecurringInvestmentPlan(investmentHolding, paymentAmount.toString(), cursor, now)
          : null;
        if (investmentPlan && !investmentPlan.ready) break;

        const txn = await prisma.transaction.create({
          data: {
            type: rule.type,
            amount: paymentAmount.toString(),
            occurredAt: investmentPlan?.occurredAt ?? cursor,
            description: rule.description ?? rule.name,
            accountId: (rule.type === "TRANSFER" || rule.type === "CREDIT_PAYMENT" || rule.type === "LOAN_PAYMENT") ? null : rule.accountId,
            fromAccountId: (rule.type === "TRANSFER" || rule.type === "CREDIT_PAYMENT" || rule.type === "LOAN_PAYMENT") ? rule.accountId : null,
            toAccountId: (rule.type === "TRANSFER" || rule.type === "CREDIT_PAYMENT" || rule.type === "LOAN_PAYMENT") ? rule.toAccountId : null,
            categoryId: rule.categoryId,
            recurringRuleId: rule.id,
          },
        });
        const rdHolding = investmentHolding?.assetClass === "RECURRING_DEPOSIT" ? investmentHolding : null;
        if (rdHolding && rule.type === "EXPENSE") {
          await applyRecurringDepositInstallment(rdHolding.id, paymentAmount.toString(), cursor, txn.id);
        } else if (investmentPlan?.ready && investmentHolding) {
          await applyRecurringInvestmentBuy(investmentHolding.id, investmentPlan, txn.id);
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

type RecurringRuleWithHoldings = Awaited<ReturnType<typeof prisma.recurringRule.findMany>>[number] & {
  sipHoldings: Holding[];
};

async function findRecurringInvestmentHolding(rule: RecurringRuleWithHoldings) {
  const linked = rule.sipHoldings.find((h) => !h.archived);
  if (linked) return linked;
  if (!rule.accountId || !/^(SIP|RD|PF):/i.test(rule.name)) return null;

  const rawName = rule.name.replace(/^(SIP|RD|PF):\s*/i, "").trim();
  const normalized = normalizeName(rawName);
  const candidates = await prisma.holding.findMany({
    where: { accountId: rule.accountId, archived: false },
  });
  const match = candidates.find((h) =>
    normalizeName(h.name) === normalized ||
    normalizeName(h.symbol) === normalized
  );
  if (!match) return null;
  await prisma.holding.update({
    where: { id: match.id },
    data: { sipRuleId: rule.id },
  });
  return match;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function buildRecurringInvestmentPlan(
  holding: Holding,
  amount: string,
  dueDate: Date,
  now: Date
): Promise<
  | { ready: false }
  | { ready: true; occurredAt: Date; units: Decimal; price: Decimal; amount: Decimal }
> {
  const investmentAmount = new Decimal(amount);
  if (holding.assetClass === "RECURRING_DEPOSIT") {
    return {
      ready: true,
      occurredAt: dueDate,
      units: investmentAmount,
      price: new Decimal(1),
      amount: investmentAmount,
    };
  }

  if (holding.type === "PROVIDENT_FUND") {
    return {
      ready: true,
      occurredAt: dueDate,
      units: investmentAmount,
      price: new Decimal(1),
      amount: investmentAmount,
    };
  }

  if (holding.type === "MUTUAL_FUND") {
    const navTargetDate = nextMarketBusinessDay(dueDate);
    const nav = await fetchMFNavForDate(holding.symbol, navTargetDate);
    if (!nav || nav.navDate > startOfDay(now)) return { ready: false };
    const price = new Decimal(nav.nav);
    if (price.lte(0)) return { ready: false };
    return {
      ready: true,
      occurredAt: nav.navDate,
      units: investmentAmount.div(price).toDecimalPlaces(6),
      price: price.toDecimalPlaces(4),
      amount: investmentAmount,
    };
  }

  const fallbackPrice = new Decimal((holding.currentPrice ?? holding.avgBuyPrice).toString());
  if (fallbackPrice.lte(0)) return { ready: false };
  return {
    ready: true,
    occurredAt: nextMarketBusinessDay(dueDate),
    units: investmentAmount.div(fallbackPrice).toDecimalPlaces(6),
    price: fallbackPrice.toDecimalPlaces(4),
    amount: investmentAmount,
  };
}

async function applyRecurringInvestmentBuy(
  holdingId: string,
  plan: { occurredAt: Date; units: Decimal; price: Decimal; amount: Decimal },
  transactionId: string
) {
  const holding = await prisma.holding.findUnique({ where: { id: holdingId } });
  if (!holding || holding.archived) return;

  if (holding.type === "PROVIDENT_FUND") {
    const currentValue = new Decimal(holding.units.toString()).mul(holding.avgBuyPrice.toString());
    const nextValue = currentValue.plus(plan.amount);
    await prisma.$transaction([
      prisma.trade.create({
        data: {
          holdingId,
          action: "SIP_BUY",
          units: "1.000000",
          price: plan.amount.toFixed(4),
          amount: plan.amount.toFixed(2),
          netAmount: plan.amount.toFixed(2),
          occurredAt: plan.occurredAt,
          transactionId,
          notes: "Recurring PF contribution",
        },
      }),
      prisma.holding.update({
        where: { id: holdingId },
        data: {
          units: "1.000000",
          avgBuyPrice: nextValue.toFixed(4),
          currentPrice: nextValue.toFixed(4),
          lastPriceUpdate: plan.occurredAt,
        },
      }),
    ]);
    return;
  }

  const currentUnits = new Decimal(holding.units.toString());
  const currentAvg = new Decimal(holding.avgBuyPrice.toString());
  const nextUnits = currentUnits.plus(plan.units);
  const nextAvg = nextUnits.isZero()
    ? plan.price
    : currentUnits.mul(currentAvg).plus(plan.amount).div(nextUnits);

  await prisma.$transaction([
    prisma.trade.create({
      data: {
        holdingId,
        action: "SIP_BUY",
        units: plan.units.toFixed(6),
        price: plan.price.toFixed(4),
        amount: plan.amount.toFixed(2),
        netAmount: plan.amount.toFixed(2),
        occurredAt: plan.occurredAt,
        transactionId,
      },
    }),
    prisma.holding.update({
      where: { id: holdingId },
      data: {
        units: nextUnits.toFixed(6),
        avgBuyPrice: nextAvg.toFixed(4),
        currentPrice: plan.price.toFixed(4),
        lastPriceUpdate: plan.occurredAt,
      },
    }),
  ]);
}

async function reconcileUnlinkedRecurringInvestmentTransactions(now: Date) {
  const txns = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      recurringRuleId: { not: null },
      trade: null,
      occurredAt: { lte: now },
    },
    include: {
      recurringRule: { include: { sipHoldings: true } },
    },
    orderBy: { occurredAt: "asc" },
    take: 50,
  });

  for (const txn of txns) {
    if (!txn.recurringRule) continue;
    const holding = await findRecurringInvestmentHolding(txn.recurringRule);
    if (!holding) continue;
    const plan = await buildRecurringInvestmentPlan(holding, txn.amount.toString(), txn.occurredAt, now);
    if (!plan.ready) {
      await prisma.transaction.delete({ where: { id: txn.id } });
      if (txn.recurringRule.nextRunDate > txn.occurredAt) {
        await prisma.recurringRule.update({
          where: { id: txn.recurringRule.id },
          data: { nextRunDate: txn.occurredAt },
        });
      }
      continue;
    }
    if (holding.assetClass === "RECURRING_DEPOSIT") {
      await applyRecurringDepositInstallment(holding.id, txn.amount.toString(), txn.occurredAt, txn.id);
    } else {
      await prisma.transaction.update({
        where: { id: txn.id },
        data: { occurredAt: plan.occurredAt },
      });
      await applyRecurringInvestmentBuy(holding.id, plan, txn.id);
    }
  }
}

function nextMarketBusinessDay(date: Date) {
  let cursor = startOfDay(date);
  while (cursor.getDay() === 0 || cursor.getDay() === 6) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
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
