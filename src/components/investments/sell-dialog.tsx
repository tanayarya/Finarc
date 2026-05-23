"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { mutate } from "swr";
import { format } from "date-fns";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/fetcher";
import { useCurrency } from "@/components/currency-provider";

interface HoldingItem {
  id: string;
  symbol: string;
  name: string;
  units: number;
  currentPrice: number;
  type: string;
}

interface FormValues {
  units: string;
  pricePerUnit: string;
  occurredAt: Date;
  notes: string;
}

export function SellDialog({
  open,
  onOpenChange,
  holding,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  holding: HoldingItem | null;
}) {
  const { formatCurrency } = useCurrency();
  const [fetchingPrice, setFetchingPrice] = React.useState(false);

  const onFetchPrice = async () => {
    if (!holding) return;
    setFetchingPrice(true);
    try {
      const type = holding.type === "MUTUAL_FUND" ? "MUTUAL_FUND" : "STOCK";
      const res = await fetch(`/api/investments/price?symbol=${encodeURIComponent(holding.symbol)}&type=${type}`);
      const json = await res.json();
      if (json.data?.price) {
        form.setValue("pricePerUnit", json.data.price.toFixed(2));
        toast.success(`Current price: ${json.data.price.toFixed(2)}`);
      } else {
        toast.error("Could not fetch price");
      }
    } catch { toast.error("Failed"); }
    finally { setFetchingPrice(false); }
  };

  const form = useForm<FormValues>({
    defaultValues: {
      units: "",
      pricePerUnit: "",
      occurredAt: new Date(),
      notes: "",
    },
  });

  React.useEffect(() => {
    if (open && holding) {
      form.reset({
        units: holding.units.toString(),
        pricePerUnit: holding.currentPrice.toString(),
        occurredAt: new Date(),
        notes: "",
      });
    }
  }, [open, holding, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!holding) return;
    const isFdOrBond = holding.type === "BOND" || holding.type === "FIXED_DEPOSIT";

    if (!isFdOrBond) {
      if (!values.units || Number(values.units) <= 0) { toast.error("Enter valid units"); return; }
      if (Number(values.units) > holding.units) { toast.error(`Max ${holding.units} units available`); return; }
    }
    if (!values.pricePerUnit || Number(values.pricePerUnit) <= 0) { toast.error("Enter valid amount"); return; }

    try {
      await postJson("/api/investments/sell", {
        holdingId: holding.id,
        units: isFdOrBond ? holding.units : Number(values.units),
        pricePerUnit: isFdOrBond ? Number(values.pricePerUnit) / holding.units : Number(values.pricePerUnit),
        occurredAt: values.occurredAt,
        notes: values.notes || undefined,
        applyCharges: holding.type === "STOCK",
      });
      toast.success(isFdOrBond ? "Redeemed — amount credited to account" : "Sell recorded — proceeds credited to account");
      onOpenChange(false);
      mutate("/api/investments");
      mutate((key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  });

  if (!holding) return null;

  const isFdOrBond = holding.type === "BOND" || holding.type === "FIXED_DEPOSIT";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isFdOrBond ? "Redeem" : "Sell"} {holding.name}</DialogTitle>
          <DialogDescription>
            {isFdOrBond
              ? `Enter the total amount you received (principal + interest earned).`
              : `${holding.symbol} · ${holding.units} units available · Current price ${formatCurrency(holding.currentPrice)}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {!isFdOrBond && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Units to sell</Label>
                <Input inputMode="decimal" placeholder={holding.units.toString()} {...form.register("units")} />
              </div>
              <div className="space-y-1.5">
                <Label>Sell price per unit</Label>
                <div className="relative">
                  <Input inputMode="decimal" className="pr-9" {...form.register("pricePerUnit")} />
                  <button
                    type="button"
                    onClick={onFetchPrice}
                    disabled={fetchingPrice}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Fetch current price"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", fetchingPrice && "animate-spin")} />
                  </button>
                </div>
              </div>
            </div>
          )}
          {isFdOrBond && (
            <div className="space-y-1.5">
              <Label>Redemption amount received</Label>
              <Input inputMode="decimal" placeholder="Total amount (principal + interest)" {...form.register("pricePerUnit")} />
              <p className="text-[10px] text-muted-foreground">Enter the exact amount credited to your account (after any penalties or TDS).</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Controller control={form.control} name="occurredAt" render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(field.value), "PP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar mode="single" selected={new Date(field.value)} onSelect={(d) => field.onChange(d ?? new Date())} />
                </PopoverContent>
              </Popover>
            )} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input {...form.register("notes")} />
          </div>
          {holding.type === "STOCK" && (
            <p className="text-xs text-muted-foreground">
              Trading charges (STT, DP charges, etc.) will be auto-deducted. Net proceeds will be credited to the linked account.
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Selling..." : "Confirm sell"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
