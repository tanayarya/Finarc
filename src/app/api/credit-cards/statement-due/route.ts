import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/api";
import { computeCreditStatementPaymentAmount } from "@/lib/finance/credit-cards";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const accountId = params.get("accountId");
    if (!accountId) throw new Error("Credit card account required");
    const dateParam = params.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();
    const amount = await computeCreditStatementPaymentAmount(accountId, date);
    return ok(serialize({ amount: amount.toFixed(2) }));
  } catch (e) {
    return handleError(e);
  }
}
