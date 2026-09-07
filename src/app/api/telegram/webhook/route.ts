import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasValidTelegramWebhookSecret } from "@/lib/machine-auth";

export const dynamic = "force-dynamic";

const APP_TIME_ZONE = "Asia/Kolkata";

/**
 * Telegram Bot Webhook
 * Receives messages from the configured bot and:
 * 1. If message starts with /ask or /insight — acts as AI assistant
 * 2. Otherwise — tries to parse as a transaction (income/expense only)
 *
 * Setup: Set webhook URL via Telegram API:
 * https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_DOMAIN>/api/telegram/webhook
 */
export async function POST(req: NextRequest) {
  try {
    if (!hasValidTelegramWebhookSecret(req)) {
      return new Response("OK", { status: 200 });
    }

    const body = await req.json();
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) {
      return new Response("OK", { status: 200 });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Verify this is from the configured chat
    const configuredChatId = (await prisma.appSetting.findUnique({ where: { key: "telegramChatId" } }))?.value;
    if (configuredChatId && chatId !== configuredChatId) {
      return new Response("OK", { status: 200 }); // Ignore messages from other chats
    }

    const botToken = (await prisma.appSetting.findUnique({ where: { key: "telegramBotToken" } }))?.value;
    if (!botToken) return new Response("OK", { status: 200 });

    // Check if bot input is enabled
    const botInputEnabled = (await prisma.appSetting.findUnique({ where: { key: "telegramBotInput" } }))?.value === "true";
    if (!botInputEnabled) {
      await sendReply(botToken, chatId, "Bot input is disabled. Enable it in Settings → Notifications.");
      return new Response("OK", { status: 200 });
    }

    // Route: AI query
    if (text.startsWith("/ask ") || text.startsWith("/insight ") || text.startsWith("/ai ")) {
      const query = text.replace(/^\/(ask|insight|ai)\s+/, "");
      await handleAIQuery(botToken, chatId, query);
      return new Response("OK", { status: 200 });
    }

    // Route: Help
    if (text === "/help" || text === "/start") {
      await sendReply(botToken, chatId,
        "Finarc Bot\n\n" +
        "Record transactions:\n" +
        "  Spent 500 on Amazon from HDFC\n" +
        "  Received 75000 salary in HDFC\n" +
        "  Paid 1200 for electricity from SBI\n\n" +
        "AI queries:\n" +
        "  /ask How much did I spend this month?\n" +
        "  /ask What's my net worth?\n" +
        "  /insight spending patterns\n\n" +
        "Only income and expense transactions are supported via bot."
      );
      return new Response("OK", { status: 200 });
    }

    // Route: Transaction parsing
    await handleTransaction(botToken, chatId, text);
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Telegram webhook error:", e);
    return new Response("OK", { status: 200 });
  }
}

