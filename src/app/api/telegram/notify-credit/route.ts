import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { computeAccountBalance } from "@/lib/finance/balances";
import { daysUntilCreditDue, nextCreditDueDate } from "@/lib/finance/credit-cards";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const botToken = (await prisma.appSetting.findUnique({ where: { key: "telegramBotToken" } }))?.value;
    const chatId = (await prisma.appSetting.findUnique({ where: { key: "telegramChatId" } }))?.value;
    const enabled = (await prisma.appSetting.findUnique({ where: { key: "notifyCreditDue" } }))?.value === "true";

    if (!botToken || !chatId) return fail("Telegram not configured", 400);
    if (!enabled) return ok({ skipped: true, reason: "Credit notifications disabled" });

    const creditAccounts = await prisma.account.findMany({
      where: { archived: false, type: "CREDIT", dueDay: { not: null } },
    });

    if (creditAccounts.length === 0) return ok({ sent: 0 });

    const today = new Date();
    const notifications: string[] = [];

    for (const account of creditAccounts) {
      if (!account.dueDay) continue;
      const daysUntilDue = daysUntilCreditDue(account.dueDay, today);

      if (daysUntilDue <= 5) {
        const balance = await computeAccountBalance(account.id);
        if (balance.lte(0)) continue;
        const balanceStr = balance.toFixed(2);
        const dueDate = nextCreditDueDate(account.dueDay, today);

        notifications.push(
          `Credit Card: ${account.name}\n` +
          `Due Amount: ${balanceStr}\n` +
          `Due Date: ${format(dueDate, "MMM d, yyyy")}\n` +
          `Days Remaining: ${daysUntilDue}\n` +
          `Status: ${daysUntilDue === 0 ? "DUE TODAY" : daysUntilDue <= 2 ? "URGENT" : "UPCOMING"}`
        );
      }
    }

    if (notifications.length === 0) return ok({ sent: 0, message: "No cards due within 5 days" });

    const message = `Finarc - Credit Card Due Reminder\n\n${notifications.join("\n\n---\n\n")}`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return fail(err?.description ?? "Telegram send failed", 500);
    }

    return ok({ sent: notifications.length });
  } catch (e) {
    return handleError(e);
  }
}
