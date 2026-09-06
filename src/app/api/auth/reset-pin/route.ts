import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { setPin, verifyPin } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { currentPin, newPin } = await req.json();
    if (!currentPin || !newPin) return fail("Both current and new PIN required", 400);
    if (typeof newPin !== "string" || newPin.length !== 6 || !/^\d{6}$/.test(newPin))
      return fail("PIN must be exactly 6 digits", 400);

    if (!(await verifyPin(currentPin))) return fail("Current PIN is incorrect", 401);
    await setPin(newPin);

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
