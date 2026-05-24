import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createRecurringRule } from "@/lib/services/recurring";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rules = await prisma.recurringRule.findMany({
      orderBy: { nextRunDate: "asc" },
      include: { account: true, toAccount: true, category: true, sipHoldings: true },
    });
    return ok(serialize(rules));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rule = await createRecurringRule(body);
    return ok(serialize(rule), 201);
  } catch (e) {
    return handleError(e);
  }
}
