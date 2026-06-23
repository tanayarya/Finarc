import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getIpoAlertSettings, updateIpoAlertSettings } from "@/lib/services/ipo-alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getIpoAlertSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    return ok(await updateIpoAlertSettings(await req.json()));
  } catch (e) {
    return handleError(e);
  }
}
