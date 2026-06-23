import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { runIpoAlerts } from "@/lib/services/ipo-alerts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    return ok(await runIpoAlerts({ force: sp.get("force") === "1", send: sp.get("send") === "1" }));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return ok(await runIpoAlerts({ force: Boolean(body.force), send: Boolean(body.send) }));
  } catch (e) {
    return handleError(e);
  }
}
