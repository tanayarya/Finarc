import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { deleteSetting, getSetting, setSetting, verifyTotp } from "@/lib/services/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const limited = checkRateLimit(`auth:totp-enable:${getClientIp(req)}`, { limit: 10, windowMs: 10 * 60 * 1000 });
    if (!limited.ok) return fail("Too many attempts. Try again in a few minutes.", 429);

    const { code } = await req.json();
    const secret = await getSetting("authTotpPendingSecret");
    if (!secret) return fail("Start authenticator setup first", 400);
    if (!verifyTotp(code, secret)) return fail("Incorrect authenticator code", 401);

    await setSetting("authTotpSecret", secret);
    await deleteSetting("authTotpPendingSecret");
    return ok({ enabled: true });
  } catch (e) {
    return handleError(e);
  }
}