async function handleTransaction(botToken: string, chatId: string, text: string) {
  const openaiKey = (await prisma.appSetting.findUnique({ where: { key: "openaiApiKey" } }))?.value;
  const openaiModel = (await prisma.appSetting.findUnique({ where: { key: "openaiModel" } }))?.value ?? "gpt-5-mini";

  if (!openaiKey) {
    await sendReply(botToken, chatId, "OpenAI API key not configured. Set it in Settings → AI to enable transaction parsing.");
    return;
  }

  // Get accounts and categories for context
  const accounts = await prisma.account.findMany({ where: { archived: false }, select: { id: true, name: true, type: true } });
  const categories = await prisma.category.findMany({ where: { archived: false }, select: { id: true, name: true, kind: true } });

  const accountList = accounts.map((a) => `${a.name} (${a.type}, id:${a.id})`).join(", ");
  const categoryList = categories.map((c) => `${c.name} (${c.kind}, id:${c.id})`).join(", ");

  const today = getLocalDateString(); // e.g. "2026-05-23"
  const currentYear = Number(today.slice(0, 4));

  const prompt = `Parse this message into a financial transaction. ONLY income or expense transactions are allowed.

Today's date is: ${today}. The current year is ${currentYear}.

Available accounts: ${accountList}
Available categories: ${categoryList}

Rules:
- Match account names loosely (HDFC matches "HDFC Savings", SBI matches "SBI Account")
- Match category names loosely (food/groceries → Food, shopping/amazon → Shopping)
- If no date mentioned, use today's date: ${today}
- If user says "today", use: ${today}
- If user says "yesterday", use one day before ${today}
- If the user mentions a day/month but no year, use the current year: ${currentYear}
- Never use your model training date or knowledge cutoff date as the transaction date
- If type is not clearly income or expense, respond with error
- Transfers, investments, loan payments, credit payments are NOT allowed via bot

Respond ONLY with valid JSON in this exact format:
{"type":"EXPENSE","amount":500,"description":"Amazon order","accountId":"<id>","categoryId":"<id or null>","occurredAt":"${today}","error":null}

Or if it cannot be parsed or is not income/expense:
{"error":"<reason>"}

User message: "${text}"`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: openaiModel,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 200,
        ...(usesDefaultSampling(openaiModel) ? { reasoning_effort: "minimal" } : {}),
        ...(!usesDefaultSampling(openaiModel) ? { temperature: 0 } : {}),
      }),
    });

    if (!res.ok) {
      await sendReply(botToken, chatId, `Failed to process. OpenAI API error for ${openaiModel}. Check the model in Settings → AI.`);
      return;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await sendReply(botToken, chatId, "Could not understand. Try: \"Spent 500 on groceries from HDFC\"");
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.error) {
      await sendReply(botToken, chatId, `Cannot process: ${parsed.error}\n\nOnly income and expense transactions are supported via bot. For transfers, investments, or payments, use the dashboard.`);
      return;
    }

    // Validate
    if (!["INCOME", "EXPENSE"].includes(parsed.type)) {
      await sendReply(botToken, chatId, "Only income and expense transactions can be recorded via bot. For other types, use the dashboard.");
      return;
    }

    if (!parsed.amount || parsed.amount <= 0) {
      await sendReply(botToken, chatId, "Could not determine the amount. Try: \"Spent 500 on groceries from HDFC\"");
      return;
    }

    if (!parsed.accountId) {
      await sendReply(botToken, chatId, "Could not match an account. Available: " + accounts.map((a) => a.name).join(", "));
      return;
    }

    // The model can hallucinate dates from its training cutoff. Keep final date
    // resolution deterministic for relative or omitted dates.
    const occurredAtDate = resolveTelegramTransactionDate(text, parsed.occurredAt, today);
    const txnDate = new Date(`${occurredAtDate}T00:00:00.000Z`);

    await prisma.transaction.create({
      data: {
        type: parsed.type,
        amount: String(parsed.amount),
        occurredAt: txnDate,
        description: parsed.description ?? null,
        accountId: parsed.accountId,
        categoryId: parsed.categoryId ?? null,
      },
    });

    const account = accounts.find((a) => a.id === parsed.accountId);
    const category = categories.find((c) => c.id === parsed.categoryId);

    await sendReply(botToken, chatId,
      `Recorded ${parsed.type.toLowerCase()}\n` +
      `Amount: ${parsed.amount}\n` +
      `Description: ${parsed.description ?? "—"}\n` +
      `Account: ${account?.name ?? "Unknown"}\n` +
      `Category: ${category?.name ?? "—"}\n` +
      `Date: ${occurredAtDate}`
    );
  } catch (e) {
    await sendReply(botToken, chatId, "Error processing message. Please try again.");
  }
}

