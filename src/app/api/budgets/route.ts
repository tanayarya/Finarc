import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { createBudget } from "@/lib/services/budgets";
import { computeBudgetProgress } from "@/lib/finance/budgets";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const progress = await computeBudgetProgress();
    return ok(
      progress.map((p) => ({
        ...serialize(p.budget),
        category: serialize(p.budget.category),
        allocated: p.allocated.toFixed(2),
        spent: p.spent.toFixed(2),
        remaining: p.remaining.toFixed(2),
        usage: p.usage,
        status: p.status,
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
      }))
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const budget = await createBudget(body);
    return ok(serialize(budget), 201);
  } catch (e) {
    return handleError(e);
  }
}
