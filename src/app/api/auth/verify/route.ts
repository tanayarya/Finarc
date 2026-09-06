import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { getSetting, verifyPin, verifyTotp } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { method = "pin", pin, code } = await req.json();

    if (method === "totp") {
      const secret = await getSetting("authTotpSecret");
      if (!secret) return fail("Authenticator app is not configured", 400);
      if (verifyTotp(code, secret)) return ok({ authenticated: true, method: "totp" });
      return fail("Incorrect authenticator code", 401);
    }

    if (await verifyPin(pin)) return ok({ authenticated: true, method: "pin" });
    return fail("Incorrect PIN", 401);
  } catch (e) {
    return handleError(e);
  }
}
