/**
 * Asset class definitions for investment categorization.
 * `type` = behavioral (how it's tracked/priced)
 * `assetClass` = visual grouping (charts, allocation)
 */

export const ASSET_CLASSES = {
  STOCKS_INDIA: { label: "Indian Stocks", color: "hsl(221 83% 53%)", type: "STOCK" },
  STOCKS_US: { label: "US Stocks", color: "hsl(250 70% 55%)", type: "STOCK" },
  ETF: { label: "ETFs", color: "hsl(190 80% 45%)", type: "STOCK" },
  MUTUAL_FUND: { label: "Mutual Funds", color: "hsl(142 71% 45%)", type: "MUTUAL_FUND" },
  GOLD: { label: "Gold", color: "hsl(45 93% 47%)", type: "COMMODITY" },
  SILVER: { label: "Silver", color: "hsl(210 10% 65%)", type: "COMMODITY" },
  BOND: { label: "Bonds", color: "hsl(38 92% 50%)", type: "BOND" },
  FIXED_DEPOSIT: { label: "Fixed Deposits", color: "hsl(271 81% 56%)", type: "FIXED_DEPOSIT" },
  RECURRING_DEPOSIT: { label: "Recurring Deposit", color: "hsl(320 70% 50%)", type: "FIXED_DEPOSIT" },
  PROVIDENT_FUND: { label: "Provident Fund", color: "hsl(0 72% 51%)", type: "PROVIDENT_FUND" },
} as const;

export type AssetClass = keyof typeof ASSET_CLASSES;

export const ASSET_CLASS_LIST = Object.entries(ASSET_CLASSES).map(([key, val]) => ({
  value: key,
  label: val.label,
  color: val.color,
  type: val.type,
}));

export function getAssetClassLabel(cls: string): string {
  return (ASSET_CLASSES as Record<string, { label: string }>)[cls]?.label ?? cls;
}

export function getAssetClassColor(cls: string): string {
  return (ASSET_CLASSES as Record<string, { color: string }>)[cls]?.color ?? "hsl(var(--muted))";
}

export function getTypeForAssetClass(cls: string): string {
  return (ASSET_CLASSES as Record<string, { type: string }>)[cls]?.type ?? "STOCK";
}

/**
 * Which asset classes support SIP/recurring?
 */
export const SIP_ELIGIBLE: AssetClass[] = ["MUTUAL_FUND", "ETF", "GOLD", "SILVER", "PROVIDENT_FUND", "RECURRING_DEPOSIT"];

export function isSipEligible(cls: string): boolean {
  return SIP_ELIGIBLE.includes(cls as AssetClass);
}
