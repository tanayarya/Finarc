"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { mutate } from "swr";
import { addMonths, format } from "date-fns";
import { CalendarIcon, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { postJson, fetcher } from "@/lib/fetcher";
import { useAccounts } from "@/hooks/use-data";
import { useAppSettings } from "@/hooks/use-settings";
import { ASSET_CLASS_LIST, isSipEligible, getTypeForAssetClass } from "@/lib/finance/asset-classes";

interface SearchResult { symbol: string; name: string; exchange?: string; type: string }

interface FormValues {
  assetClass: string;
  symbol: string;
  name: string;
  units: string;
  pricePerUnit: string;
  occurredAt: Date;
  accountId: string;
  notes: string;
  interestRate: string;
  interestFreq: string;
  maturityDate: string;
  isRecurring: boolean;
  sipAmount: string;
  sipFrequency: string;
}

export function BuyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: accounts } = useAccounts();
  const { defaultInvestmentAccountId } = useAppSettings();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [skipTransaction, setSkipTransaction] = React.useState(false);
  const [fetchingPrice, setFetchingPrice] = React.useState(false);

  const form = useForm<FormValues>({
    defaultValues: getDefaults(),
  });

  const assetClass = form.watch("assetClass");
  const isRecurring = form.watch("isRecurring");
  const behaviorType = getTypeForAssetClass(assetClass);
  const sipEligible = isSipEligible(assetClass);
  const isFixedIncome = ["BOND", "FIXED_DEPOSIT"].includes(assetClass);
  const isPF = assetClass === "PROVIDENT_FUND";
  const isRD = assetClass === "RECURRING_DEPOSIT";
  const isCommodity = ["GOLD", "SILVER"].includes(assetClass);
  const needsSearch = ["STOCKS_INDIA", "STOCKS_US", "ETF", "MUTUAL_FUND"].includes(assetClass);

  React.useEffect(() => {
    if (open) {
      form.reset({ ...getDefaults(), accountId: defaultInvestmentAccountId ?? "" });
      setSearchQuery("");
      setSearchResults([]);
      setSkipTransaction(false);
    }
  }, [open, form]);

  // Reset recurring when switching to non-SIP-eligible asset class
  // Only reset search when the asset class actually changes (not on toggle)
  const prevAssetClass = React.useRef(assetClass);
  React.useEffect(() => {
    if (prevAssetClass.current !== assetClass) {
      // Asset class changed — reset everything
      if (!sipEligible) {
        form.setValue("isRecurring", false);
      }
      setSearchQuery("");
      setSearchResults([]);
      form.setValue("symbol", "");
      form.setValue("name", "");
      form.setValue("units", "");
      form.setValue("pricePerUnit", "");
      form.setValue("sipAmount", "");
      form.setValue("interestRate", "");
      form.setValue("maturityDate", "");
      prevAssetClass.current = assetClass;
    }
  }, [assetClass, sipEligible, form]);

  const onSearch = React.useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const searchType = behaviorType === "MUTUAL_FUND" ? "MUTUAL_FUND" : "STOCK";
      const results = await fetcher<SearchResult[]>(`/api/investments/search?q=${encodeURIComponent(q)}&type=${searchType}`);
      setSearchResults(results);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [behaviorType]);

  const onSelectResult = (r: SearchResult) => {
    form.setValue("symbol", r.symbol);
    form.setValue("name", r.name);
    setSearchQuery(r.name);
    setSearchResults([]);
  };

  const onFetchPrice = async () => {
    const symbol = form.getValues("symbol");
    if (!symbol) { toast.error("Select an instrument first"); return; }
    setFetchingPrice(true);
    try {
      const type = behaviorType === "MUTUAL_FUND" ? "MUTUAL_FUND" : assetClass === "GOLD" ? "GOLD" : assetClass === "SILVER" ? "SILVER" : "STOCK";
      const res = await fetch(`/api/investments/price?symbol=${encodeURIComponent(symbol)}&type=${type}`);
      const json = await res.json();
      if (json.data?.price) {
        form.setValue("pricePerUnit", json.data.price.toFixed(2));
        toast.success(`Current price: ${json.data.price.toFixed(2)}`);
      } else {
        toast.error("Could not fetch price");
      }
    } catch { toast.error("Failed to fetch price"); }
    finally { setFetchingPrice(false); }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!values.accountId) { toast.error("Select an account"); return; }

    const type = getTypeForAssetClass(values.assetClass);

    // Recurring Deposit: first installment now, future monthly installments until maturity.
    if (values.assetClass === "RECURRING_DEPOSIT") {
      if (!values.units || Number(values.units) <= 0) { toast.error("Enter monthly RD installment"); return; }
      if (!values.interestRate || Number(values.interestRate) <= 0) { toast.error("Enter RD interest rate"); return; }
      if (!values.maturityDate) { toast.error("Select RD maturity date"); return; }
      try {
        const holdingName = values.name || "Recurring Deposit";
        const investment = await postJson<{ holdingId: string }>("/api/investments", {
          type: "FIXED_DEPOSIT",
          assetClass: "RECURRING_DEPOSIT",
          symbol: values.symbol || holdingName.replace(/\s+/g, "-").toUpperCase(),
          name: holdingName,
          units: values.units,
          pricePerUnit: 1,
          occurredAt: values.occurredAt,
          accountId: values.accountId,
          interestRate: Number(values.interestRate),
          interestFreq: "ON_MATURITY",
          maturityDate: values.maturityDate,
          applyCharges: false,
          skipTransaction: false,
        });
        await postJson("/api/recurring", {
          name: `RD: ${holdingName}`,
          type: "EXPENSE",
          amount: values.units,
          frequency: "MONTHLY",
          interval: 1,
          startDate: addMonths(values.occurredAt, 1),
          endDate: values.maturityDate,
          description: `Recurring deposit installment for ${holdingName}`,
          accountId: values.accountId,
          holdingId: investment.holdingId,
        });
        toast.success("Recurring deposit set up");
        onOpenChange(false);
        mutate("/api/investments");
        mutate("/api/recurring");
        mutate((key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
      return;
    }

    // Recurring SIP/PF
    if (values.isRecurring && sipEligible) {
      if (!values.sipAmount || Number(values.sipAmount) <= 0) { toast.error("Enter recurring amount"); return; }
      try {
        // Determine the symbol for this holding
        const holdingSymbol = values.symbol || values.assetClass;
        const holdingName = values.name || getAssetLabel(values.assetClass);

        // Create recurring rule
        await postJson("/api/recurring", {
          name: `SIP: ${holdingName}`,
          type: "EXPENSE",
          amount: values.sipAmount,
          frequency: values.sipFrequency,
          interval: 1,
          startDate: values.occurredAt,
          description: `Recurring ${getAssetLabel(values.assetClass)} contribution`,
          accountId: values.accountId,
        });

        // Ensure a holding exists (buyInvestment will find existing or create new)
        // Use 0 units + 0 price so it doesn't affect balance if holding already exists
        // The backend findFirst will match by symbol+account+type and just update
        await postJson("/api/investments", {
          type,
          assetClass: values.assetClass,
          symbol: holdingSymbol,
          name: holdingName,
          units: 0.000001, // minimal to trigger find-or-create
          pricePerUnit: 0.01,
          occurredAt: values.occurredAt,
          accountId: values.accountId,
          applyCharges: false, skipTransaction,
        }).catch(() => {}); // Ignore if holding already exists

        toast.success("Recurring investment set up");
        onOpenChange(false);
        mutate("/api/investments");
        mutate("/api/recurring");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
      return;
    }

    // One-time PF
    if (isPF) {
      if (!values.units || Number(values.units) <= 0) { toast.error("Enter PF balance"); return; }
      try {
        await postJson("/api/investments", {
          type: "PROVIDENT_FUND",
          assetClass: values.assetClass,
          symbol: values.assetClass,
          name: values.name || "Provident Fund",
          units: 1,
          pricePerUnit: values.units,
          occurredAt: values.occurredAt,
          accountId: values.accountId,
          interestRate: values.interestRate ? Number(values.interestRate) : undefined,
          applyCharges: false, skipTransaction,
        });
        toast.success("PF balance recorded");
        onOpenChange(false);
        mutate("/api/investments");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
      return;
    }

    // One-time commodity (gold/silver physical)
    if (isCommodity) {
      if (!values.units || Number(values.units) <= 0) { toast.error("Enter weight in grams"); return; }
      if (!values.pricePerUnit || Number(values.pricePerUnit) <= 0) { toast.error("Enter price per gram"); return; }
      try {
        await postJson("/api/investments", {
          type: "COMMODITY",
          assetClass: values.assetClass,
          symbol: values.assetClass === "GOLD" ? "GOLD" : "SILVER",
          name: values.name || (values.assetClass === "GOLD" ? "Physical Gold" : "Physical Silver"),
          units: values.units,
          pricePerUnit: values.pricePerUnit,
          occurredAt: values.occurredAt,
          accountId: values.accountId,
          applyCharges: false, skipTransaction,
        });
        toast.success("Commodity recorded");
        onOpenChange(false);
        mutate("/api/investments");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
      return;
    }

    // One-time fixed income: bonds and fixed deposits are entered as a single amount.
    if (isFixedIncome) {
      if (!values.units || Number(values.units) <= 0) { toast.error("Enter valid amount"); return; }
      try {
        await postJson("/api/investments", {
          type,
          assetClass: values.assetClass,
          symbol: values.symbol || values.name.replace(/\s+/g, "-").toUpperCase(),
          name: values.name,
          units: values.units,
          pricePerUnit: 1,
          occurredAt: values.occurredAt,
          accountId: values.accountId,
          notes: values.notes || undefined,
          interestRate: values.interestRate ? Number(values.interestRate) : undefined,
          interestFreq: values.interestFreq,
          maturityDate: values.maturityDate || undefined,
          applyCharges: false,
          skipTransaction,
        });
        toast.success("Investment recorded");
        onOpenChange(false);
        mutate("/api/investments");
        mutate("/api/recurring");
        mutate((key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
      return;
    }

    // Standard: stocks, MF, ETF, bonds, FD
    if (needsSearch && !values.symbol) { toast.error("Search and select an instrument"); return; }
    if (!values.units || Number(values.units) <= 0) { toast.error("Enter valid units/amount"); return; }
    if (!values.pricePerUnit || Number(values.pricePerUnit) <= 0) { toast.error("Enter valid price"); return; }

    try {
      await postJson("/api/investments", {
        type,
        assetClass: values.assetClass,
        symbol: values.symbol || values.name.replace(/\s+/g, "-").toUpperCase(),
        name: values.name,
        units: values.units,
        pricePerUnit: values.pricePerUnit,
        occurredAt: values.occurredAt,
        accountId: values.accountId,
        notes: values.notes || undefined,
        interestRate: values.interestRate ? Number(values.interestRate) : undefined,
          interestFreq: undefined,
          maturityDate: undefined,
        applyCharges: type === "STOCK" && !skipTransaction,
        skipTransaction,
      });
      toast.success("Investment recorded");
      onOpenChange(false);
      mutate("/api/investments");
      mutate((key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  });

  const investmentAccounts = (accounts ?? []).filter((a) => ["SAVINGS", "CASH", "INVESTMENT"].includes(a.type));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add investment</DialogTitle>
          <DialogDescription>Record a purchase or set up a recurring SIP.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Asset class selector */}
          <div className="space-y-1.5">
            <Label>Asset class</Label>
            <Controller control={form.control} name="assetClass" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_CLASS_LIST.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          {/* SIP toggle — only for eligible classes */}
          {sipEligible && !isRD && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{isRecurring ? "Recurring SIP" : "One-time purchase"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRecurring ? "Auto-deduct on a schedule" : "Single buy at a specific price"}
                </p>
              </div>
              <Controller control={form.control} name="isRecurring" render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
            </div>
          )}

          {/* Search for stocks/MF/ETF — show even in recurring mode for MF/ETF */}
          {needsSearch && (
            <div className="space-y-1.5">
              <Label>Search {assetClass === "MUTUAL_FUND" ? "mutual fund" : "stock / ETF"}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder={assetClass === "MUTUAL_FUND" ? "Axis Bluechip..." : "RELIANCE, AAPL, GOLDBEES..."} value={searchQuery} onChange={(e) => onSearch(e.target.value)} />
              </div>
              {searchResults.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-md border bg-popover p-1 text-sm">
                  {searchResults.map((r) => (
                    <li key={r.symbol}><button type="button" className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent" onClick={() => onSelectResult(r)}><span className="font-medium">{r.symbol}</span><span className="ml-2 text-muted-foreground">{r.name}</span></button></li>
                  ))}
                </ul>
              )}
              {form.watch("symbol") && <p className="text-xs text-muted-foreground">Selected: <strong>{form.watch("symbol")}</strong> — {form.watch("name")}</p>}
            </div>
          )}

          {/* Name for manual entries (bonds, FD, gold, silver, PF) */}
          {!needsSearch && !isPF && (
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder={isRD ? "HDFC RD" : isCommodity ? "Physical Gold 24K" : isFixedIncome ? "SGB 2028 / HDFC FD" : "Name"} {...form.register("name")} onChange={(e) => { form.setValue("name", e.target.value); if (!needsSearch) form.setValue("symbol", e.target.value.replace(/\s+/g, "-").toUpperCase()); }} />
            </div>
          )}

          {/* Recurring: amount + frequency */}
          {isRecurring && !isRD && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isPF ? "Monthly PF contribution" : "SIP amount"}</Label>
                <Input inputMode="decimal" placeholder="5000" {...form.register("sipAmount")} />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Controller control={form.control} name="sipFrequency" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          )}

          {/* One-time: units + price */}
          {!isRecurring && !isPF && !isRD && !isFixedIncome && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isCommodity ? "Weight (grams)" : isFixedIncome ? "Amount" : "Units"}</Label>
                <Input inputMode="decimal" placeholder={isCommodity ? "10" : isFixedIncome ? "100000" : "10"} {...form.register("units")} />
              </div>
              <div className="space-y-1.5">
                <Label>{isCommodity ? "Price per gram" : isFixedIncome ? "Enter 1" : assetClass === "MUTUAL_FUND" ? "NAV" : "Price per unit"}</Label>
                <div className="relative">
                  <Input inputMode="decimal" placeholder="0.00" className="pr-9" {...form.register("pricePerUnit")} />
                  {!isFixedIncome && (
                    <button
                      type="button"
                      onClick={onFetchPrice}
                      disabled={fetchingPrice || !form.watch("symbol")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Fetch current price"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", fetchingPrice && "animate-spin")} />
                    </button>
                  )}
                </div>
                {isFixedIncome && <p className="text-[10px] text-muted-foreground">For FDs/Bonds: amount above, enter 1 here.</p>}
              </div>
            </div>
          )}

          {/* Recurring deposit: monthly installment */}
          {isRD && (
            <div className="space-y-1.5">
              <Label>Monthly installment</Label>
              <Input inputMode="decimal" placeholder="10000" {...form.register("units")} />
            </div>
          )}

          {/* Fixed income one-time: just amount */}
          {!isRecurring && isFixedIncome && (
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input inputMode="decimal" placeholder="100000" {...form.register("units")} />
              <p className="text-[10px] text-muted-foreground">Principal invested in this bond or fixed deposit.</p>
            </div>
          )}

          {/* PF one-time: just amount */}
          {!isRecurring && isPF && (
            <div className="space-y-1.5">
              <Label>Current PF balance</Label>
              <Input inputMode="decimal" placeholder="500000" {...form.register("units")} />
              <p className="text-[10px] text-muted-foreground">Total accumulated PF corpus.</p>
            </div>
          )}

          {/* Date + Account */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Controller control={form.control} name="occurredAt" render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />{format(new Date(field.value), "PP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" selected={new Date(field.value)} onSelect={(d) => field.onChange(d ?? new Date())} /></PopoverContent>
                </Popover>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>From account</Label>
              <Controller control={form.control} name="accountId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{investmentAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                </Select>
              )} />
            </div>
          </div>

          {/* Record existing holding toggle — skip transaction */}
          {!isRecurring && !isRD && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Record existing holding</p>
                <p className="text-xs text-muted-foreground">
                  {skipTransaction ? "No money will be deducted from your account" : "Amount will be deducted from the selected account"}
                </p>
              </div>
              <Switch checked={skipTransaction} onCheckedChange={setSkipTransaction} />
            </div>
          )}

          {/* Fixed income fields: FD/Bond payout, RD maturity-only */}
          {isFixedIncome && !isRecurring && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Interest %</Label>
                <Input inputMode="decimal" placeholder="7.5" {...form.register("interestRate")} />
              </div>
              <div className="space-y-1.5">
                <Label>Payout</Label>
                <Controller control={form.control} name="interestFreq" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                      <SelectItem value="ON_MATURITY">On maturity</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Maturity</Label>
                <Controller control={form.control} name="maturityDate" render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1 h-3.5 w-3.5" />{field.value ? format(new Date(field.value), "PP") : "Pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(d) => field.onChange(d ? d.toISOString() : "")} /></PopoverContent>
                  </Popover>
                )} />
              </div>
            </div>
          )}

          {isRD && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Interest %</Label>
                <Input inputMode="decimal" placeholder="7.5" {...form.register("interestRate")} />
              </div>
              <div className="space-y-1.5">
                <Label>Maturity</Label>
                <Controller control={form.control} name="maturityDate" render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1 h-3.5 w-3.5" />{field.value ? format(new Date(field.value), "PP") : "Pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(d) => field.onChange(d ? d.toISOString() : "")} /></PopoverContent>
                  </Popover>
                )} />
              </div>
            </div>
          )}

          {behaviorType === "STOCK" && !isRecurring && (
            <p className="text-xs text-muted-foreground">Trading charges are applied for stocks only when enabled in Settings.</p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Recording..." : isRD ? "Set up RD" : isRecurring ? "Set up SIP" : "Record purchase"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaults(): FormValues {
  return {
    assetClass: "STOCKS_INDIA",
    symbol: "",
    name: "",
    units: "",
    pricePerUnit: "",
    occurredAt: new Date(),
    accountId: "",
    notes: "",
    interestRate: "",
    interestFreq: "YEARLY",
    maturityDate: "",
    isRecurring: false,
    sipAmount: "",
    sipFrequency: "MONTHLY",
  };
}

function getAssetLabel(cls: string) {
  const item = ASSET_CLASS_LIST.find((c) => c.value === cls);
  return item?.label ?? cls;
}
