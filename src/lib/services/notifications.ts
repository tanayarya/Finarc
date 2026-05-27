import { prisma } from "@/lib/prisma";
import { computeBudgetProgress } from "@/lib/finance/budgets";
import { computeAccountBalance } from "@/lib/finance/balances";
import { daysUntilCreditDue, nextCreditDueDate } from "@/lib/finance/credit-cards";
import { addDays, format } from "date-fns";

/**
 * Sends Telegram messages for all enabled notification types.
 * Uses a "lastNotified" key per type to ensure max once per day.
 */

export async function getTelegramConfig() {
  const botToken = (await prisma.appSetting.findUnique({ where: { key: "telegramBotToken" } }))?.value;
  const chatId = (await prisma.appSetting.findUnique({ where: { key: "telegramChatId" } }))?.value;
  return { botToken, chatId, configured: Boolean(botToken && chatId) };
}

export async function sendTelegram(botToken: string, chatId: string, message: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  return res.ok;
}

async function wasNotifiedToday(key: string): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting?.value) return false;
  const lastDate = setting.value.slice(0, 10); // YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);
  return lastDate === today;
}

async function markNotified(key: string) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: new Date().toISOString() },
    create: { key, value: new Date().toISOString() },
  });
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// ─── Credit Due ────────────────────────────────────────────────────────

export async function notifyCreditDue(): Promise<{ sent: boolean; message?: string }> {
  const enabled = (await prisma.appSetting.findUnique({ where: { key: "notifyCreditDue" } }))?.value === "true";
  if (!enabled) return { sent: false, message: "Disabled" };

  if (await wasNotifiedToday("lastNotify_creditDue")) return { sent: false, message: "Already notified today" };

  const { botToken, chatId, configured } = await getTelegramConfig();
  if (!configured) return { sent: false, message: "Telegram not configured" };

  const creditAccounts = await prisma.account.findMany({
    where: { archived: false, type: "CREDIT", dueDay: { not: null } },
  });

  const today = new Date();
  const notifications: string[] = [];

  for (const account of creditAccounts) {
    if (!account.dueDay) continue;
    const daysUntilDue = daysUntilCreditDue(account.dueDay, today);

    if (daysUntilDue <= 5) {
      const balance = await computeAccountBalance(account.id);
      if (balance.lte(0)) continue;
      const dueDate = nextCreditDueDate(account.dueDay, today);
      notifications.push(
        `Card: ${account.name}\n` +
        `Due Amount: ${balance.toFixed(2)}\n` +
        `Due Date: ${format(dueDate, "MMM d, yyyy")}\n` +
        `Days Left: ${daysUntilDue}\n` +
        `Status: ${daysUntilDue === 0 ? "DUE TODAY" : daysUntilDue <= 2 ? "URGENT" : "UPCOMING"}`
      );
    }
  }

  if (notifications.length === 0) return { sent: false, message: "No cards due within 5 days" };

  const message = `Finarc - Credit Card Reminder\n\n${notifications.join("\n\n---\n\n")}`;
  const sent = await sendTelegram(botToken!, chatId!, message);
  if (sent) await markNotified("lastNotify_creditDue");
  return { sent };
}

// ─── Budget Exceeded ───────────────────────────────────────────────────

