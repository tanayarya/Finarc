import { ok } from "@/lib/api";
import { AUTH_SESSION_COOKIE, expiredAuthCookieOptions } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const res = ok({ authenticated: false });
  res.cookies.set(AUTH_SESSION_COOKIE, "", expiredAuthCookieOptions(req));
  return res;
}
