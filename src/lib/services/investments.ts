import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { toMoney, ZERO } from "@/lib/money";
import { calculateCharges, type ChargeRates, DEFAULT_CHARGE_RATES } from "@/lib/finance/trading-charges";
import type { InvestmentType, TradeAction } from "@prisma/client";

// ─── Charge settings from settings ─────────────────────────────────────

export interface ChargeSettings extends ChargeRates {
  enabled: boolean;
}

const DEFAULT_CHARGE_SETTINGS: ChargeSettings = {
  enabled: false,
  ...DEFAULT_CHARGE_RATES,
};

export async function getChargeSettings(): Promise<ChargeSettings> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "tradingCharges" } });
  if (setting?.value) {
    try {
      const saved = JSON.parse(setting.value);
      return { ...DEFAULT_CHARGE_SETTINGS, enabled: saved.enabled ?? true, ...saved };
    } catch {
      return DEFAULT_CHARGE_SETTINGS;
    }
  }
  return DEFAULT_CHARGE_SETTINGS;
}

export async function getChargeRates(): Promise<ChargeRates> {
  const { enabled, ...rates } = await getChargeSettings();
  return rates;
}

export async function setChargeSettings(settings: Partial<ChargeSettings>) {
  const current = await getChargeSettings();
  const merged = { ...current, ...settings };
  await prisma.appSetting.upsert({
    where: { key: "tradingCharges" },
    update: { value: JSON.stringify(merged) },
    create: { key: "tradingCharges", value: JSON.stringify(merged) },
  });
  return merged;
}

export async function setChargeRates(rates: Partial<ChargeRates>) {
  return setChargeSettings(rates);
}

// ─── Buy stock/MF ──────────────────────────────────────────────────────

interface BuyInput {
  type: InvestmentType;
  symbol: string;
  name: string;
  units: number;
  pricePerUnit: number;
  occurredAt: Date;
  accountId: string;
  notes?: string;
  assetClass?: string;
  // For bonds/FD
  interestRate?: number;
  interestFreq?: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY" | "ON_MATURITY";
  maturityDate?: Date;
  // Whether to apply trading charges (stocks yes, MF/bonds/FD no)
  applyCharges?: boolean;
  // Skip creating a transaction (for migrating existing holdings)
  skipTransaction?: boolean;
}

export async function buyInvestment(input: BuyInput) {
  const amount = round2(input.units * input.pricePerUnit);
  let charges = { total: 0, brokerage: 0, stt: 0, exchangeTxn: 0, sebi: 0, stampDuty: 0, gst: 0, dpCharges: 0 };

  if (input.applyCharges !== false && input.type === "STOCK") {
    const { enabled, ...rates } = await getChargeSettings();
    if (enabled) charges = calculateCharges("BUY", amount, rates);
  }

  const netAmount = round2(amount + charges.total);

  // Find or create holding
  let holding = await prisma.holding.findFirst({
    where: { symbol: input.symbol, accountId: input.accountId, type: input.type, archived: false },
  });

  if (holding) {
    // Update weighted average buy price and units
    const existingUnits = new Decimal(holding.units.toString());
    const existingAvg = new Decimal(holding.avgBuyPrice.toString());
    const newUnits = new Decimal(input.units);
    const newPrice = new Decimal(input.pricePerUnit);

    // For PF: units stay at 1, price accumulates (total balance)
    if (input.type === "PROVIDENT_FUND") {
      const existingValue = existingUnits.mul(existingAvg);
      const addedValue = newUnits.mul(newPrice);
      const newTotal = existingValue.plus(addedValue);
      holding = await prisma.holding.update({
        where: { id: holding.id },
        data: { avgBuyPrice: newTotal.toFixed(4), currentPrice: newTotal.toFixed(4), name: input.name },
      });
    } else {
      const totalUnits = existingUnits.plus(newUnits);
      const weightedAvg = existingUnits.mul(existingAvg).plus(newUnits.mul(newPrice)).div(totalUnits);
      holding = await prisma.holding.update({
        where: { id: holding.id },
        data: { units: totalUnits.toFixed(6), avgBuyPrice: weightedAvg.toFixed(4), name: input.name },
      });
    }
  } else {
    holding = await prisma.holding.create({
      data: {
        type: input.type,
        assetClass: input.assetClass ?? inferAssetClass(input),
        symbol: input.symbol,
        name: input.name,
        units: input.units.toFixed(6),
        avgBuyPrice: input.pricePerUnit.toFixed(4),
        accountId: input.accountId,
        interestRate: input.interestRate?.toFixed(4),
        interestFreq: input.interestFreq,
        maturityDate: input.maturityDate,
        principalAmount: input.type === "BOND" || input.type === "FIXED_DEPOSIT" ? amount.toFixed(2) : undefined,
        notes: input.notes,
      },
    });
  }

  // Create transaction (money leaves the account) — skip for existing holdings migration
  let txn = null;
  if (!input.skipTransaction) {
    txn = await prisma.transaction.create({
      data: {
        type: "EXPENSE",
        amount: netAmount.toFixed(2),
        occurredAt: input.occurredAt,
        description: `Buy ${input.units} ${input.symbol} @ ${input.pricePerUnit}`,
        accountId: input.accountId,
      },
    });
  }

  // Create trade record
  const trade = await prisma.trade.create({
    data: {
      holdingId: holding.id,
      action: "BUY",
      units: input.units.toFixed(6),
      price: input.pricePerUnit.toFixed(4),
      amount: amount.toFixed(2),
      charges: charges.total.toFixed(2),
      chargesJson: JSON.stringify(charges),
      netAmount: netAmount.toFixed(2),
      occurredAt: input.occurredAt,
      transactionId: txn?.id ?? null,
      notes: input.skipTransaction ? "Existing holding (no transaction)" : input.notes,
    },
  });

  return { holding, trade, transaction: txn, charges };
}

