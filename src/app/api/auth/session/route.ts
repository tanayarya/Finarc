import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { AUTH_SESSION_COOKIE, verifyAuthSessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifyAuthSessionCookie(req.cookies.get(AUTH_SESSION_COOKIE)?.value);
  return ok({ authenticated: Boolean(session), method: session?.method ?? null, expiresAt: session?.exp ?? null });
}
