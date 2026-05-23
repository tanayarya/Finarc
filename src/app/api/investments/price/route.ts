import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Fetch current price for a symbol.
 * Query params: symbol, type (STOCK | MUTUAL_FUND | GOLD | SILVER)
 */
export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol");
    const type = req.nextUrl.searchParams.get("type") ?? "STOCK";

    if (!symbol) return fail("Symbol required", 400);

    let price: number | null = null;

    if (type === "MUTUAL_FUND") {
      const res = await fetch(`https://api.mfapi.in/mf/${symbol}/latest`);
      if (res.ok) {
        const data = await res.json();
        price = data?.data?.[0]?.nav ? parseFloat(data.data[0].nav) : null;
      }
    } else if (type === "GOLD") {
      const res = await fetch("https://api.gold-api.com/price/XAU/INR");
      if (res.ok) {
        const data = await res.json();
        price = data?.price ? Math.round((data.price / 31.1035) * 100) / 100 : null;
      }
    } else if (type === "SILVER") {
      const res = await fetch("https://api.gold-api.com/price/XAG/INR");
      if (res.ok) {
        const data = await res.json();
        price = data?.price ? Math.round((data.price / 31.1035) * 100) / 100 : null;
      }
    } else {
      // STOCK / ETF
      try {
        const { default: YahooFinance } = await import("yahoo-finance2");
        const yahooFinance = new (YahooFinance as any)();
        const quote = await yahooFinance.quote(symbol);
        price = quote?.regularMarketPrice ?? null;
      } catch {
        price = null;
      }
    }

    if (price === null) return ok({ price: null, error: "Could not fetch price" });
    return ok({ price, symbol });
  } catch (e) {
    return handleError(e);
  }
}
