import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { runMarketAlerts } from "@/lib/services/market-alerts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const force = sp.get("force") === "1";
    const send = sp.get("send") === "1";
    return ok(await runMarketAlerts({ force, send }));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return ok(await runMarketAlerts({ force: Boolean(body.force), send: Boolean(body.send) }));
  } catch (e) {
    return handleError(e);
  }
}
