"use client";

import * as React from "react";
import useSWR from "swr";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
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

interface AppSettingsResponse {
  currency: string;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR<AppSettingsResponse>("/api/settings");
  const currency = data?.currency ?? DEFAULT_CURRENCY;

  const setCurrency = React.useCallback(
    async (next: string) => {
      // Optimistic update
      await mutate({ currency: next }, { revalidate: false });
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: next }),
      });
      if (!res.ok) {
        await mutate();
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Failed to update currency");
      }
      await mutate();
    },
    [mutate]
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
