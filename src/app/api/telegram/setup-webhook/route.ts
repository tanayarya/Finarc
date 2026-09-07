import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getTelegramWebhookSecret } from "@/lib/machine-auth";

export const dynamic = "force-dynamic";

/**
 * Register the Telegram webhook.
 * Call this after configuring bot token and deploying.
 * Body: { webhookUrl: "https://your-domain.com/api/telegram/webhook" }
 */
export async function POST(req: NextRequest) {
  try {
    const { webhookUrl } = await req.json();
    if (!webhookUrl) return fail("webhookUrl required", 400);

    const botToken = (await prisma.appSetting.findUnique({ where: { key: "telegramBotToken" } }))?.value;
    if (!botToken) return fail("Bot token not configured", 400);

    const secretToken = getTelegramWebhookSecret();
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, ...(secretToken ? { secret_token: secretToken } : {}) }),
    });

    const data = await res.json();
    if (!data.ok) return fail(data.description ?? "Failed to set webhook", 400);

    // Save webhook URL
    await prisma.appSetting.upsert({
      where: { key: "telegramWebhookUrl" },
      update: { value: webhookUrl },
      create: { key: "telegramWebhookUrl", value: webhookUrl },
    });

    return ok({ success: true, description: data.description });
  } catch (e) {
    return handleError(e);
  }
}
