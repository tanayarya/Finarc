import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getMarketAlertSettings, updateMarketAlertSettings } from "@/lib/services/market-alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getMarketAlertSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    return ok(await updateMarketAlertSettings(await req.json()));
  } catch (e) {
    return handleError(e);
  }
}
