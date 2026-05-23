import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { occurrencesBetween } from "@/lib/finance/recurring";
import { addMonths } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ruleId = req.nextUrl.searchParams.get("ruleId");
    const months = parseInt(req.nextUrl.searchParams.get("months") ?? "3", 10);
    const from = new Date();
    const to = addMonths(from, months);

    if (ruleId) {
      const rule = await prisma.recurringRule.findUnique({ where: { id: ruleId } });
      if (!rule) return ok([]);
      const dates = occurrencesBetween(rule, from, to);
      return ok(dates.map((d) => ({
        ruleId: rule.id,
        name: rule.name,
        type: rule.type,
        amount: rule.amount.toString(),
        date: d.toISOString(),
      })));
    }

    // All rules
    const rules = await prisma.recurringRule.findMany({ where: { status: "ACTIVE" } });
    const items: Array<{ ruleId: string; name: string; type: string; amount: string; date: string }> = [];
    for (const rule of rules) {
      const dates = occurrencesBetween(rule, from, to);
      for (const d of dates) {
        items.push({
          ruleId: rule.id,
          name: rule.name,
          type: rule.type,
          amount: rule.amount.toString(),
          date: d.toISOString(),
        });
      }
    }
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}