export async function notifyBudgetExceeded(): Promise<{ sent: boolean; message?: string }> {
  const enabled = (await prisma.appSetting.findUnique({ where: { key: "notifyBudgetExceeded" } }))?.value === "true";
  if (!enabled) return { sent: false, message: "Disabled" };

  const { botToken, chatId, configured } = await getTelegramConfig();
  if (!configured) return { sent: false, message: "Telegram not configured" };

  const progress = await computeBudgetProgress();
  const overBudget = progress.filter((p) => p.status === "OVER_BUDGET");
  const nearLimit = progress.filter((p) => p.status === "NEAR_LIMIT");

  if (overBudget.length === 0 && nearLimit.length === 0) return { sent: false, message: "All budgets healthy" };

  const sentMarkers = parseJsonArray((await prisma.appSetting.findUnique({ where: { key: "budgetAlertSentMarkers" } }))?.value);
  const sentMarkerSet = new Set(sentMarkers);
  const candidates = [...overBudget, ...nearLimit].filter((b) => !sentMarkerSet.has(budgetAlertMarker(b)));

  if (candidates.length === 0) return { sent: false, message: "Already notified for this budget period" };

  const lines: string[] = [];
  for (const b of candidates.filter((p) => p.status === "OVER_BUDGET")) {
    lines.push(
      `OVER BUDGET: ${b.budget.name}\n` +
      `Category: ${b.budget.category.name}\n` +
      `Spent: ${b.spent.toFixed(2)} / ${b.allocated.toFixed(2)}\n` +
      `Over by: ${b.spent.minus(b.allocated).toFixed(2)}`
    );
  }
  for (const b of candidates.filter((p) => p.status === "NEAR_LIMIT")) {
    lines.push(
      `NEAR LIMIT: ${b.budget.name}\n` +
      `Category: ${b.budget.category.name}\n` +
      `Spent: ${b.spent.toFixed(2)} / ${b.allocated.toFixed(2)}\n` +
      `Remaining: ${b.remaining.toFixed(2)}`
    );
  }

  const message = `Finarc - Budget Alert\n\n${lines.join("\n\n---\n\n")}`;
  const sent = await sendTelegram(botToken!, chatId!, message);
  if (sent) {
    const nextMarkers = Array.from(new Set([...sentMarkers, ...candidates.map(budgetAlertMarker)])).slice(-500);
    await setSetting("budgetAlertSentMarkers", JSON.stringify(nextMarkers));
    await markNotified("lastNotify_budgetExceeded");
  }
  return { sent };
}

function budgetAlertMarker(progress: Awaited<ReturnType<typeof computeBudgetProgress>>[number]) {
  return [
    progress.budget.id,
    progress.budget.period,
    progress.status,
    progress.periodStart.toISOString().slice(0, 10),
  ].join(":");
}

// ─── Recurring Due ─────────────────────────────────────────────────────

export async function notifyRecurringDue(): Promise<{ sent: boolean; message?: string }> {
  const enabled = (await prisma.appSetting.findUnique({ where: { key: "notifyRecurringDue" } }))?.value === "true";
  if (!enabled) return { sent: false, message: "Disabled" };

  if (await wasNotifiedToday("lastNotify_recurringDue")) return { sent: false, message: "Already notified today" };

  const { botToken, chatId, configured } = await getTelegramConfig();
  if (!configured) return { sent: false, message: "Telegram not configured" };

  const tomorrow = addDays(new Date(), 1);
  const dayAfter = addDays(new Date(), 2);

  const rules = await prisma.recurringRule.findMany({
    where: {
      status: "ACTIVE",
      nextRunDate: { gte: new Date(), lte: dayAfter },
    },
    include: { account: true, sipHoldings: true },
  });

  if (rules.length === 0) return { sent: false, message: "No recurring due soon" };

  const lines = rules.map((r) =>
    `${r.name}\n` +
    `Type: ${recurringAlertTypeLabel(r)}\n` +
    `Amount: ${r.amount.toString()}\n` +
    `Due: ${format(r.nextRunDate, "MMM d, yyyy")}\n` +
    `Account: ${r.account?.name ?? "—"}`
  );

  const message = `Finarc - Recurring Transactions Due\n\n${lines.join("\n\n---\n\n")}`;
  const sent = await sendTelegram(botToken!, chatId!, message);
  if (sent) await markNotified("lastNotify_recurringDue");
  return { sent };
}

// ─── Dues Reminder ─────────────────────────────────────────────────────

export async function notifyDuesDue(): Promise<{ sent: boolean; message?: string }> {
  const enabled = (await prisma.appSetting.findUnique({ where: { key: "notifyDuesDue" } }))?.value === "true";
  if (!enabled) return { sent: false, message: "Disabled" };

  if (await wasNotifiedToday("lastNotify_duesDue")) return { sent: false, message: "Already notified today" };

  const { botToken, chatId, configured } = await getTelegramConfig();
  if (!configured) return { sent: false, message: "Telegram not configured" };

  const tomorrow = addDays(new Date(), 1);
  const dues = await prisma.due.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lte: tomorrow },
    },
  });

  if (dues.length === 0) return { sent: false, message: "No dues approaching" };

  const lines = dues.map((d) => {
    const remaining = Number(d.amount) - Number(d.amountSettled);
    return `${d.type === "RECEIVABLE" ? "Receivable from" : "Payable to"}: ${d.personName}\n` +
      `Amount: ${remaining.toFixed(2)}\n` +
      `Due: ${d.dueDate ? format(d.dueDate, "MMM d, yyyy") : "No date set"}\n` +
      `${d.description ?? ""}`;
  });

  const message = `Finarc - Dues Reminder\n\n${lines.join("\n\n---\n\n")}`;
  const sent = await sendTelegram(botToken!, chatId!, message);
  if (sent) await markNotified("lastNotify_duesDue");
  return { sent };
}

