"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mutate } from "swr";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { transactionCreateSchema } from "@/lib/validators";
import { postJson, patchJson } from "@/lib/fetcher";
import { useAccounts, useCategories, type TransactionRow } from "@/hooks/use-data";
import type { z } from "zod";

type FormValues = z.input<typeof transactionCreateSchema> & { taxDeductible?: boolean };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "INCOME" | "EXPENSE" | "TRANSFER" | "CREDIT_PAYMENT" | "LOAN_PAYMENT";
  defaultAccountId?: string;
  /** If provided, dialog is in edit mode */
  editTransaction?: TransactionRow | null;
}

export function TransactionDialog({
  open,
  onOpenChange,
  defaultType = "EXPENSE",
  defaultAccountId,
  editTransaction,
}: Props) {
  const { data: accounts } = useAccounts();
  const { data: expenseCats } = useCategories("EXPENSE");
  const { data: incomeCats } = useCategories("INCOME");
  const isEdit = Boolean(editTransaction);

  const form = useForm<FormValues>({
    resolver: zodResolver(transactionCreateSchema),
    defaultValues: getDefaults(defaultType, defaultAccountId, editTransaction),
  });

  const type = form.watch("type");

  React.useEffect(() => {
    if (open) {
      form.reset(getDefaults(defaultType, defaultAccountId, editTransaction));
    }
  }, [open, defaultType, defaultAccountId, editTransaction, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && editTransaction) {
        await patchJson(`/api/transactions/${editTransaction.id}`, {
          amount: values.amount,
          occurredAt: values.occurredAt,
          description: values.description,
          notes: values.notes,
          categoryId: values.categoryId,
          taxDeductible: values.taxDeductible ?? false,
        });
        toast.success("Transaction updated");
      } else {
        await postJson("/api/transactions", values);
        toast.success("Transaction recorded");
      }
      onOpenChange(false);
      mutate(
        (key) =>
          typeof key === "string" &&
          (key.startsWith("/api/transactions") ||
            key.startsWith("/api/accounts") ||
            key.startsWith("/api/budgets") ||
            key.startsWith("/api/dashboard")),
        undefined,
        { revalidate: true }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save transaction");
    }
  });

  const assetAccounts = (accounts ?? []).filter((a) =>
    ["SAVINGS", "CASH"].includes(a.type)
  );
  const expenseAccounts = (accounts ?? []).filter((a) =>
    ["SAVINGS", "CASH", "CREDIT"].includes(a.type)
  );
  const incomeAccounts = (accounts ?? []).filter((a) => a.type !== "LOAN");
  const transferAccounts = (accounts ?? []).filter((a) => a.type !== "LOAN");
  const creditAccounts = (accounts ?? []).filter((a) => a.type === "CREDIT");
  const loanAccounts = (accounts ?? []).filter((a) => a.type === "LOAN");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit transaction" : "New transaction"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the amount, date, description, or category."
              : "Record income, expenses, transfers, or credit and loan payments."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {!isEdit && (
            <Controller
              name="type"
              control={form.control}
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={(v) => field.onChange(v)}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="EXPENSE">Expense</TabsTrigger>
                    <TabsTrigger value="INCOME">Income</TabsTrigger>
                    <TabsTrigger value="TRANSFER">Transfer</TabsTrigger>
                    <TabsTrigger value="CREDIT_PAYMENT">Credit</TabsTrigger>
                    <TabsTrigger value="LOAN_PAYMENT">Loan</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message as string}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Controller
                control={form.control}
                name="occurredAt"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value), "PP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(d) => field.onChange(d ?? new Date())}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
          </div>

          {!isEdit && type === "EXPENSE" && (
            <>
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Controller
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {expenseAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} <span className="ml-2 text-xs text-muted-foreground">{a.type}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                      <SelectContent>
                        {(expenseCats ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          )}

          {!isEdit && type === "INCOME" && (
            <>
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Controller control={form.control} name="accountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{incomeAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Source (optional)</Label>
                <Controller control={form.control} name="categoryId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Choose source" /></SelectTrigger>
                    <SelectContent>{(incomeCats ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
            </>
          )}

          {!isEdit && type === "TRANSFER" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Controller control={form.control} name="fromAccountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>{transferAccounts.filter((a) => a.type !== "CREDIT").map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Controller control={form.control} name="toAccountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                    <SelectContent>{transferAccounts.filter((a) => a.type !== "CREDIT").map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          )}

          {!isEdit && type === "CREDIT_PAYMENT" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From (asset)</Label>
                <Controller control={form.control} name="fromAccountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>{assetAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Credit account</Label>
                <Controller control={form.control} name="toAccountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Credit card" /></SelectTrigger>
                    <SelectContent>{creditAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          )}

          {!isEdit && type === "LOAN_PAYMENT" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From (asset)</Label>
                <Controller control={form.control} name="fromAccountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>{assetAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Loan account</Label>
                <Controller control={form.control} name="toAccountId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Loan" /></SelectTrigger>
                    <SelectContent>{loanAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          )}

          {/* Category selector in edit mode */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller control={form.control} name="categoryId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                  <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                  <SelectContent>
                    {[...(expenseCats ?? []), ...(incomeCats ?? [])].map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" placeholder="What is this for?" {...form.register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>

          {(type === "EXPENSE" || type === "INCOME" || isEdit) && (
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="taxDeductible"
                render={({ field }) => (
                  <Checkbox
                    id="taxDeductible"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="taxDeductible" className="text-sm font-normal cursor-pointer">
                Mark as tax deductible
              </Label>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : isEdit ? "Update" : "Save transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaults(
  defaultType: string,
  defaultAccountId?: string,
  edit?: TransactionRow | null
): FormValues {
  if (edit) {
    return {
      type: edit.type,
      amount: edit.amount,
      occurredAt: new Date(edit.occurredAt),
      description: edit.description ?? "",
      notes: "",
      accountId: edit.account?.id ?? null,
      fromAccountId: edit.fromAccount?.id ?? null,
      toAccountId: edit.toAccount?.id ?? null,
      categoryId: edit.category?.id ?? null,
      taxDeductible: edit.taxDeductible ?? false,
    };
  }
  return {
    type: defaultType as FormValues["type"],
    amount: "",
    occurredAt: new Date(),
    description: "",
    notes: "",
    accountId: defaultAccountId ?? null,
    fromAccountId: null,
    toAccountId: null,
    categoryId: null,
    taxDeductible: false,
  };
}
