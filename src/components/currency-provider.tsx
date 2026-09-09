"use client";

import * as React from "react";
import useSWR from "swr";
import { DEFAULT_CURRENCY, isSupportedCurrency } from "@/lib/currencies";
import {
  formatCurrency as formatCurrencyBase,
  formatCompactCurrency as formatCompactCurrencyBase,
} from "@/lib/format";
import type { Decimal } from "decimal.js";
import type { Prisma } from "@prisma/client";

type Money = number | string | Decimal | Prisma.Decimal | null | undefined;

interface CurrencyContextValue {
  currency: string;
  setCurrency: (next: string) => Promise<void>;
  formatCurrency: (value: Money, options?: Intl.NumberFormatOptions) => string;
  formatCompactCurrency: (value: Money) => string;
  isLoading: boolean;
}

const CurrencyContext = React.createContext<CurrencyContextValue | null>(null);
const CURRENCY_STORAGE_KEY = "finarc:currency";

interface AppSettingsResponse {
  currency: string;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR<AppSettingsResponse>("/api/settings");
  const [cachedCurrency, setCachedCurrency] = React.useState(DEFAULT_CURRENCY);

  const persistCurrency = React.useCallback((next: string) => {
    if (!isSupportedCurrency(next)) return;
    setCachedCurrency(next);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
  }, []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && isSupportedCurrency(stored)) setCachedCurrency(stored);
  }, []);

  React.useEffect(() => {
    if (data?.currency && isSupportedCurrency(data.currency)) {
      persistCurrency(data.currency);
    }
  }, [data?.currency, persistCurrency]);

  // Keep the last confirmed choice while the PWA reconnects to the settings API.
  const currency = data?.currency && isSupportedCurrency(data.currency) ? data.currency : cachedCurrency;

  const setCurrency = React.useCallback(
    async (next: string) => {
      const currency = next.toUpperCase();
      if (!isSupportedCurrency(currency)) throw new Error("Unsupported currency");

      persistCurrency(currency);
      await mutate({ currency }, { revalidate: false });
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });
      if (!res.ok) {
        await mutate();
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Failed to update currency");
      }
      await mutate();
    },
    [mutate, persistCurrency]
  );

  const value = React.useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      formatCurrency: (v, options) => formatCurrencyBase(v, currency, options),
      formatCompactCurrency: (v) => formatCompactCurrencyBase(v, currency),
      isLoading,
    }),
    [currency, setCurrency, isLoading]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = React.useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

/** Convenience: a money value that automatically uses the active app currency. */
export function Money({ value, compact }: { value: Money; compact?: boolean }) {
  const { formatCurrency, formatCompactCurrency } = useCurrency();
  return <>{compact ? formatCompactCurrency(value) : formatCurrency(value)}</>;
}
