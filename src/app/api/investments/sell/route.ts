import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { sellInvestment } from "@/lib/services/investments";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await sellInvestment({
      holdingId: body.holdingId,
      units: Number(body.units),
      pricePerUnit: Number(body.pricePerUnit),
      occurredAt: new Date(body.occurredAt),
      notes: body.notes,
      applyCharges: body.applyCharges,
    });
    return ok({
      holdingId: result.holding?.id,
      tradeId: result.trade.id,
      charges: result.charges,
    });
  } catch (e) {
    return handleError(e);
  }
}
