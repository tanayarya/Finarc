import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getTelegramConfig, sendTelegram } from "@/lib/services/notifications";

const TIME_ZONE = "Asia/Kolkata";
const SETTING_KEYS = {
  enabled: "marketAlertsEnabled",
  time: "marketAlertsTime",
  symbols: "marketAlertsSymbols",
  marketauxKey: "marketauxApiKey",
  newsdataKey: "newsdataApiKey",
  lastChecked: "lastNotify_marketAlerts",
  sentKeys: "marketAlertsSentKeys",
};

const RSS_SOURCES = [
  { name: "Moneycontrol", url: "https://www.moneycontrol.com/rss/business.xml" },
  { name: "Moneycontrol Markets", url: "https://www.moneycontrol.com/rss/marketreports.xml" },
  { name: "Livemint Markets", url: "https://www.livemint.com/rss/markets" },
  { name: "Business Standard Markets", url: "https://www.business-standard.com/rss/markets-106.rss" },
  { name: "SEBI", url: "https://www.sebi.gov.in/sebirss.xml" },
];

export interface MarketAlertConfig {
  enabled: boolean;
  time: string;
  symbols: string[];
  hasMarketauxKey: boolean;
  hasNewsdataKey: boolean;
}

interface StockTarget {
  symbol: string;
  name: string;
  quantity: number;
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  description?: string;
  publishedAt?: string;
  matchedSymbol?: string;
}

interface ClassifiedAlert {
  symbol: string;
  company: string;
  title: string;
  source: string;
  url: string;
  tone: "Positive" | "Negative" | "Risk";
  impact: "High" | "Medium";
  reason: string;
}

export async function getMarketAlertSettings(): Promise<MarketAlertConfig & { stocks: StockTarget[]; sources: Array<{ name: string; kind: "free-rss" | "optional-api"; url: string }> }> {
  const settings = await getSettingsMap();
  const stocks = await getStockTargets();
  return {
    enabled: settings.get(SETTING_KEYS.enabled) === "true",
    time: settings.get(SETTING_KEYS.time) ?? "08:45",
    symbols: parseJsonArray(settings.get(SETTING_KEYS.symbols)),
    hasMarketauxKey: Boolean(settings.get(SETTING_KEYS.marketauxKey)),
    hasNewsdataKey: Boolean(settings.get(SETTING_KEYS.newsdataKey)),
    stocks,
    sources: [
      { name: "Marketaux", kind: "optional-api", url: "https://www.marketaux.com/" },
      { name: "NewsData.io", kind: "optional-api", url: "https://newsdata.io/" },
      ...RSS_SOURCES.map((s) => ({ name: s.name, kind: "free-rss" as const, url: s.url })),
    ],
  };
}

export async function updateMarketAlertSettings(input: {
  enabled?: boolean;
  time?: string;
  symbols?: string[];
  marketauxApiKey?: string;
  newsdataApiKey?: string;
}) {
  if (input.enabled !== undefined) await setSetting(SETTING_KEYS.enabled, String(input.enabled));
  if (input.time !== undefined) await setSetting(SETTING_KEYS.time, normalizeTime(input.time));
  if (input.symbols !== undefined) await setSetting(SETTING_KEYS.symbols, JSON.stringify(input.symbols.map(cleanSymbol).filter(Boolean)));
  if (input.marketauxApiKey !== undefined && input.marketauxApiKey.trim()) await setSetting(SETTING_KEYS.marketauxKey, input.marketauxApiKey.trim());
  if (input.newsdataApiKey !== undefined && input.newsdataApiKey.trim()) await setSetting(SETTING_KEYS.newsdataKey, input.newsdataApiKey.trim());
  return getMarketAlertSettings();
}

