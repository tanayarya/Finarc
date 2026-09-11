"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mutate } from "swr";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { recurringCreateSchema } from "@/lib/validators";
import { fetcher, postJson, patchJson } from "@/lib/fetcher";
import { useAccounts, useCategories } from "@/hooks/use-data";
import type { z } from "zod";

type FormValues = z.input<typeof recurringCreateSchema>;

interface EditRule {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  startDate: string;
  endDate: string | null;
  description: string | null;
  account: { id: string } | null;
  toAccount: { id: string } | null;
  category: { id: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editRule?: EditRule | null;
}

export function RecurringDialog({ open, onOpenChange, editRule }: Props) {
  const { data: accounts } = useAccounts();
  const { data: expenseCats } = useCategories("EXPENSE");
  const { data: incomeCats } = useCategories("INCOME");
  const isEdit = Boolean(editRule);

  const form = useForm<FormValues>({
    resolver: zodResolver(recurringCreateSchema),
    defaultValues: getDefaults(editRule),
  });

  const type = form.watch("type");

  React.useEffect(() => {
    if (open) form.reset(getDefaults(editRule));
  }, [open, editRule, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = values.type === "CREDIT_PAYMENT"
        ? { ...values, amount: "0", frequency: "MONTHLY" as const, interval: 1, categoryId: null }
        : values;
      if (isEdit && editRule) {
        await patchJson(`/api/recurring/${editRule.id}`, {
          name: payload.name,
          amount: payload.amount,
          frequency: payload.frequency,
          interval: payload.interval,
          endDate: payload.endDate,
          description: payload.description,
        });
        toast.success("Rule updated");
      } else {
        await postJson("/api/recurring", payload);
        toast.success("Recurring rule created");
      }
      onOpenChange(false);
      mutate("/api/recurring");
      mutate("/api/commitments/forecast");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  });

  const assetAccounts = (accounts ?? []).filter((a) => ["SAVINGS", "CASH"].includes(a.type));
  const allAccounts = (accounts ?? []).filter((a) => a.type !== "LOAN");
  const creditAccounts = (accounts ?? []).filter((a) => a.type === "CREDIT");
  const loanAccounts = (accounts ?? []).filter((a) => a.type === "LOAN");
  const cats = type === "INCOME" ? incomeCats : expenseCats;

  const [creditDue, setCreditDue] = React.useState<string | null>(null);
  const selectedToAccount = form.watch("toAccountId");
  const startDate = form.watch("startDate");
  React.useEffect(() => {
    if (type === "CREDIT_PAYMENT" && selectedToAccount) {
      form.setValue("amount", "0");
      fetcher<{ amount: string }>(`/api/credit-cards/statement-due?accountId=${encodeURIComponent(selectedToAccount)}&date=${encodeURIComponent(new Date(startDate ?? new Date()).toISOString())}`)
        .then((data) => setCreditDue(data.amount))
        .catch(() => setCreditDue("0.00"));
    } else {
      setCreditDue(null);
    }
  }, [type, selectedToAccount, startDate, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit recurring rule" : "New recurring rule"}</DialogTitle>
          <DialogDescription>Automate repeating income, expenses, or transfers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Monthly salary" {...form.register("name")} />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Controller control={form.control} name="type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                    <SelectItem value="CREDIT_PAYMENT">Credit Card Payment</SelectItem>
                    <SelectItem value="LOAN_PAYMENT">Loan EMI</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          )}

          {!isEdit && type === "CREDIT_PAYMENT" && (
            <div className="space-y-1.5">
              <Label>Credit card account</Label>
              <Controller control={form.control} name="toAccountId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                  <SelectContent>{creditAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                </Select>
              )} />
            </div>
          )}

          {type !== "CREDIT_PAYMENT" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Controller control={form.control} name="frequency" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Every</Label>
                <Input type="number" min={1} max={365} {...form.register("interval", { valueAsNumber: true })} />
              </div>
            </div>
          </div>
          ) : null}

          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Controller control={form.control} name="startDate" render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value), "PP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(d) => field.onChange(d ?? new Date())} />
                    </PopoverContent>
                  </Popover>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>{type === "CREDIT_PAYMENT" ? "Debit account" : "Account"}</Label>
                <Controller control={form.control} name="accountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{(type === "TRANSFER" || type === "CREDIT_PAYMENT" || type === "LOAN_PAYMENT" ? assetAccounts : allAccounts).map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          )}

          {!isEdit && (type === "TRANSFER" || type === "LOAN_PAYMENT") && (
            <div className="space-y-1.5">
              <Label>{type === "LOAN_PAYMENT" ? "Loan account" : "To account"}</Label>
              <Controller control={form.control} name="toAccountId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                  <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                  <SelectContent>{(type === "LOAN_PAYMENT" ? loanAccounts : allAccounts).map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                </Select>
              )} />
            </div>
          )}

          {!isEdit && type !== "TRANSFER" && type !== "CREDIT_PAYMENT" && type !== "LOAN_PAYMENT" && (
            <div className="space-y-1.5">
              <Label>Category (optional)</Label>
              <Controller control={form.control} name="categoryId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{(cats ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                </Select>
              )} />
            </div>
          )}

          {!isEdit && type === "CREDIT_PAYMENT" && (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Statement due on selected run date</p>
              <p className="tabular text-lg font-semibold">₹{creditDue ?? "0.00"}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                This is a preview. When the rule runs, Finarc recalculates the actual statement balance and pays that amount.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input {...form.register("description")} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaults(edit?: EditRule | null): FormValues {
  if (edit) {
    return {
      name: edit.name,
      type: edit.type,
      amount: edit.amount,
      frequency: edit.frequency,
      interval: edit.interval,
      startDate: new Date(edit.startDate),
      endDate: edit.endDate ? new Date(edit.endDate) : undefined,
      description: edit.description ?? "",
      accountId: edit.account?.id ?? null,
      toAccountId: edit.toAccount?.id ?? null,
      categoryId: edit.category?.id ?? null,
    };
  }
  return {
    name: "",
    type: "EXPENSE",
    amount: "",
    frequency: "MONTHLY",
    interval: 1,
    startDate: new Date(),
    description: "",
    accountId: null,
    toAccountId: null,
    categoryId: null,
  };
}
