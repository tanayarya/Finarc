import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getTelegramConfig, sendTelegram } from "@/lib/services/notifications";

const TIME_ZONE = "Asia/Kolkata";
const NSE_IPO_PAGE = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
const NSE_ENDPOINTS = [
  { status: "Current", url: "https://www.nseindia.com/api/ipo-current-issue?index=all" },
  { status: "Upcoming", url: "https://www.nseindia.com/api/ipo-upcoming-issue?index=all" },
];

const SETTING_KEYS = {
  enabled: "ipoAlertsEnabled",
  lastChecked: "lastNotify_ipoAlerts",
  sentKeys: "ipoAlertsSentKeys",
};

export interface IpoAlertConfig {
  enabled: boolean;
  source: string;
}

export interface IpoItem {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  securityType?: string;
  source: string;
}

export async function getIpoAlertSettings(): Promise<IpoAlertConfig> {
  const enabled = (await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.enabled } }))?.value === "true";
  return { enabled, source: "NSE India current and upcoming IPO issues" };
}

export async function updateIpoAlertSettings(input: { enabled?: boolean }) {
  if (input.enabled !== undefined) await setSetting(SETTING_KEYS.enabled, String(input.enabled));
  return getIpoAlertSettings();
}

export async function runIpoAlerts(options: { force?: boolean; send?: boolean } = {}) {
  const config = await getIpoAlertSettings();
  if (!config.enabled && !options.force) return { sent: false, message: "Disabled", ipos: [] };
  if (!options.force && (await wasCheckedToday())) return { sent: false, message: "Already checked today", ipos: [] };

  const allIpos = await fetchIndianIpos();
  const activeIpos = allIpos.filter(isRelevantIpoWindow);
  const unseen = options.force ? activeIpos : await removePreviouslySent(activeIpos);

  if (!options.force) await setSetting(SETTING_KEYS.lastChecked, new Date().toISOString());

  if (unseen.length === 0) {
    return { sent: false, message: "No new Indian IPOs found", checked: allIpos.length, candidates: activeIpos.length, ipos: [] };
  }

  const ipos = unseen.slice(0, 8);
  const message = buildIpoDigest(ipos);
  if (!options.send) return { sent: false, message: "Preview only", checked: allIpos.length, candidates: activeIpos.length, ipos, digest: message };

  const telegram = await getTelegramConfig();
  if (!telegram.configured) return { sent: false, message: "Telegram not configured", checked: allIpos.length, candidates: activeIpos.length, ipos };

  const sent = await sendTelegram(telegram.botToken!, telegram.chatId!, message);
  if (sent) await markSent(ipos);
  return { sent, message: sent ? "Sent" : "Telegram send failed", checked: allIpos.length, candidates: activeIpos.length, ipos };
}

async function fetchIndianIpos() {
  const batches = await Promise.allSettled(NSE_ENDPOINTS.map(fetchNseIpoEndpoint));
  return dedupeIpos(batches.flatMap((batch) => (batch.status === "fulfilled" ? batch.value : [])));
}

async function fetchNseIpoEndpoint(endpoint: { status: string; url: string }): Promise<IpoItem[]> {
  const headers = await nseHeaders();
  const res = await fetch(endpoint.url, { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`NSE IPO fetch failed: ${res.status}`);
  const json = await res.json();
  return extractRows(json)
    .map((row) => normalizeIpoRow(row, endpoint.status))
    .filter((item): item is IpoItem => Boolean(item));
}

async function nseHeaders() {
  const baseHeaders = {
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "en-IN,en;q=0.9",
    Referer: NSE_IPO_PAGE,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
  };
  try {
    const res = await fetch("https://www.nseindia.com", { headers: baseHeaders, signal: AbortSignal.timeout(8000) });
    const cookie = res.headers.getSetCookie?.().map((value) => value.split(";")[0]).join("; ");
    return cookie ? { ...baseHeaders, Cookie: cookie } : baseHeaders;
  } catch {
    return baseHeaders;
  }
}

function extractRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  const directKeys = ["data", "current", "upcoming", "ipo", "issues", "result", "records"];
  for (const key of directKeys) {
    const rows = extractRows(value[key]);
    if (rows.length) return rows;
  }
  return Object.values(value).flatMap(extractRows);
}

