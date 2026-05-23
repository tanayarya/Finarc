import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const botToken = (await prisma.appSetting.findUnique({ where: { key: "telegramBotToken" } }))?.value;
    const chatId = (await prisma.appSetting.findUnique({ where: { key: "telegramChatId" } }))?.value;

    if (!botToken || !chatId) {
      return fail("Configure Bot Token and Chat ID first", 400);
    }

    const message = `Finarc Test\n\nThis is a test notification from your Finarc finance hub. If you see this, notifications are configured correctly.`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return fail(err?.description ?? "Telegram API error", 400);
    }

    return ok({ sent: true });
  } catch (e) {
    return handleError(e);
  }
}
