import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const botToken = (await prisma.appSetting.findUnique({ where: { key: "telegramBotToken" } }))?.value ?? "";
    const chatId = (await prisma.appSetting.findUnique({ where: { key: "telegramChatId" } }))?.value ?? "";
    const notifyCredit = (await prisma.appSetting.findUnique({ where: { key: "notifyCreditDue" } }))?.value === "true";
    const notifyBudget = (await prisma.appSetting.findUnique({ where: { key: "notifyBudgetExceeded" } }))?.value === "true";
    const notifyRecurring = (await prisma.appSetting.findUnique({ where: { key: "notifyRecurringDue" } }))?.value === "true";
    const notifyLowBalance = (await prisma.appSetting.findUnique({ where: { key: "notifyLowBalance" } }))?.value === "true";
    const botInput = (await prisma.appSetting.findUnique({ where: { key: "telegramBotInput" } }))?.value === "true";
    const webhookUrl = (await prisma.appSetting.findUnique({ where: { key: "telegramWebhookUrl" } }))?.value ?? "";

    return ok({
      botToken: botToken ? "••••" + botToken.slice(-6) : "",
      chatId,
      configured: Boolean(botToken && chatId),
      webhookUrl,
      notifications: { creditDue: notifyCredit, budgetExceeded: notifyBudget, recurringDue: notifyRecurring, lowBalance: notifyLowBalance, botInput },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.botToken !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "telegramBotToken" },
        update: { value: body.botToken },
        create: { key: "telegramBotToken", value: body.botToken },
      });
    }
    if (body.chatId !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "telegramChatId" },
        update: { value: body.chatId },
        create: { key: "telegramChatId", value: body.chatId },
      });
    }
    if (body.notifyCreditDue !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "notifyCreditDue" },
        update: { value: String(body.notifyCreditDue) },
        create: { key: "notifyCreditDue", value: String(body.notifyCreditDue) },
      });
    }
    if (body.notifyBudgetExceeded !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "notifyBudgetExceeded" },
        update: { value: String(body.notifyBudgetExceeded) },
        create: { key: "notifyBudgetExceeded", value: String(body.notifyBudgetExceeded) },
      });
    }
    if (body.notifyRecurring !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "notifyRecurringDue" },
        update: { value: String(body.notifyRecurring) },
        create: { key: "notifyRecurringDue", value: String(body.notifyRecurring) },
      });
    }
    if (body.notifyLowBalance !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "notifyLowBalance" },
        update: { value: String(body.notifyLowBalance) },
        create: { key: "notifyLowBalance", value: String(body.notifyLowBalance) },
      });
    }
    if (body.telegramBotInput !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "telegramBotInput" },
        update: { value: String(body.telegramBotInput) },
        create: { key: "telegramBotInput", value: String(body.telegramBotInput) },
      });
    }

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
