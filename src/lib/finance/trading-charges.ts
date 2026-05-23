/**
 * Trading charges calculator for Indian equity delivery trades.
 * Default values based on Zerodha's current (2025-2026) rate structure.
 * All rates are configurable via Settings → Trading Charges.
 */

export interface ChargeRates {
  // Brokerage (Zerodha: ₹0 for delivery, ₹20 or 0.03% for intraday)
  brokeragePercent: number; // e.g. 0 for delivery
  brokerageFlat: number; // e.g. 0 for delivery
  // STT (Securities Transaction Tax)
  sttBuyPercent: number; // 0.1% on buy side (delivery)
  sttSellPercent: number; // 0.1% on sell side (delivery)
  // Exchange transaction charges (NSE)
  exchangeTxnPercent: number; // 0.00297%
  // SEBI turnover fee
  sebiPerCrore: number; // ₹10 per crore
  // Stamp duty (state-level, on buy side)
  stampDutyBuyPercent: number; // 0.015%
  stampDutySellPercent: number; // 0% on sell
  // GST on (brokerage + exchange charges + SEBI charges)
  gstPercent: number; // 18%
  // DP charges (per sell transaction, Zerodha: ₹15.93 incl GST)
  dpCharges: number; // ₹15.93
}

export const DEFAULT_CHARGE_RATES: ChargeRates = {
  brokeragePercent: 0,
  brokerageFlat: 0,
  sttBuyPercent: 0.1,
  sttSellPercent: 0.1,
  exchangeTxnPercent: 0.00297,
  sebiPerCrore: 10,
  stampDutyBuyPercent: 0.015,
  stampDutySellPercent: 0,
  gstPercent: 18,
  dpCharges: 15.93,
};

export interface ChargeBreakdown {
  brokerage: number;
  stt: number;
  exchangeTxn: number;
  sebi: number;
  stampDuty: number;
  gst: number;
  dpCharges: number;
  total: number;
}

export function calculateCharges(
  action: "BUY" | "SELL",
  amount: number, // total trade value (units × price)
  rates: ChargeRates = DEFAULT_CHARGE_RATES
): ChargeBreakdown {
  const brokerage = Math.min(
    rates.brokerageFlat || Infinity,
    (amount * rates.brokeragePercent) / 100
  );
  const actualBrokerage = rates.brokerageFlat === 0 && rates.brokeragePercent === 0 ? 0 : brokerage;

  const stt =
    action === "BUY"
      ? (amount * rates.sttBuyPercent) / 100
      : (amount * rates.sttSellPercent) / 100;

  const exchangeTxn = (amount * rates.exchangeTxnPercent) / 100;
  const sebi = (amount / 10000000) * rates.sebiPerCrore; // per crore = per 10M
  const stampDuty =
    action === "BUY"
      ? (amount * rates.stampDutyBuyPercent) / 100
      : (amount * rates.stampDutySellPercent) / 100;

  const gstBase = actualBrokerage + exchangeTxn + sebi;
  const gst = (gstBase * rates.gstPercent) / 100;

  const dpCharges = action === "SELL" ? rates.dpCharges : 0;

  const total = round(actualBrokerage + stt + exchangeTxn + sebi + stampDuty + gst + dpCharges);

  return {
    brokerage: round(actualBrokerage),
    stt: round(stt),
    exchangeTxn: round(exchangeTxn),
    sebi: round(sebi),
    stampDuty: round(stampDuty),
    gst: round(gst),
    dpCharges: round(dpCharges),
    total,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
