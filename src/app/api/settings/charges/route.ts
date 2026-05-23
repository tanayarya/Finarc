import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getChargeSettings, setChargeSettings } from "@/lib/services/investments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getChargeSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await setChargeSettings(body);
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
