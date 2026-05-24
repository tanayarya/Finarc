import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getPortfolioSummary, buyInvestment } from "@/lib/services/investments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getPortfolioSummary();
    return ok(summary);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await buyInvestment({
      type: body.type,
      symbol: body.symbol,
      name: body.name,
      units: Number(body.units),
      pricePerUnit: Number(body.pricePerUnit),
      occurredAt: new Date(body.occurredAt),
      accountId: body.accountId,
      notes: body.notes,
      interestRate: body.interestRate ? Number(body.interestRate) : undefined,
      interestFreq: body.interestFreq,
      maturityDate: body.maturityDate ? new Date(body.maturityDate) : undefined,
      applyCharges: body.applyCharges,
      assetClass: body.assetClass,
      skipTransaction: body.skipTransaction ?? false,
      skipTrade: body.skipTrade ?? false,
    });
    return ok({
      holdingId: result.holding.id,
      tradeId: result.trade?.id ?? null,
      charges: result.charges,
    }, 201);
  } catch (e) {
    return handleError(e);
  }
}
