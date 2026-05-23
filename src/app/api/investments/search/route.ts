import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Search for stocks (via yahoo-finance2) or mutual funds (via mfapi.in).
 * Query params: q (search term), type (STOCK | MUTUAL_FUND)
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const type = req.nextUrl.searchParams.get("type") ?? "STOCK";

    if (!q || q.length < 2) return ok([]);

    if (type === "MUTUAL_FUND") {
      const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return ok([]);
      const data = await res.json();
      // mfapi returns a flat array of { schemeCode, schemeName }
      const arr = Array.isArray(data) ? data : [];
      const results = arr.slice(0, 15).map((item: { schemeCode: number; schemeName: string }) => ({
        symbol: String(item.schemeCode),
        name: item.schemeName,
        type: "MUTUAL_FUND",
      }));
      return ok(results);
    }

    // Stock search via yahoo-finance2
    const { default: YahooFinance } = await import("yahoo-finance2");
    const yahooFinance = new (YahooFinance as any)();
    const searchResult = await yahooFinance.search(q, { quotesCount: 10 });
    const results = (searchResult.quotes ?? [])
      .filter((r: any) => r.isYahooFinance !== false)
      .slice(0, 10)
      .map((r: any) => ({
        symbol: r.symbol ?? "",
        name: r.shortname ?? r.longname ?? r.symbol ?? "",
        exchange: r.exchDisp ?? "",
        type: "STOCK",
      }));
    return ok(results);
  } catch (e) {
    return handleError(e);
  }
}
