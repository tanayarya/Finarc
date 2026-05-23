import { Decimal } from "decimal.js";
import type { Prisma } from "@prisma/client";

/**
 * Centralized money math.
 * Uses decimal.js to avoid floating-point error in financial calculations.
 * Storage is Prisma Decimal(18,2). API exchange uses string for precision.
 */

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export const ZERO: Money = new Decimal(0);

export function toMoney(input: string | number | Decimal | Prisma.Decimal | null | undefined): Money {
  if (input === null || input === undefined || input === "") return ZERO;
  if (input instanceof Decimal) return input;
  return new Decimal(input.toString());
}

export function add(...values: Array<string | number | Decimal | Prisma.Decimal>): Money {
  return values.reduce<Money>((acc, v) => acc.plus(toMoney(v)), ZERO);
}

export function sub(a: string | number | Decimal | Prisma.Decimal, b: string | number | Decimal | Prisma.Decimal): Money {
  return toMoney(a).minus(toMoney(b));
}

export function neg(a: string | number | Decimal | Prisma.Decimal): Money {
  return toMoney(a).negated();
}

export function abs(a: string | number | Decimal | Prisma.Decimal): Money {
  return toMoney(a).abs();
}

export function gt(a: string | number | Decimal | Prisma.Decimal, b: string | number | Decimal | Prisma.Decimal): boolean {
  return toMoney(a).greaterThan(toMoney(b));
}

export function gte(a: string | number | Decimal | Prisma.Decimal, b: string | number | Decimal | Prisma.Decimal): boolean {
  return toMoney(a).greaterThanOrEqualTo(toMoney(b));
}

export function lte(a: string | number | Decimal | Prisma.Decimal, b: string | number | Decimal | Prisma.Decimal): boolean {
  return toMoney(a).lessThanOrEqualTo(toMoney(b));
}

export function ratio(a: string | number | Decimal | Prisma.Decimal, b: string | number | Decimal | Prisma.Decimal): number {
  const denom = toMoney(b);
  if (denom.isZero()) return 0;
  return toMoney(a).div(denom).toNumber();
}

export function moneyToString(m: Money | string | number | Prisma.Decimal | null | undefined): string {
  return toMoney(m).toFixed(2);
}

export function moneyToNumber(m: Money | string | number | Prisma.Decimal | null | undefined): number {
  return toMoney(m).toNumber();
}
