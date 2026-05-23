import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY, isSupportedCurrency } from "@/lib/currencies";

export interface AppSettings {
  currency: string;
  defaultAccountId: string;
  defaultInvestmentAccountId: string;
  financialYearStart: number; // month (1-12), default 4 for April
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const currency = map.get("currency") ?? DEFAULT_CURRENCY;
  return {
    currency: isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY,
    defaultAccountId: map.get("defaultAccountId") ?? "",
    defaultInvestmentAccountId: map.get("defaultInvestmentAccountId") ?? "",
    financialYearStart: parseInt(map.get("financialYearStart") ?? "4", 10),
  };
}

export async function setAppSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function updateAppSettings(input: Partial<AppSettings>) {
  if (input.currency) {
    if (!isSupportedCurrency(input.currency))
      throw new Error("Unsupported currency");
    await setAppSetting("currency", input.currency);
  }
  if (input.defaultAccountId !== undefined) {
    await setAppSetting("defaultAccountId", input.defaultAccountId);
  }
  if (input.defaultInvestmentAccountId !== undefined) {
    await setAppSetting("defaultInvestmentAccountId", input.defaultInvestmentAccountId);
  }
  if (input.financialYearStart !== undefined) {
    await setAppSetting("financialYearStart", String(input.financialYearStart));
  }
  return getAppSettings();
}