// ─── Sell stock/MF ─────────────────────────────────────────────────────

interface SellInput {
  holdingId: string;
  units: number;
  pricePerUnit: number;
  occurredAt: Date;
  notes?: string;
  applyCharges?: boolean;
}

export async function sellInvestment(input: SellInput) {
  const holding = await prisma.holding.findUnique({ where: { id: input.holdingId } });
  if (!holding) throw new Error("Holding not found");

  const currentUnits = new Decimal(holding.units.toString());
  if (currentUnits.lessThan(input.units)) throw new Error("Insufficient units to sell");

  const amount = round2(input.units * input.pricePerUnit);
  let charges = { total: 0, brokerage: 0, stt: 0, exchangeTxn: 0, sebi: 0, stampDuty: 0, gst: 0, dpCharges: 0 };

  if (input.applyCharges !== false && holding.type === "STOCK") {
    const { enabled, ...rates } = await getChargeSettings();
    if (enabled) charges = calculateCharges("SELL", amount, rates);
  }

  const netAmount = round2(amount - charges.total);
  const remainingUnits = currentUnits.minus(input.units);

  // Update holding
  await prisma.holding.update({
    where: { id: holding.id },
    data: {
      units: remainingUnits.toFixed(6),
      archived: remainingUnits.isZero(),
    },
  });

  // Create transaction (money comes back to account)
  const txn = await prisma.transaction.create({
    data: {
      type: "INCOME",
      amount: netAmount.toFixed(2),
      occurredAt: input.occurredAt,
      description: `Sell ${input.units} ${holding.symbol} @ ${input.pricePerUnit}`,
      accountId: holding.accountId,
    },
  });

  // Create trade record
  const trade = await prisma.trade.create({
    data: {
      holdingId: holding.id,
      action: "SELL",
      units: input.units.toFixed(6),
      price: input.pricePerUnit.toFixed(4),
      amount: amount.toFixed(2),
      charges: charges.total.toFixed(2),
      chargesJson: JSON.stringify(charges),
      netAmount: netAmount.toFixed(2),
      occurredAt: input.occurredAt,
      transactionId: txn.id,
      notes: input.notes,
    },
  });

  return { holding: await prisma.holding.findUnique({ where: { id: holding.id } }), trade, transaction: txn, charges };
}

// ─── Record dividend/interest ──────────────────────────────────────────

export async function recordDividendOrInterest(holdingId: string, amount: number, occurredAt: Date, notes?: string) {
  const holding = await prisma.holding.findUnique({ where: { id: holdingId } });
  if (!holding) throw new Error("Holding not found");

  const action: TradeAction = holding.type === "STOCK" || holding.type === "MUTUAL_FUND" ? "DIVIDEND" : "INTEREST";

  const txn = await prisma.transaction.create({
    data: {
      type: "INCOME",
      amount: amount.toFixed(2),
      occurredAt,
      description: `${action === "DIVIDEND" ? "Dividend" : "Interest"} from ${holding.name}`,
      accountId: holding.accountId,
    },
  });

  const trade = await prisma.trade.create({
    data: {
      holdingId,
      action,
      units: "0",
      price: "0",
      amount: amount.toFixed(2),
      charges: "0",
      netAmount: amount.toFixed(2),
      occurredAt,
      transactionId: txn.id,
      notes,
    },
  });

  return { trade, transaction: txn };
}

// ─── Portfolio summary ─────────────────────────────────────────────────

