import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { AUTH_SESSION_COOKIE, verifyAuthSessionCookie } from "@/lib/auth-session";
import { getAuthConfig } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const config = await getAuthConfig();
    const session = await verifyAuthSessionCookie(req.cookies.get(AUTH_SESSION_COOKIE)?.value);
    if (session) return ok(config);

    return ok({
      authPrimaryMethod: config.authPrimaryMethod,
      pinEnabled: config.pinEnabled,
      totpEnabled: config.totpEnabled,
      webAuthnEnabled: config.webAuthnEnabled,
      webAuthnCredentials: [],
    });
  } catch (e) {
    return handleError(e);
  }
}