export async function runMarketAlerts(options: { force?: boolean; send?: boolean } = {}) {
  const config = await getMarketAlertSettings();
  if (!config.enabled && !options.force) return { sent: false, message: "Disabled" };
  if (config.symbols.length === 0) return { sent: false, message: "No stocks selected" };
  if (!options.force && !(await isAlertTime(config.time))) return { sent: false, message: `Waiting for ${config.time}` };
  if (!options.force && (await wasCheckedToday())) return { sent: false, message: "Already checked today" };

  const selectedStocks = config.stocks.filter((s) => config.symbols.includes(s.symbol));
  if (selectedStocks.length === 0) return { sent: false, message: "Selected stocks are no longer active holdings" };

  const settings = await getSettingsMap();
  const rawNews = await collectNews(selectedStocks, {
    marketauxKey: settings.get(SETTING_KEYS.marketauxKey) ?? "",
    newsdataKey: settings.get(SETTING_KEYS.newsdataKey) ?? "",
  });
  const unseen = await removePreviouslySent(rawNews);
  const alerts = await classifyMaterialNews(selectedStocks, unseen.slice(0, 24));

  if (!options.force) await setSetting(SETTING_KEYS.lastChecked, new Date().toISOString());

  if (alerts.length === 0) {
    return { sent: false, message: "No material stock news found", checked: rawNews.length, candidates: unseen.length, alerts: [] };
  }

  const message = buildTelegramDigest(alerts.slice(0, 5));
  if (!options.send) return { sent: false, message: "Preview only", checked: rawNews.length, candidates: unseen.length, alerts: alerts.slice(0, 5), digest: message };

  const telegram = await getTelegramConfig();
  if (!telegram.configured) return { sent: false, message: "Telegram not configured", alerts: alerts.slice(0, 5) };

  const sent = await sendTelegram(telegram.botToken!, telegram.chatId!, message);
  if (sent) await markSent(alerts.slice(0, 5));
  return { sent, checked: rawNews.length, candidates: unseen.length, alerts: alerts.slice(0, 5) };
}

async function collectNews(stocks: StockTarget[], keys: { marketauxKey: string; newsdataKey: string }) {
  const batches = await Promise.allSettled([
    keys.marketauxKey ? fetchMarketaux(stocks, keys.marketauxKey) : Promise.resolve([]),
    keys.newsdataKey ? fetchNewsData(stocks, keys.newsdataKey) : Promise.resolve([]),
    fetchRssSources(stocks),
  ]);
  const all = batches.flatMap((b) => (b.status === "fulfilled" ? b.value : []));
  return dedupeNews(all).slice(0, 50);
}

async function fetchMarketaux(stocks: StockTarget[], apiKey: string): Promise<NewsItem[]> {
  const symbols = stocks.map((s) => s.symbol).slice(0, 20).join(",");
  const url = new URL("https://api.marketaux.com/v1/news/all");
  url.searchParams.set("api_token", apiKey);
  url.searchParams.set("symbols", symbols);
  url.searchParams.set("language", "en");
  url.searchParams.set("filter_entities", "true");
  url.searchParams.set("limit", "3");
  const json = await fetchJson(url.toString());
  return (json?.data ?? []).map((item: any) => ({
    title: item.title,
    url: item.url,
    source: item.source ?? "Marketaux",
    description: item.description,
    publishedAt: item.published_at,
    matchedSymbol: item.entities?.[0]?.symbol ? cleanSymbol(item.entities[0].symbol) : undefined,
  })).filter(validNewsItem);
}

async function fetchNewsData(stocks: StockTarget[], apiKey: string): Promise<NewsItem[]> {
  const query = stocks.slice(0, 8).map((s) => quoteQuery(s.name)).join(" OR ");
  if (!query) return [];
  const url = new URL("https://newsdata.io/api/1/news");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("country", "in");
  url.searchParams.set("language", "en");
  url.searchParams.set("size", "10");
  const json = await fetchJson(url.toString());
  return (json?.results ?? []).map((item: any) => ({
    title: item.title,
    url: item.link,
    source: item.source_id ? String(item.source_id) : "NewsData.io",
    description: item.description,
    publishedAt: item.pubDate,
  })).filter(validNewsItem);
}

