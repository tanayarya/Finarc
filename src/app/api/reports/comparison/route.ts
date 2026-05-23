import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { rangeForKind, previousRange, type DateRangeKind } from "@/lib/finance/dates";
import { totalsForRange, categoryBreakdown } from "@/lib/finance/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = (sp.get("kind") ?? "MONTH") as DateRangeKind;
    const range = rangeForKind(kind);
    const prev = previousRange(range);

    const [current, previous, currentCats, prevCats] = await Promise.all([
      totalsForRange(range),
      totalsForRange(prev),
      categoryBreakdown(range),
      categoryBreakdown(prev),
    ]);

    return ok({
      current: {
        label: range.label,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        income: current.income.toFixed(2),
        expense: current.expense.toFixed(2),
        net: current.net.toFixed(2),
        savingsRate: current.savingsRate,
        categories: currentCats,
      },
      previous: {
        label: prev.label,
        from: prev.from.toISOString(),
        to: prev.to.toISOString(),
        income: previous.income.toFixed(2),
        expense: previous.expense.toFixed(2),
        net: previous.net.toFixed(2),
        savingsRate: previous.savingsRate,
        categories: prevCats,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
