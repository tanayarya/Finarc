import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { rangeForKind, type DateRangeKind } from "@/lib/finance/dates";
import {
  totalsForRange,
  incomeExpenseSeries,
  categoryBreakdown,
} from "@/lib/finance/analytics";
import { prisma } from "@/lib/prisma";
import { computeBudgetProgress } from "@/lib/finance/budgets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = (sp.get("kind") ?? "MONTH") as DateRangeKind;
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const range = rangeForKind(kind, {
      from: fromStr ? new Date(fromStr) : undefined,
      to: toStr ? new Date(toStr) : undefined,
    });

    const [totals, series, byCategory, budgets, byAccount] = await Promise.all([
      totalsForRange(range),
      incomeExpenseSeries(range),
      categoryBreakdown(range),
      computeBudgetProgress(),
      prisma.transaction.groupBy({
        by: ["accountId", "type"],
        _sum: { amount: true },
        where: { occurredAt: { gte: range.from, lte: range.to }, accountId: { not: null } },
      }),
    ]);

    const accounts = await prisma.account.findMany({ where: { archived: false } });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const accountPerformance = Array.from(
      byAccount.reduce<Map<string, { income: number; expense: number }>>((acc, row) => {
        const id = row.accountId!;
        const cur = acc.get(id) ?? { income: 0, expense: 0 };
        if (row.type === "INCOME") cur.income += Number(row._sum.amount ?? 0);
        if (row.type === "EXPENSE") cur.expense += Number(row._sum.amount ?? 0);
        acc.set(id, cur);
        return acc;
      }, new Map())
    ).map(([id, v]) => {
      const a = accountMap.get(id);
      return {
        id,
        name: a?.name ?? "Unknown",
        type: a?.type ?? "SAVINGS",
        income: round(v.income),
        expense: round(v.expense),
        net: round(v.income - v.expense),
      };
    });

    return ok({
      range: { kind: range.kind, from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      totals: {
        income: totals.income.toFixed(2),
        expense: totals.expense.toFixed(2),
        net: totals.net.toFixed(2),
        savingsRate: totals.savingsRate,
      },
      series,
      categoryBreakdown: byCategory,
      accountPerformance,
      budgets: budgets.map((p) => ({
        id: p.budget.id,
        name: p.budget.name,
        period: p.budget.period,
        category: p.budget.category.name,
        allocated: p.allocated.toFixed(2),
        spent: p.spent.toFixed(2),
        remaining: p.remaining.toFixed(2),
        usage: p.usage,
        status: p.status,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

function round(n: number, dp = 2) {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}
