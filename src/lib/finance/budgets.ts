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

  if (budgets.length === 0) return [];

  const windows = budgets.map((budget) => ({
    budget,
    ...periodWindow(budget.period, anchor),
  }));
  const rangeStart = windows.reduce((earliest, window) =>
    window.start < earliest ? window.start : earliest,
  windows[0].start);
  const rangeEnd = windows.reduce((latest, window) =>
    window.end > latest ? window.end : latest,
  windows[0].end);

  // Fetch the needed expense rows once. The former per-budget query pattern
  // becomes noticeably slow across a remote serverless database connection.
  const expenses = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      categoryId: { in: budgets.map((budget) => budget.categoryId) },
      occurredAt: { gte: rangeStart, lte: rangeEnd },
      trade: null,
    },
    select: { amount: true, categoryId: true, occurredAt: true },
  });

  const result: BudgetProgress[] = [];
  for (const { budget, start, end } of windows) {
    const spent = expenses.reduce<Money>((total, expense) => {
      if (expense.categoryId !== budget.categoryId || expense.occurredAt < start || expense.occurredAt > end) return total;
      return add(total, expense.amount);
    }, ZERO);
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
