"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { mutate } from "swr";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  bondPayoutDay?: number | null;
  bondTdsRate?: number | null;
  recurringAmount?: number | null;
}

interface FormValues {
  units: string;
  pricePerUnit: string;
  recurringAmount: string;
  interestRate: string;
  interestFreq: string;
  maturityDate: string;
  bondPayoutDay: string;
  bondTdsRate: string;
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
    defaultValues: { units: "", pricePerUnit: "", recurringAmount: "", interestRate: "", interestFreq: "YEARLY", maturityDate: "", bondPayoutDay: "", bondTdsRate: "10" },
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
        interestFreq: holding.interestFreq ?? "YEARLY",
        maturityDate: holding.maturityDate ? holding.maturityDate.slice(0, 10) : "",
        bondPayoutDay: holding.bondPayoutDay ? String(holding.bondPayoutDay) : "",
        bondTdsRate: holding.bondTdsRate !== null && holding.bondTdsRate !== undefined ? String(holding.bondTdsRate) : "10",
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
      if (holding.type === "BOND") {
        if (!values.interestRate || Number(values.interestRate) <= 0) { toast.error("Enter interest rate"); return; }
        await patchJson(`/api/investments/${holding.id}`, {
          interestRate: Number(values.interestRate),
          interestFreq: values.interestFreq,
          maturityDate: values.maturityDate || undefined,
          bondPayoutDay: ["MONTHLY", "QUARTERLY"].includes(values.interestFreq) && values.bondPayoutDay ? Number(values.bondPayoutDay) : null,
          bondTdsRate: values.bondTdsRate !== "" ? Number(values.bondTdsRate) : 10,
        });
      }
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
              {holding.type === "BOND" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Interest %</Label>
                    <Input inputMode="decimal" {...form.register("interestRate")} />
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
                  {["MONTHLY", "QUARTERLY"].includes(form.watch("interestFreq")) ? (
                    <div className="space-y-1.5">
                      <Label>Payout day</Label>
                      <Input type="number" min={1} max={31} {...form.register("bondPayoutDay")} />
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label>TDS %</Label>
                    <Input inputMode="decimal" {...form.register("bondTdsRate")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Maturity</Label>
                    <Input type="date" {...form.register("maturityDate")} />
                  </div>
                </div>
              ) : null}
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
