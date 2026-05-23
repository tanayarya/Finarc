import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") return fail("Message required", 400);

    // Get AI config
    const aiProvider = (await prisma.appSetting.findUnique({ where: { key: "aiProvider" } }))?.value ?? "openai";
    const openaiKey = (await prisma.appSetting.findUnique({ where: { key: "openaiApiKey" } }))?.value;
    const ollamaUrl = (await prisma.appSetting.findUnique({ where: { key: "ollamaUrl" } }))?.value ?? "http://localhost:11434";
    const shareDetails = (await prisma.appSetting.findUnique({ where: { key: "aiShareDetails" } }))?.value === "true";
    const openaiModel = (await prisma.appSetting.findUnique({ where: { key: "openaiModel" } }))?.value ?? "gpt-4o-mini";
    const ollamaModel = (await prisma.appSetting.findUnique({ where: { key: "ollamaModel" } }))?.value ?? "llama3.2";

    if (aiProvider === "openai" && !openaiKey) return fail("OpenAI API key not configured. Go to Settings → AI.", 400);

    // Build financial context
    const context = await buildContext(shareDetails);

    const systemPrompt = `You are Finarc AI, a personal finance assistant. Rules:\n- Keep responses SHORT (max 4-5 lines)\n- Use plain text only, no markdown, no **, no #, no bullet points\n- Give direct numbers and facts\n- Don't explain what you can't do, just answer what you can\n- Format amounts clearly with currency\n- Never say "based on the data provided" or similar filler\n- Be direct and precise like a financial dashboard\n\nUser's financial data:\n${context}`;

    let reply: string;

    if (aiProvider === "ollama") {
      reply = await callOllama(ollamaUrl, ollamaModel, systemPrompt, message);
    } else {
      reply = await callOpenAI(openaiKey!, openaiModel, systemPrompt, message);
    }

    return ok({ reply });
  } catch (e) {
    return handleError(e);
  }
}

async function buildContext(shareDetails: boolean): Promise<string> {
  const accounts = await prisma.account.findMany({ where: { archived: false } });
  const budgets = await prisma.budget.findMany({ where: { archived: false }, include: { category: true } });
  const holdings = await prisma.holding.findMany({ where: { archived: false } });

  let ctx = "";

  // Account summaries
  ctx += "ACCOUNTS:\n";
  for (const a of accounts) {
    ctx += `- ${a.name} (${a.type}): Opening balance ${a.openingBalance}\n`;
  }

  // Budget summaries
  ctx += "\nBUDGETS:\n";
  for (const b of budgets) {
    ctx += `- ${b.name}: ${b.amount} ${b.period} for ${b.category.name}\n`;
  }

  // Investment summaries
  ctx += "\nINVESTMENTS:\n";
  for (const h of holdings) {
    const units = Number(h.units);
    const price = Number(h.currentPrice ?? h.avgBuyPrice);
    ctx += `- ${h.name} (${h.type}): ${units} units, current value ~${(units * price).toFixed(0)}\n`;
  }

  if (shareDetails) {
    // Include recent transactions
    const recentTxns = await prisma.transaction.findMany({
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { category: true, account: true },
    });
    ctx += "\nRECENT TRANSACTIONS (last 50):\n";
    for (const t of recentTxns) {
      ctx += `- ${t.occurredAt.toISOString().slice(0, 10)} ${t.type} ${t.amount} ${t.description ?? ""} [${t.category?.name ?? ""}] [${t.account?.name ?? ""}]\n`;
    }
  } else {
    // Only aggregates
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const txns = await prisma.transaction.findMany({
      where: { occurredAt: { gte: thisMonth } },
      select: { type: true, amount: true },
    });
    let income = 0, expense = 0;
    for (const t of txns) {
      if (t.type === "INCOME") income += Number(t.amount);
      if (t.type === "EXPENSE") expense += Number(t.amount);
    }
    ctx += `\nTHIS MONTH SUMMARY: Income=${income.toFixed(0)}, Expenses=${expense.toFixed(0)}, Net=${(income - expense).toFixed(0)}\n`;
  }

  return ctx;
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "OpenAI API error");
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response";
}

async function callOllama(baseUrl: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error("Ollama not reachable. Is it running?");
  const data = await res.json();
  return data.message?.content ?? "No response";
}
