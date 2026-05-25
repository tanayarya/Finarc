"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mutate } from "swr";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { budgetUpdateSchema } from "@/lib/validators";
import { patchJson } from "@/lib/fetcher";
import type { BudgetWithProgress } from "@/hooks/use-data";
import type { z } from "zod";

type FormValues = z.input<typeof budgetUpdateSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetWithProgress | null;
}

export function BudgetEditDialog({ open, onOpenChange, budget }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(budgetUpdateSchema),
    defaultValues: { amount: budget?.allocated ?? "", period: budget?.period ?? "MONTHLY" },
  });

  React.useEffect(() => {
    if (open && budget) {
      form.reset({ amount: budget.allocated, period: budget.period });
    }
  }, [open, budget, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!budget) return;
    try {
      await patchJson(`/api/budgets/${budget.id}`, values);
      toast.success("Budget updated");
      onOpenChange(false);
      mutate((key) => typeof key === "string" && (key.startsWith("/api/budgets") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Edit budget</DialogTitle>
          <DialogDescription>Update the amount or period for {budget?.category.name}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input inputMode="decimal" {...form.register("amount")} />
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Controller control={form.control} name="period" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