function getLocalDateString(date = new Date(), timeZone = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function resolveTelegramTransactionDate(message: string, aiOccurredAt: unknown, today: string): string {
  const normalized = message.toLowerCase();

  if (/\bday before yesterday\b/.test(normalized)) return addDaysToDateString(today, -2);
  if (/\byesterday\b/.test(normalized)) return addDaysToDateString(today, -1);
  if (/\btoday\b/.test(normalized)) return today;

  const parsedDate = parseModelDate(aiOccurredAt);
  const hasExplicitDate = messageHasExplicitDate(normalized);

  if (!hasExplicitDate) return today;
  if (!parsedDate) return today;

  const hasExplicitYear = messageHasExplicitYear(normalized);
  if (hasExplicitYear) return parsedDate;

  const currentYear = today.slice(0, 4);
  return `${currentYear}-${parsedDate.slice(5)}`;
}

function parseModelDate(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;

  return `${year}-${month}-${day}`;
}

function messageHasExplicitDate(message: string): boolean {
  return (
    /\b(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/.test(message) ||
    /\b\d{1,2}(?:st|nd|rd|th)\b/.test(message) ||
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(message)
  );
}

function messageHasExplicitYear(message: string): boolean {
  return /\b(?:19|20)\d{2}\b/.test(message) || /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(message);
}

function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

async function handleAIQuery(botToken: string, chatId: string, query: string) {
  const openaiKey = (await prisma.appSetting.findUnique({ where: { key: "openaiApiKey" } }))?.value;
  const openaiModel = (await prisma.appSetting.findUnique({ where: { key: "openaiModel" } }))?.value ?? "gpt-5-mini";
  const shareDetails = (await prisma.appSetting.findUnique({ where: { key: "aiShareDetails" } }))?.value === "true";

  if (!openaiKey) {
    await sendReply(botToken, chatId, "OpenAI API key not configured. Set it in Settings → AI.");
    return;
  }

  // Build context (same as the dashboard AI chat)
  const accounts = await prisma.account.findMany({ where: { archived: false } });
  const holdings = await prisma.holding.findMany({ where: { archived: false } });

  let context = "ACCOUNTS:\n";
  for (const a of accounts) context += `- ${a.name} (${a.type}): Opening ${a.openingBalance}\n`;

  context += "\nINVESTMENTS:\n";
  for (const h of holdings) {
    const val = Number(h.units) * Number(h.currentPrice ?? h.avgBuyPrice);
    context += `- ${h.name} (${h.type}): value ~${val.toFixed(0)}\n`;
  }

  if (shareDetails) {
    const txns = await prisma.transaction.findMany({
      orderBy: { occurredAt: "desc" },
      take: 30,
      include: { category: true, account: true, trade: { include: { holding: true } } },
    });
    context += "\nRECENT TRANSACTIONS:\n";
    for (const t of txns) context += `- ${t.occurredAt.toISOString().slice(0, 10)} ${telegramTransactionTypeLabel(t)} ${t.amount} ${t.description ?? ""} [${t.category?.name ?? t.trade?.holding?.name ?? ""}]\n`;
  } else {
    const thisMonth = new Date(); thisMonth.setDate(1);
    const txns = await prisma.transaction.findMany({
      where: { occurredAt: { gte: thisMonth } },
      select: { type: true, amount: true, account: { select: { type: true } }, trade: { select: { id: true } } },
    });
    let inc = 0, exp = 0;
    for (const t of txns) {
      if (t.trade) continue;
      if (t.type === "INCOME" && t.account?.type !== "CREDIT") inc += Number(t.amount);
      if (t.type === "EXPENSE") exp += Number(t.amount);
    }
    context += `\nTHIS MONTH: Income=${inc.toFixed(0)}, Expenses=${exp.toFixed(0)}, Net=${(inc - exp).toFixed(0)}\n`;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          { role: "system", content: `You are Finarc AI, a personal finance assistant responding via Telegram. Rules:\n- Keep responses SHORT (max 3-4 lines)\n- Use plain text only, no markdown\n- Give direct numbers and facts\n- Don't explain what you can't do, just answer what you can\n- Format amounts clearly\n- If asked about investments, show: name, buy price, current value if available\n- Never say "based on the data provided" or similar filler\n\nUser's financial data:\n${context}` },
          { role: "user", content: query },
        ],
        max_completion_tokens: 300,
        ...(usesDefaultSampling(openaiModel) ? { reasoning_effort: "minimal" } : {}),
        ...(!usesDefaultSampling(openaiModel) ? { temperature: 0.7 } : {}),
      }),
    });

    if (!res.ok) { await sendReply(botToken, chatId, "AI query failed."); return; }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "No response";
    await sendReply(botToken, chatId, reply);
  } catch {
    await sendReply(botToken, chatId, "Failed to get AI response.");
  }
}

function telegramTransactionTypeLabel(tx: { type: string; trade?: { action: string; holding: { type: string; assetClass: string } } | null }) {
  if (tx.trade) {
    if (tx.trade.holding.type === "PROVIDENT_FUND") return "INVESTMENT_PF";
    if (tx.trade.holding.assetClass === "RECURRING_DEPOSIT") return "INVESTMENT_RD";
    if (tx.trade.action === "DIVIDEND" || tx.trade.action === "INTEREST") return "INVESTMENT_INCOME";
    if (tx.trade.action === "SELL" || tx.trade.action === "MATURITY") return "INVESTMENT_REDEMPTION";
    return "INVESTMENT_BUY";
  }
  return tx.type;
}

function usesDefaultSampling(model: string) {
  return /^gpt-5(?:[.-]|$)/.test(model);
}

async function sendReply(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