function normalizeIpoRow(row: Record<string, unknown>, fallbackStatus: string): IpoItem | null {
  const name = firstString(row, ["companyName", "company", "issueName", "name", "symbol", "issuerName"]);
  const startRaw = firstString(row, ["issueStartDate", "issueStartDt", "startDate", "openDate", "biddingStartDate", "issueOpenDate"]);
  const endRaw = firstString(row, ["issueEndDate", "issueEndDt", "endDate", "closeDate", "biddingEndDate", "issueCloseDate"]);
  if (!name || !startRaw || !endRaw) return null;
  const startDate = normalizeDate(startRaw);
  const endDate = normalizeDate(endRaw);
  if (!startDate || !endDate) return null;
  return {
    name: cleanText(name),
    startDate,
    endDate,
    status: firstString(row, ["status", "issueStatus"]) ?? fallbackStatus,
    securityType: firstString(row, ["securityType", "issueType", "series"]),
    source: "NSE",
  };
}

function isRelevantIpoWindow(ipo: IpoItem) {
  const today = startOfLocalDay(new Date());
  const start = parseIsoDate(ipo.startDate);
  const end = parseIsoDate(ipo.endDate);
  if (!start || !end) return false;
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + 30);
  return end >= today && start <= horizon;
}

async function removePreviouslySent(items: IpoItem[]) {
  const sent = new Set(parseJsonArray((await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.sentKeys } }))?.value));
  return items.filter((item) => !sent.has(ipoKey(item)));
}

async function markSent(items: IpoItem[]) {
  const existing = parseJsonArray((await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.sentKeys } }))?.value);
  const merged = Array.from(new Set([...existing, ...items.map(ipoKey)])).slice(-500);
  await setSetting(SETTING_KEYS.sentKeys, JSON.stringify(merged));
  await setSetting(SETTING_KEYS.lastChecked, new Date().toISOString());
}

function buildIpoDigest(ipos: IpoItem[]) {
  const date = format(new Date(), "MMM d, yyyy");
  const body = ipos.map((ipo, index) => {
    const type = ipo.securityType ? `\nType: ${ipo.securityType}` : "";
    return `${index + 1}. ${ipo.name}\nApply: ${formatDisplayDate(ipo.startDate)} to ${formatDisplayDate(ipo.endDate)}\nStatus: ${ipo.status}${type}\nSource: ${ipo.source}`;
  }).join("\n\n---\n\n");
  return `Finarc IPO Alerts - India\n${date}\n\n${body}`;
}

function firstString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function normalizeDate(value: string) {
  const text = cleanText(value);
  const iso = parseIsoDate(text);
  if (iso) return toIsoDate(iso);
  const slash = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (slash) {
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    return toIsoDate(new Date(year, Number(slash[2]) - 1, Number(slash[1])));
  }
  const monthMap: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
    jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };
  const named = text.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{2,4})$/);
  if (named) {
    const month = monthMap[named[2].toLowerCase()];
    if (month === undefined) return null;
    const year = Number(named[3].length === 2 ? `20${named[3]}` : named[3]);
    return toIsoDate(new Date(year, month, Number(named[1])));
  }
  return null;
}

function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(date: Date) {
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);
  return date ? format(date, "MMM d, yyyy") : value;
}

function startOfLocalDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return new Date(
    Number(parts.find((p) => p.type === "year")?.value ?? date.getFullYear()),
    Number(parts.find((p) => p.type === "month")?.value ?? date.getMonth() + 1) - 1,
    Number(parts.find((p) => p.type === "day")?.value ?? date.getDate())
  );
}

function ipoKey(item: IpoItem) {
  return `${item.name}:${item.startDate}:${item.endDate}`.toLowerCase().replace(/\W+/g, "-").slice(0, 180);
}

function dedupeIpos(items: IpoItem[]) {
  const seen = new Set<string>();
  const out: IpoItem[] = [];
  for (const item of items) {
    const key = ipoKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

async function wasCheckedToday() {
  const value = (await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.lastChecked } }))?.value;
  if (!value) return false;
  return localDate(new Date(value)) === localDate(new Date());
}

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