async function fetchRssSources(stocks: StockTarget[]): Promise<NewsItem[]> {
  const batches = await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      const text = await fetchText(source.url);
      return parseRss(text, source.name).filter((item) => matchesAnyStock(item, stocks));
    })
  );
  return batches.flatMap((b) => (b.status === "fulfilled" ? b.value : []));
}

async function classifyMaterialNews(stocks: StockTarget[], items: NewsItem[]): Promise<ClassifiedAlert[]> {
  if (items.length === 0) return [];
  const settings = await getSettingsMap();
  const provider = settings.get("aiProvider") ?? "openai";
  const openaiKey = settings.get("openaiApiKey") ?? "";
  const ollamaUrl = settings.get("ollamaUrl") ?? "http://localhost:11434";
  const openaiModel = settings.get("openaiModel") ?? "gpt-5-mini";
  const ollamaModel = settings.get("ollamaModel") ?? "llama3.2";
  if (provider === "openai" && !openaiKey) return [];

  const stockList = stocks.map((s) => `${s.symbol}: ${s.name}, qty ${s.quantity}`).join("\n");
  const articleList = items.map((item, index) => `${index + 1}. ${item.title}\nSource: ${item.source}\nURL: ${item.url}\nSummary: ${(item.description ?? "").slice(0, 180)}`).join("\n\n");
  const system = `You classify Indian stock news for a personal portfolio pre-market alert. Return ONLY compact JSON. Alert only if news is material and stock-specific. Ignore generic market commentary, old/duplicate/weak items, SEO articles, and minor price-target chatter. Never recommend buy/sell.`;
  const user = `Portfolio stocks:\n${stockList}\n\nCandidate news:\n${articleList}\n\nReturn JSON: {"alerts":[{"symbol":"HDFCBANK.NS","company":"HDFC Bank","title":"...","source":"...","url":"...","tone":"Positive|Negative|Risk","impact":"High|Medium","reason":"max 18 words"}]}\nMax 5 alerts. If none are material, return {"alerts":[]}.`;

  const raw = provider === "ollama"
    ? await callOllama(ollamaUrl, ollamaModel, system, user)
    : await callOpenAI(openaiKey, openaiModel, system, user);
  const parsed = extractJson(raw);
  const alerts = Array.isArray(parsed?.alerts) ? parsed.alerts : [];
  const stockSymbols = new Set(stocks.map((s) => s.symbol));
  return alerts
    .filter((a: any) => a?.symbol && stockSymbols.has(cleanSymbol(a.symbol)) && a?.title && a?.url)
    .map((a: any) => ({
      symbol: cleanSymbol(a.symbol),
      company: String(a.company ?? stocks.find((s) => s.symbol === cleanSymbol(a.symbol))?.name ?? a.symbol),
      title: String(a.title).slice(0, 160),
      source: String(a.source ?? "News"),
      url: String(a.url),
      tone: ["Positive", "Negative", "Risk"].includes(a.tone) ? a.tone : "Risk",
      impact: a.impact === "High" ? "High" : "Medium",
      reason: String(a.reason ?? "Material stock-specific update").slice(0, 120),
    }));
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_completion_tokens: 650,
      ...(usesDefaultSampling(model) ? { reasoning_effort: "minimal" } : { temperature: 0 }),
    }),
  });
  if (!res.ok) throw new Error("OpenAI market alert classification failed");
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callOllama(baseUrl: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], stream: false }),
  });
  if (!res.ok) throw new Error("Ollama market alert classification failed");
  const data = await res.json();
  return data.message?.content ?? "";
}

