import { prisma } from "@/lib/prisma";
import { add, ratio, sub, toMoney, ZERO, type Money } from "@/lib/money";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import type { Budget, Category, BudgetPeriod } from "@prisma/client";

export type BudgetStatus = "HEALTHY" | "NEAR_LIMIT" | "OVER_BUDGET";

export interface BudgetProgress {
  budget: Budget & { category: Category };
  allocated: Money;
  spent: Money;
  remaining: Money;
  usage: number; // 0..>1
  status: BudgetStatus;
  periodStart: Date;
  periodEnd: Date;
}

export function periodWindow(period: BudgetPeriod, anchor: Date = new Date()) {
  switch (period) {
    case "WEEKLY":
      return {
        start: startOfWeek(anchor, { weekStartsOn: 1 }),
        end: endOfWeek(anchor, { weekStartsOn: 1 }),
      };
    case "MONTHLY":
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case "YEARLY":
      return { start: startOfYear(anchor), end: endOfYear(anchor) };
  }
}

export function classifyStatus(usage: number): BudgetStatus {
  if (usage >= 1) return "OVER_BUDGET";
  if (usage >= 0.8) return "NEAR_LIMIT";
  return "HEALTHY";
}

export async function computeBudgetProgress(
  anchor: Date = new Date()
): Promise<BudgetProgress[]> {
  const budgets = await prisma.budget.findMany({
    where: { archived: false },
    include: { category: true },
  });

  const result: BudgetProgress[] = [];
  for (const budget of budgets) {
    const { start, end } = periodWindow(budget.period, anchor);
    const txns = await prisma.transaction.findMany({
      where: {
        type: "EXPENSE",
        categoryId: budget.categoryId,
        occurredAt: { gte: start, lte: end },
      },
      select: { amount: true },
    });
    const spent = txns.reduce<Money>((acc, t) => add(acc, t.amount), ZERO);
    const allocated = toMoney(budget.amount);
    const remaining = sub(allocated, spent);
    const usage = ratio(spent, allocated);
    result.push({
      budget,
      allocated,
      spent,
      remaining,
      usage,
      status: classifyStatus(usage),
      periodStart: start,
      periodEnd: end,
    });
  }
  return result;
}
