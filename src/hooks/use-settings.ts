"use client";

import useSWR from "swr";

interface AppSettingsData {
  currency: string;
  defaultAccountId: string;
  defaultInvestmentAccountId?: string;
  financialYearStart: number;
}

export function useAppSettings() {
  const { data } = useSWR<AppSettingsData>("/api/settings");
  return {
    defaultAccountId: data?.defaultAccountId || undefined,
    defaultInvestmentAccountId: data?.defaultInvestmentAccountId || undefined,
    financialYearStart: data?.financialYearStart ?? 4,
    currency: data?.currency ?? "USD",
  };
}
