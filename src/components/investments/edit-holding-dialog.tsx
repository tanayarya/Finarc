"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { mutate } from "swr";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchJson } from "@/lib/fetcher";

interface HoldingItem {
  id: string;
  symbol: string;
  name: string;
  units: number;
  avgBuyPrice: number;
  type: string;
  assetClass: string;
  invested?: number;
  interestRate?: number | null;
  interestFreq?: string | null;
  maturityDate?: string | null;
  recurringAmount?: number | null;
}

interface FormValues {
  units: string;
  pricePerUnit: string;
  recurringAmount: string;
  interestRate: string;
  maturityDate: string;
}

export function EditHoldingDialog({
  open,
  onOpenChange,
  holding,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  holding: HoldingItem | null;
}) {
  const form = useForm<FormValues>({
    defaultValues: { units: "", pricePerUnit: "", recurringAmount: "", interestRate: "", maturityDate: "" },
  });

  React.useEffect(() => {
    if (open && holding) {
      const isAmountOnly = ["FIXED_DEPOSIT", "BOND"].includes(holding.type) || holding.assetClass === "RECURRING_DEPOSIT";
      const isSingleAmount = isAmountOnly || ["PROVIDENT_FUND", "COMMODITY"].includes(holding.type);
      form.reset({
        units: isSingleAmount ? "1" : holding.units.toString(),
        pricePerUnit: isAmountOnly
          ? String(holding.invested ?? holding.units * holding.avgBuyPrice)
          : holding.avgBuyPrice.toString(),
        recurringAmount: holding.recurringAmount ? String(holding.recurringAmount) : "",
        interestRate: holding.interestRate ? String(holding.interestRate) : "",
        maturityDate: holding.maturityDate ? holding.maturityDate.slice(0, 10) : "",
      });
    }
  }, [open, holding, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!holding) return;
    const isRD = holding.assetClass === "RECURRING_DEPOSIT";
    if (isRD) {
      if (!values.recurringAmount || Number(values.recurringAmount) <= 0) { toast.error("Enter monthly installment"); return; }
      if (!values.interestRate || Number(values.interestRate) <= 0) { toast.error("Enter interest rate"); return; }
      if (!values.maturityDate) { toast.error("Select maturity date"); return; }
      try {
        await patchJson(`/api/investments/${holding.id}`, {
          recurringAmount: Number(values.recurringAmount),
          interestRate: Number(values.interestRate),
          maturityDate: values.maturityDate,
        });
        toast.success("RD schedule updated");
        onOpenChange(false);
        mutate("/api/investments");
        mutate("/api/recurring");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
      return;
    }
    if (!values.units || Number(values.units) <= 0) { toast.error("Enter valid units"); return; }
    if (!values.pricePerUnit || Number(values.pricePerUnit) <= 0) { toast.error("Enter valid price"); return; }

    try {
      // For simplicity, we'll call the edit API with the holding ID
      // The API will find the most recent BUY trade and update it
      const isAmountOnly = ["FIXED_DEPOSIT", "BOND"].includes(holding.type) || holding.assetClass === "RECURRING_DEPOSIT";
      await patchJson(`/api/investments/${holding.id}`, {
        tradeId: "latest", // special value — API will find latest trade
        ...(isAmountOnly
          ? { amount: Number(values.pricePerUnit) }
          : { units: Number(values.units), pricePerUnit: Number(values.pricePerUnit) }),
      });
      toast.success("Holding updated");
      onOpenChange(false);
      mutate("/api/investments");
      mutate((key) => typeof key === "string" && key.startsWith("/api/accounts"), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  });

  if (!holding) return null;

  const isRD = holding.assetClass === "RECURRING_DEPOSIT";
  const isAmountOnly = ["FIXED_DEPOSIT", "BOND"].includes(holding.type) || isRD;
  const isSingleAmount = isAmountOnly || ["PROVIDENT_FUND", "COMMODITY"].includes(holding.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit — {holding.name}</DialogTitle>
          <DialogDescription>
            {holding.symbol} · {isRD ? "Update RD schedule." : isAmountOnly ? "Update invested amount." : "Update units or buy price."} {!isRD && "Linked transaction will be adjusted."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {isRD ? (
            <>
              <div className="space-y-1.5">
                <Label>Monthly installment</Label>
                <Input inputMode="decimal" {...form.register("recurringAmount")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Interest %</Label>
                  <Input inputMode="decimal" {...form.register("interestRate")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Maturity</Label>
                  <Input type="date" {...form.register("maturityDate")} />
                </div>
              </div>
            </>
          ) : !isSingleAmount && (
            <div className="space-y-1.5">
              <Label>Units</Label>
              <Input inputMode="decimal" {...form.register("units")} />
            </div>
          )}
          {!isRD && (
            <>
              <div className="space-y-1.5">
                <Label>{isSingleAmount ? "Total amount" : "Average buy price"}</Label>
                <Input inputMode="decimal" {...form.register("pricePerUnit")} />
              </div>
              <p className="text-xs text-muted-foreground">
                If a bank transaction was linked, its amount will be adjusted to match the new value.
              </p>
            </>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Update"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
