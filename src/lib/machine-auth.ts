import { timingSafeEqual } from "crypto";

export function getCronSecret() {
  return process.env.FINARC_CRON_SECRET || process.env.CRON_SECRET || "";
}

export function getTelegramWebhookSecret() {
  return process.env.FINARC_TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "";
}

export function hasValidCronSecret(req: Request) {
  const secret = getCronSecret();
  if (!secret) return true;

  const url = new URL(req.url);
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7) : "";
  const supplied = bearer || req.headers.get("x-finarc-cron-secret") || url.searchParams.get("secret") || "";
  return safeEqual(supplied, secret);
}

export function hasValidTelegramWebhookSecret(req: Request) {
  const secret = getTelegramWebhookSecret();
  if (!secret) return true;
  return safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", secret);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