function buildTelegramDigest(alerts: ClassifiedAlert[]) {
  const date = format(new Date(), "MMM d, yyyy");
  const body = alerts.map((a, index) =>
    `${index + 1}. ${a.company} (${a.symbol})\n` +
    `${a.tone} / ${a.impact} impact\n` +
    `${a.title}\n` +
    `Why: ${a.reason}\n` +
    `Source: ${a.source}\n${a.url}`
  ).join("\n\n---\n\n");
  return `Finarc Pre-market Stock Alerts\n${date}\n\n${body}`;
}

async function getStockTargets(): Promise<StockTarget[]> {
  const holdings = await prisma.holding.findMany({
    where: { archived: false, type: "STOCK", assetClass: { not: "ETF" } },
    orderBy: { name: "asc" },
  });
  const bySymbol = new Map<string, StockTarget>();
  for (const h of holdings) {
    const symbol = cleanSymbol(h.symbol);
    if (!symbol) continue;
    const current = bySymbol.get(symbol);
    bySymbol.set(symbol, {
      symbol,
      name: h.name,
      quantity: (current?.quantity ?? 0) + Number(h.units),
    });
  }
  return Array.from(bySymbol.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function removePreviouslySent(items: NewsItem[]) {
  const sent = new Set(parseJsonArray((await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.sentKeys } }))?.value));
  return items.filter((item) => !sent.has(newsKey(item)));
}

async function markSent(alerts: ClassifiedAlert[]) {
  const existing = parseJsonArray((await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.sentKeys } }))?.value);
  const merged = Array.from(new Set([...existing, ...alerts.map((a) => newsKey(a))])).slice(-250);
  await setSetting(SETTING_KEYS.sentKeys, JSON.stringify(merged));
  await setSetting(SETTING_KEYS.lastChecked, new Date().toISOString());
}

async function wasCheckedToday() {
  const value = (await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.lastChecked } }))?.value;
  if (!value) return false;
  return localDate(new Date(value)) === localDate(new Date());
}

async function isAlertTime(time: string) {
  return localHHMM(new Date()) >= normalizeTime(time);
}

function parseRss(xml: string, source: string): NewsItem[] {
  const itemMatches = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi));
  return itemMatches.map((match) => {
    const item = match[0];
    return {
      title: decodeXml(readTag(item, "title")),
      url: decodeXml(readTag(item, "link")),
      source,
      description: stripHtml(decodeXml(readTag(item, "description"))),
      publishedAt: decodeXml(readTag(item, "pubDate")),
    };
  }).filter(validNewsItem);
}

function matchesAnyStock(item: NewsItem, stocks: StockTarget[]) {
  const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
  return stocks.some((stock) => {
    const symbolRoot = stock.symbol.replace(/\.(NS|BO)$/i, "").toLowerCase();
    const tokens = stock.name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
    return haystack.includes(symbolRoot) || tokens.some((token) => haystack.includes(token));
  });
}

function dedupeNews(items: NewsItem[]) {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const key = newsKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function newsKey(item: Pick<NewsItem, "url" | "title">) {
  return (item.url || item.title).toLowerCase().replace(/\W+/g, "").slice(0, 120);
}

function validNewsItem(item: NewsItem) {
  return Boolean(item.title && item.url);
}

function readTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (match?.[1] ?? "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

async function fetchText(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Finarc/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.text();
}

async function getSettingsMap() {
  const rows = await prisma.appSetting.findMany();
  return new Map(rows.map((r) => [r.key, r.value]));
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").map(cleanSymbol).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function cleanSymbol(symbol: string) {
  return String(symbol ?? "").trim().toUpperCase();
}

function quoteQuery(value: string) {
  return `"${value.replace(/"/g, "")}"`;
}

function normalizeTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return "08:45";
  const [h, m] = value.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return "08:45";
  return value;
}

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function localHHMM(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return `${parts.find((p) => p.type === "hour")?.value ?? "00"}:${parts.find((p) => p.type === "minute")?.value ?? "00"}`;
}

function usesDefaultSampling(model: string) {
  return /^gpt-5(?:[.-]|$)/.test(model);
}
