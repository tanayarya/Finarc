"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mutate } from "swr";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { accountCreateSchema } from "@/lib/validators";
import { postJson } from "@/lib/fetcher";
import { CURRENCIES } from "@/lib/currencies";
import { useCurrency } from "@/components/currency-provider";
import type { z } from "zod";

type FormValues = z.input<typeof accountCreateSchema>;

interface Props {
  trigger: React.ReactNode;
}

export function AccountDialog({ trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const { currency: defaultCurrency } = useCurrency();

  const form = useForm<FormValues>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      name: "",
      type: "SAVINGS",
      currency: defaultCurrency,
      openingBalance: "0",
      savingsInterestFrequency: "QUARTERLY",
    },
  });
  const type = form.watch("type");

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        type: "SAVINGS",
        currency: defaultCurrency,
        openingBalance: "0",
        savingsInterestRate: undefined,
        savingsInterestFrequency: "QUARTERLY",
      });
    }
  }, [open, defaultCurrency, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await postJson("/api/accounts", values);
      toast.success("Account created");
      setOpen(false);
      mutate(
        (key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")),
        undefined,
        { revalidate: true }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>Once created, balance updates flow exclusively through transactions.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="HDFC Savings" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message as string}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Controller control={form.control} name="type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAVINGS">Savings</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CREDIT">Credit card</SelectItem>
                    <SelectItem value="LOAN">Loan</SelectItem>
                    <SelectItem value="INVESTMENT">Investment</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Controller control={form.control} name="currency" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openingBalance">Opening balance</Label>
            <Input id="openingBalance" inputMode="decimal" placeholder="0.00" {...form.register("openingBalance")} />
            <p className="text-xs text-muted-foreground">
              {type === "LOAN" ? "Enter outstanding loan principal." : type === "CREDIT" ? "Enter amount owed. Use a negative amount for prepaid/extra credit balance." : "Current balance at the time of adding this account."}
            </p>
            {form.formState.errors.openingBalance ? (
              <p className="text-xs text-destructive">{form.formState.errors.openingBalance.message as string}</p>
            ) : null}
          </div>

          {type === "CREDIT" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Credit limit</Label><Input inputMode="decimal" placeholder="0.00" {...form.register("creditLimit")} /></div>
              <div className="space-y-1.5"><Label>Statement day</Label><Input type="number" min={1} max={28} {...form.register("statementDay", { valueAsNumber: true })} /></div>
              <div className="space-y-1.5"><Label>Due day</Label><Input type="number" min={1} max={28} {...form.register("dueDay", { valueAsNumber: true })} /></div>
            </div>
          ) : null}

          {type === "LOAN" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Original principal</Label><Input inputMode="decimal" placeholder="0.00" {...form.register("loanPrincipal")} /></div>
              <div className="space-y-1.5"><Label>End date</Label><Input type="date" {...form.register("loanEndDate")} /></div>
            </div>
          ) : null}

          {type === "SAVINGS" ? (
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label>Savings interest % p.a.</Label>
                <Input inputMode="decimal" placeholder="2.50" {...form.register("savingsInterestRate")} />
              </div>
              <div className="space-y-1.5">
                <Label>Interest credit</Label>
                <Controller control={form.control} name="savingsInterestFrequency" render={({ field }) => (
                  <Select value={field.value ?? "QUARTERLY"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Finarc estimates interest from daily balances and asks for approval before posting income.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5"><Label htmlFor="institution">Institution</Label><Input id="institution" placeholder="Optional" {...form.register("institution")} /></div>
          <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={2} {...form.register("notes")} /></div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating..." : "Create account"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
