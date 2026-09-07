export const AUTH_SESSION_COOKIE = "finarc_session";

const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface AuthSession {
  method: "pin" | "totp" | "webauthn";
  iat: number;
  exp: number;
  nonce: string;
}

export async function createAuthSessionCookie(method: AuthSession["method"]) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthSession = {
    method,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: randomId(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifyAuthSessionCookie(cookie: string | undefined | null): Promise<AuthSession | null> {
  if (!cookie) return null;
  const [encodedPayload, signature] = cookie.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = await sign(encodedPayload);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthSession;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!["pin", "totp", "webauthn"].includes(payload.method)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authCookieOptions(req?: Request) {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function expiredAuthCookieOptions(req?: Request) {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  };
}

function isSecureRequest(req?: Request) {
  if (!req) return process.env.NODE_ENV === "production";
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";

  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function getSecret() {
  return (
    process.env.FINARC_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    "finarc-local-development-secret"
  );
}

async function sign(payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function base64UrlEncode(input: string) {
  const bytes = new TextEncoder().encode(input);
  return bytesToBase64Url(bytes);
}

function base64UrlDecode(input: string) {
  const binary = atob(input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
