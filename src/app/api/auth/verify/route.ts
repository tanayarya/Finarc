import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { AUTH_SESSION_COOKIE, authCookieOptions, createAuthSessionCookie } from "@/lib/auth-session";
import { getSetting, verifyPin, verifyTotp } from "@/lib/services/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const limited = checkRateLimit(`auth:verify:${getClientIp(req)}`, { limit: 12, windowMs: 5 * 60 * 1000 });
    if (!limited.ok) return fail("Too many attempts. Try again in a few minutes.", 429);

    const { method = "pin", pin, code } = await req.json();

    if (method === "totp") {
      const secret = await getSetting("authTotpSecret");
      if (!secret) return fail("Authenticator app is not configured", 400);
      if (verifyTotp(code, secret)) return withAuthCookie(ok({ authenticated: true, method: "totp" }), "totp", req);
      return fail("Incorrect authenticator code", 401);
    }

    if (await verifyPin(pin)) return withAuthCookie(ok({ authenticated: true, method: "pin" }), "pin", req);
    return fail("Incorrect PIN", 401);
  } catch (e) {
    return handleError(e);
  }
}

async function withAuthCookie(response: ReturnType<typeof ok>, method: "pin" | "totp", req: NextRequest) {
  response.cookies.set(AUTH_SESSION_COOKIE, await createAuthSessionCookie(method), authCookieOptions(req));
  return response;
}
