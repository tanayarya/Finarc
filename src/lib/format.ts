import { moneyToNumber } from "./money";
import type { Prisma } from "@prisma/client";
import { Decimal } from "decimal.js";
import { getCurrencyMeta, DEFAULT_CURRENCY } from "./currencies";

export { DEFAULT_CURRENCY };

export function formatCurrency(
  value: number | string | Decimal | Prisma.Decimal | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  options?: Intl.NumberFormatOptions
) {
  const num = typeof value === "number" ? value : moneyToNumber(value as never);
  const meta = getCurrencyMeta(currency);
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    minimumFractionDigits: meta.code === "JPY" ? 0 : 2,
    maximumFractionDigits: meta.code === "JPY" ? 0 : 2,
    ...options,
  }).format(num);
}

export function formatCompactCurrency(
  value: number | string | Decimal | Prisma.Decimal | null | undefined,
  currency: string = DEFAULT_CURRENCY
) {
  const num = typeof value === "number" ? value : moneyToNumber(value as never);
  const meta = getCurrencyMeta(currency);
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

export function formatPercent(value: number, fractionDigits = 1) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