export async function getPortfolioSummary() {
  const holdings = await prisma.holding.findMany({
    where: { archived: false },
    include: { account: true, trades: { orderBy: { occurredAt: "desc" }, take: 5 } },
  });

  let totalInvested = ZERO;
  let totalCurrentValue = ZERO;

  const items = holdings.map((h) => {
    const units = new Decimal(h.units.toString());
    const avgPrice = new Decimal(h.avgBuyPrice.toString());
    const currentPrice = h.currentPrice ? new Decimal(h.currentPrice.toString()) : avgPrice;
    const invested = units.mul(avgPrice);
    const currentValue = units.mul(currentPrice);
    const pnl = currentValue.minus(invested);
    const pnlPercent = invested.isZero() ? 0 : pnl.div(invested).mul(100).toNumber();

    totalInvested = totalInvested.plus(invested);
    totalCurrentValue = totalCurrentValue.plus(currentValue);

    return {
      id: h.id,
      type: h.type,
      assetClass: h.assetClass,
      symbol: h.symbol,
      name: h.name,
      units: units.toNumber(),
      avgBuyPrice: avgPrice.toNumber(),
      currentPrice: currentPrice.toNumber(),
      invested: invested.toNumber(),
      currentValue: currentValue.toNumber(),
      pnl: pnl.toNumber(),
      pnlPercent: round2(pnlPercent),
      lastPriceUpdate: h.lastPriceUpdate?.toISOString() ?? null,
      accountId: h.accountId,
      accountName: h.account.name,
      interestRate: h.interestRate ? Number(h.interestRate) : null,
      interestFreq: h.interestFreq,
      maturityDate: h.maturityDate?.toISOString() ?? null,
      tags: h.tags ?? [],
    };
  });

  const totalPnl = totalCurrentValue.minus(totalInvested);
  const totalPnlPercent = totalInvested.isZero() ? 0 : totalPnl.div(totalInvested).mul(100).toNumber();

  return {
    totalInvested: totalInvested.toNumber(),
    totalCurrentValue: totalCurrentValue.toNumber(),
    totalPnl: totalPnl.toNumber(),
    totalPnlPercent: round2(totalPnlPercent),
    holdings: items,
  };
}

// ─── Price refresh ─────────────────────────────────────────────────────

export async function refreshPrices() {
  const holdings = await prisma.holding.findMany({
    where: { archived: false, type: { in: ["STOCK", "MUTUAL_FUND", "COMMODITY"] } },
  });

  const results: Array<{ id: string; symbol: string; price: number | null; error?: string }> = [];

  // Cache gold/silver prices (one API call for all gold holdings, one for silver)
  let goldPrice: number | null = null;
  let silverPrice: number | null = null;
  const hasGold = holdings.some((h) => h.assetClass === "GOLD");
  const hasSilver = holdings.some((h) => h.assetClass === "SILVER");
  if (hasGold) goldPrice = await fetchGoldPrice();
  if (hasSilver) silverPrice = await fetchSilverPrice();

  for (const h of holdings) {
    try {
      let price: number | null = null;
      if (h.type === "STOCK") {
        price = await fetchStockPrice(h.symbol);
      } else if (h.type === "MUTUAL_FUND") {
        price = await fetchMFNav(h.symbol);
      } else if (h.type === "COMMODITY") {
        price = h.assetClass === "GOLD" ? goldPrice : h.assetClass === "SILVER" ? silverPrice : null;
      }
      if (price !== null) {
        await prisma.holding.update({
          where: { id: h.id },
          data: { currentPrice: price.toFixed(4), lastPriceUpdate: new Date() },
        });
      }
      results.push({ id: h.id, symbol: h.symbol, price });
    } catch (e) {
      results.push({ id: h.id, symbol: h.symbol, price: null, error: (e as Error).message });
    }
  }

  return results;
}

async function fetchStockPrice(symbol: string): Promise<number | null> {
  try {
    const { default: YahooFinance } = await import("yahoo-finance2");
    const yahooFinance = new (YahooFinance as any)();
    const quote = await yahooFinance.quote(symbol);
    return quote?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

async function fetchMFNav(schemeCode: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    const nav = data?.data?.[0]?.nav;
    return nav ? parseFloat(nav) : null;
  } catch {
    return null;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function inferAssetClass(input: BuyInput): string {
  if (input.type === "MUTUAL_FUND") return "MUTUAL_FUND";
  if (input.type === "BOND") return "BOND";
  if (input.type === "FIXED_DEPOSIT") return "FIXED_DEPOSIT";
  if (input.type === "PROVIDENT_FUND") return "PROVIDENT_FUND";
  if (input.type === "COMMODITY") {
    if (input.symbol.toLowerCase().includes("silver") || input.symbol.toLowerCase().includes("xag"))
      return "SILVER";
    return "GOLD";
  }
  // STOCK: detect US vs India vs ETF
  if (input.symbol.endsWith(".NS") || input.symbol.endsWith(".BO")) {
    if (input.symbol.includes("BEES") || input.symbol.includes("ETF"))
      return "ETF";
    return "STOCKS_INDIA";
  }
  // No suffix = likely US stock
  if (!input.symbol.includes(".")) return "STOCKS_US";
  return "STOCKS_INDIA";
}

async function fetchGoldPrice(): Promise<number | null> {
  try {
    const res = await fetch("https://api.gold-api.com/price/XAU/INR");
    if (!res.ok) return null;
    const data = await res.json();
    // API returns price per troy ounce in INR, convert to per gram
    return data?.price ? Math.round((data.price / 31.1035) * 100) / 100 : null;
  } catch {
    return null;
  }
}

async function fetchSilverPrice(): Promise<number | null> {
  try {
    const res = await fetch("https://api.gold-api.com/price/XAG/INR");
    if (!res.ok) return null;
    const data = await res.json();
    // API returns price per troy ounce in INR, convert to per gram
    return data?.price ? Math.round((data.price / 31.1035) * 100) / 100 : null;
  } catch {
    return null;
  }
}
