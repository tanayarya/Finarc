import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_PIN = "123456";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface StoredWebAuthnCredential {
  id: string;
  name: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface AuthConfig {
  authPrimaryMethod: AuthPrimaryMethod;
  pinEnabled: boolean;
  totpEnabled: boolean;
  webAuthnEnabled: boolean;
  webAuthnCredentials: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string }>;
}

export type AuthPrimaryMethod = "pin" | "totp";

export async function getSetting(key: string) {
  return (await prisma.appSetting.findUnique({ where: { key } }))?.value;
}

export async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function deleteSetting(key: string) {
  await prisma.appSetting.deleteMany({ where: { key } });
}

export async function verifyPin(pin: unknown) {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) return false;
  const storedPin = (await getSetting("pin")) ?? DEFAULT_PIN;
  return safeEqual(pin, storedPin);
}

export async function setPin(pin: string) {
  await setSetting("pin", pin);
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const [totpSecret, credentials, savedPrimaryMethod] = await Promise.all([
    getSetting("authTotpSecret"),
    getWebAuthnCredentials(),
    getSetting("authPrimaryMethod"),
  ]);
  const totpEnabled = Boolean(totpSecret);
  const authPrimaryMethod: AuthPrimaryMethod = savedPrimaryMethod === "totp" && totpEnabled ? "totp" : "pin";

  return {
    authPrimaryMethod,
    pinEnabled: true,
    totpEnabled,
    webAuthnEnabled: credentials.length > 0,
    webAuthnCredentials: credentials.map(({ id, name, createdAt, lastUsedAt }) => ({ id, name, createdAt, lastUsedAt })),
  };
}

export async function setAuthPrimaryMethod(method: AuthPrimaryMethod) {
  if (method === "totp" && !(await getSetting("authTotpSecret"))) {
    throw new Error("Set up authenticator app before using it as the unlock method");
  }
  await setSetting("authPrimaryMethod", method);
}

export function generateTotpSecret() {
  return toBase32(randomBytes(20));
}

export function getTotpUri(secret: string) {
  const label = encodeURIComponent("Finarc");
  const issuer = encodeURIComponent("Finarc");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(code: unknown, secret: string) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 1000 / 30);
  return [-1, 0, 1].some((offset) => safeEqual(code, totp(secret, now + offset)));
}

export async function getWebAuthnCredentials(): Promise<StoredWebAuthnCredential[]> {
  const raw = await getSetting("authWebAuthnCredentials");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredWebAuthnCredential) : [];
  } catch {
    return [];
  }
}

export async function saveWebAuthnCredentials(credentials: StoredWebAuthnCredential[]) {
  await setSetting("authWebAuthnCredentials", JSON.stringify(credentials));
}

export function getWebAuthnRequestContext(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host") || "localhost:3000";
  const hostname = host.split(":")[0] || "localhost";
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https");
  const origin = req.headers.get("origin") || `${proto}://${host}`;

  return {
    rpID: hostname,
    origin,
  };
}

export function publicKeyToBase64Url(publicKey: Uint8Array) {
  return Buffer.from(publicKey).toString("base64url");
}

export function publicKeyFromBase64Url(publicKey: string) {
  return Buffer.from(publicKey, "base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function totp(secret: string, counter: number) {
  const key = fromBase32(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function toBase32(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(input: string) {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid TOTP secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function isStoredWebAuthnCredential(value: unknown): value is StoredWebAuthnCredential {
  if (!value || typeof value !== "object") return false;
  const credential = value as Partial<StoredWebAuthnCredential>;
  return (
    typeof credential.id === "string" &&
    typeof credential.name === "string" &&
    typeof credential.publicKey === "string" &&
    typeof credential.counter === "number" &&
    typeof credential.createdAt === "string"
  );
}
