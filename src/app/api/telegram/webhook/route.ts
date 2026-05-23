import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  const openaiModel = (await prisma.appSetting.findUnique({ where: { key: "openaiModel" } }))?.value ?? "gpt-4o-mini";

  if (!openaiKey) {
    await sendReply(botToken, chatId, "OpenAI API key not configured. Set it in Settings → AI to enable transaction parsing.");
    return;
  }

  // Get accounts and categories for context
  const accounts = await prisma.account.findMany({ where: { archived: false }, select: { id: true, name: true, type: true } });
  const categories = await prisma.category.findMany({ where: { archived: false }, select: { id: true, name: true, kind: true } });

  const accountList = accounts.map((a) => `${a.name} (${a.type}, id:${a.id})`).join(", ");
  const categoryList = categories.map((c) => `${c.name} (${c.kind}, id:${c.id})`).join(", ");

  const prompt = `Parse this message into a financial transaction. ONLY income or expense transactions are allowed.

Available accounts: ${accountList}
Available categories: ${categoryList}

Rules:
- Match account names loosely (HDFC matches "HDFC Savings", SBI matches "SBI Account")
- Match category names loosely (food/groceries → Food, shopping/amazon → Shopping)
- If no date mentioned, use today
- If type is not clearly income or expense, respond with error
- Transfers, investments, loan payments, credit payments are NOT allowed via bot

Respond ONLY with valid JSON in this exact format:
{"type":"EXPENSE","amount":500,"description":"Amazon order","accountId":"<id>","categoryId":"<id or null>","occurredAt":"2026-05-21","error":null}

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
        max_tokens: 200,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      await sendReply(botToken, chatId, "Failed to process. OpenAI API error.");
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

    // Create the transaction
    await prisma.transaction.create({
      data: {
        type: parsed.type,
        amount: String(parsed.amount),
        occurredAt: new Date(parsed.occurredAt ?? new Date()),
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
      `Date: ${parsed.occurredAt ?? "Today"}`
    );
  } catch (e) {
    await sendReply(botToken, chatId, "Error processing message. Please try again.");
  }
}

async function handleAIQuery(botToken: string, chatId: string, query: string) {
  const openaiKey = (await prisma.appSetting.findUnique({ where: { key: "openaiApiKey" } }))?.value;
  const openaiModel = (await prisma.appSetting.findUnique({ where: { key: "openaiModel" } }))?.value ?? "gpt-4o-mini";
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
    const txns = await prisma.transaction.findMany({ orderBy: { occurredAt: "desc" }, take: 30, include: { category: true, account: true } });
    context += "\nRECENT TRANSACTIONS:\n";
    for (const t of txns) context += `- ${t.occurredAt.toISOString().slice(0, 10)} ${t.type} ${t.amount} ${t.description ?? ""} [${t.category?.name ?? ""}]\n`;
  } else {
    const thisMonth = new Date(); thisMonth.setDate(1);
    const txns = await prisma.transaction.findMany({ where: { occurredAt: { gte: thisMonth } }, select: { type: true, amount: true } });
    let inc = 0, exp = 0;
    for (const t of txns) { if (t.type === "INCOME") inc += Number(t.amount); if (t.type === "EXPENSE") exp += Number(t.amount); }
    context += `\nTHIS MONTH: Income=${inc.toFixed(0)}, Expenses=${exp.toFixed(0)}, Net=${(inc - exp).toFixed(0)}\n`;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          { role: "system", content: `You are Finarc AI, a personal finance assistant. Answer concisely in plain text (no markdown). Data:\n${context}` },
          { role: "user", content: query },
        ],
        max_tokens: 500,
        temperature: 0.7,
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

async function sendReply(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
