import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { recordDividendOrInterest } from "@/lib/services/investments";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await recordDividendOrInterest(
      body.holdingId,
      Number(body.amount),
      new Date(body.occurredAt),
      body.notes
    );
    return ok({ tradeId: result.trade.id });
  } catch (e) {
    return handleError(e);
  }
}
