import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { setPin, verifyPin } from "@/lib/services/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const limited = checkRateLimit(`auth:reset-pin:${getClientIp(req)}`, { limit: 8, windowMs: 10 * 60 * 1000 });
    if (!limited.ok) return fail("Too many attempts. Try again in a few minutes.", 429);

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