// ─── Low Balance Warning ───────────────────────────────────────────────

export async function notifyLowBalance(): Promise<{ sent: boolean; message?: string }> {
  const enabled = (await prisma.appSetting.findUnique({ where: { key: "notifyLowBalance" } }))?.value === "true";
  if (!enabled) return { sent: false, message: "Disabled" };

  if (await wasNotifiedToday("lastNotify_lowBalance")) return { sent: false, message: "Already notified today" };

  const { botToken, chatId, configured } = await getTelegramConfig();
  if (!configured) return { sent: false, message: "Telegram not configured" };

  // Find recurring rules due tomorrow
  const tomorrow = addDays(new Date(), 1);
  const rules = await prisma.recurringRule.findMany({
    where: {
      status: "ACTIVE",
      nextRunDate: { gte: new Date(), lte: tomorrow },
    },
    include: { account: true, toAccount: true, sipHoldings: true },
  });

  if (rules.length === 0) return { sent: false, message: "No recurring due tomorrow" };

  const warnings: string[] = [];

  for (const rule of rules) {
    if (!rule.accountId) continue;
    const { computeAccountBalance } = await import("@/lib/finance/balances");
    const balance = await computeAccountBalance(rule.accountId);
    const needed = Number(rule.amount);
    const balNum = balance.toNumber();

    if (balNum < needed) {
      warnings.push(
        `Rule: ${rule.name}\n` +
        `Type: ${recurringAlertTypeLabel(rule)}\n` +
        `Due: Tomorrow\n` +
        `Amount needed: ${needed.toFixed(2)}\n` +
        `Account: ${rule.account?.name ?? "Unknown"}\n` +
        `Current balance: ${balNum.toFixed(2)}\n` +
        `Shortfall: ${(needed - balNum).toFixed(2)}`
      );
    }
  }

  if (warnings.length === 0) return { sent: false, message: "All accounts have sufficient balance" };

  const message = `Finarc - Low Balance Warning\n\nThe following recurring payments are due tomorrow but your account balance may be insufficient:\n\n${warnings.join("\n\n---\n\n")}`;
  const sent = await sendTelegram(botToken!, chatId!, message);
  if (sent) await markNotified("lastNotify_lowBalance");
  return { sent };
}

function recurringAlertTypeLabel(rule: {
  type: string;
  name: string;
  sipHoldings?: Array<{ type: string; assetClass: string }>;
}) {
  const holding = rule.sipHoldings?.find(Boolean);
  if (holding?.type === "PROVIDENT_FUND" || /^PF:/i.test(rule.name)) return "Investment - PF contribution";
  if (holding?.assetClass === "RECURRING_DEPOSIT" || /^RD:/i.test(rule.name)) return "Investment - RD installment";
  if (holding || /^SIP:/i.test(rule.name)) return "Investment - SIP";
  return {
    INCOME: "Income",
    EXPENSE: "Expense",
    TRANSFER: "Transfer",
    CREDIT_PAYMENT: "Credit card payment",
    LOAN_PAYMENT: "Loan payment",
  }[rule.type] ?? rule.type;
}

// ─── Run All ───────────────────────────────────────────────────────────

export async function runAllNotifications() {
  const { runMarketAlerts } = await import("@/lib/services/market-alerts");
  const results = {
    creditDue: await notifyCreditDue().catch((e) => ({ sent: false, message: (e as Error).message })),
    budgetExceeded: await notifyBudgetExceeded().catch((e) => ({ sent: false, message: (e as Error).message })),
    recurringDue: await notifyRecurringDue().catch((e) => ({ sent: false, message: (e as Error).message })),
    duesDue: await notifyDuesDue().catch((e) => ({ sent: false, message: (e as Error).message })),
    lowBalance: await notifyLowBalance().catch((e) => ({ sent: false, message: (e as Error).message })),
    marketAlerts: await runMarketAlerts({ send: true }).catch((e) => ({ sent: false, message: (e as Error).message })),
  };
  return results;
}
