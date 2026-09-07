import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE, verifyAuthSessionCookie } from "@/lib/auth-session";

const PUBLIC_API_PATHS = new Set([
  "/api/auth/config",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/verify",
  "/api/auth/webauthn/authentication-options",
  "/api/auth/webauthn/authenticate",
  "/api/cron/notify",
  "/api/telegram/webhook",
]);

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (PUBLIC_API_PATHS.has(pathname)) return NextResponse.next();

  const session = await verifyAuthSessionCookie(req.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  return NextResponse.json({ error: { message: "Authentication required" } }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"],
};
