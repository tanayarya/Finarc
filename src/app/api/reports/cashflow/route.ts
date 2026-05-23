import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { rangeForKind, type DateRangeKind } from "@/lib/finance/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = (sp.get("kind") ?? "MONTH") as DateRangeKind;
    const range = rangeForKind(kind);

    const txns = await prisma.transaction.findMany({
      where: { occurredAt: { gte: range.from, lte: range.to } },
      select: { type: true, amount: true, category: true, account: { select: { type: true } }, trade: { select: { id: true } } },
    });
    const cashflowTxns = txns.filter((t) => !t.trade);

    // Group expenses by category for waterfall
    const incomeTotal = cashflowTxns
      .filter((t) => t.type === "INCOME" && t.account?.type !== "CREDIT")
      .reduce((s, t) => s + Number(t.amount), 0);

    const expenseByCategory = new Map<string, number>();
    for (const t of cashflowTxns) {
      if (t.type === "EXPENSE") {
        const name = t.category?.name ?? "Uncategorized";
        expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + Number(t.amount));
      }
    }

    // Build waterfall: start with income, subtract each category, end with net
    const steps: Array<{ name: string; value: number; type: "income" | "expense" | "net"; cumulative: number }> = [];
    let running = incomeTotal;
    steps.push({ name: "Income", value: incomeTotal, type: "income", cumulative: running });

    const sorted = Array.from(expenseByCategory.entries()).sort((a, b) => b[1] - a[1]);
    for (const [name, amount] of sorted) {
      running -= amount;
      steps.push({ name, value: amount, type: "expense", cumulative: running });
    }

    steps.push({ name: "Net", value: running, type: "net", cumulative: running });

    return ok(steps);
  } catch (e) {
    return handleError(e);
  }
}
