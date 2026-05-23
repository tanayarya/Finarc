"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { mutate } from "swr";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
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
import { postJson, fetcher } from "@/lib/fetcher";
import { useCurrency } from "@/components/currency-provider";

interface HoldingItem {
  id: string;
  symbol: string;
  name: string;
  type: string;
  assetClass: string;
  accountId: string;
  accountName: string;
  currentPrice: number;
}

interface FormValues {
  units: string;
  pricePerUnit: string;
  occurredAt: Date;
}

export function AddQuantityDialog({
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

  const form = useForm<FormValues>({
    defaultValues: {
      units: "",
      pricePerUnit: "",
      occurredAt: new Date(),
    },
  });

  // Fetch current market price when dialog opens
  React.useEffect(() => {
    if (open && holding) {
      form.reset({ units: "", pricePerUnit: "", occurredAt: new Date() });
      fetchCurrentPrice(holding.symbol);
    }
  }, [open, holding, form]);

  const fetchCurrentPrice = async (symbol: string) => {
    setFetchingPrice(true);
    try {
      // Use the refresh endpoint to get latest price, or fetch directly
      const results = await fetcher<Array<{ id: string; symbol: string; price: number | null }>>(
        "/api/investments/refresh",
        { method: "POST" }
      );
      const match = results.find((r) => r.symbol === symbol);
      if (match?.price) {
        form.setValue("pricePerUnit", match.price.toFixed(2));
      } else if (holding?.currentPrice) {
        form.setValue("pricePerUnit", holding.currentPrice.toFixed(2));
      }
    } catch {
      // Fallback to the holding's last known price
      if (holding?.currentPrice) {
        form.setValue("pricePerUnit", holding.currentPrice.toFixed(2));
      }
    } finally {
      setFetchingPrice(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!holding) return;
    if (!values.units || Number(values.units) <= 0) { toast.error("Enter number of units"); return; }
    if (!values.pricePerUnit || Number(values.pricePerUnit) <= 0) { toast.error("Enter buy price"); return; }

    try {
      await postJson("/api/investments", {
        type: holding.type,
        assetClass: holding.assetClass,
        symbol: holding.symbol,
        name: holding.name,
        units: values.units,
        pricePerUnit: values.pricePerUnit,
        occurredAt: values.occurredAt,
        accountId: holding.accountId,
        applyCharges: holding.type === "STOCK",
      });
      toast.success(`Added ${values.units} units of ${holding.symbol}`);
      onOpenChange(false);
      mutate("/api/investments");
      mutate((key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    }
  });

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add quantities — {holding.symbol}</DialogTitle>
          <DialogDescription>
            {holding.name} · Linked to {holding.accountName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stock</span>
              <span className="font-medium">{holding.symbol}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium">{holding.accountName}</span>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              New units will be added to this holding. Account cannot be changed to avoid conflicts at time of selling.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Units to add</Label>
              <Input inputMode="decimal" placeholder="50" {...form.register("units")} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Buy price per unit
                {fetchingPrice && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </Label>
              <Input inputMode="decimal" placeholder="0.00" {...form.register("pricePerUnit")} />
              <p className="text-[10px] text-muted-foreground">
                {fetchingPrice ? "Fetching current price..." : "Pre-filled with market price. Edit if needed."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Purchase date</Label>
            <Controller control={form.control} name="occurredAt" render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(new Date(field.value), "PP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar mode="single" selected={new Date(field.value)} onSelect={(d) => field.onChange(d ?? new Date())} />
                </PopoverContent>
              </Popover>
            )} />
          </div>

          <p className="text-xs text-muted-foreground">
            Trading charges are applied only when enabled in Settings. The weighted average buy price will be recalculated.
          </p>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Adding..." : "Add units"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
