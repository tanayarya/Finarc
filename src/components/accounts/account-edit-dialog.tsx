"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mutate } from "swr";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountUpdateSchema } from "@/lib/validators";
import { patchJson } from "@/lib/fetcher";
import type { AccountWithBalance } from "@/hooks/use-data";
import type { z } from "zod";

type FormValues = z.input<typeof accountUpdateSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountWithBalance | null;
}

export function AccountEditDialog({ open, onOpenChange, account }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(accountUpdateSchema),
    defaultValues: {
      name: account?.name ?? "",
      creditLimit: account?.creditLimit ?? undefined,
      statementDay: account?.statementDay ?? undefined,
      dueDay: account?.dueDay ?? undefined,
      institution: account?.institution ?? "",
      notes: account?.notes ?? "",
      savingsInterestRate: account?.savingsInterestRate ?? undefined,
      savingsInterestFrequency: account?.savingsInterestFrequency ?? "QUARTERLY",
    },
  });

  React.useEffect(() => {
    if (open && account) {
      form.reset({
        name: account.name,
        creditLimit: account.creditLimit ?? undefined,
        statementDay: account.statementDay ?? undefined,
        dueDay: account.dueDay ?? undefined,
        institution: account.institution ?? "",
        notes: account.notes ?? "",
        savingsInterestRate: account.savingsInterestRate ?? undefined,
        savingsInterestFrequency: account.savingsInterestFrequency ?? "QUARTERLY",
      });
    }
  }, [open, account, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!account) return;
    try {
      await patchJson(`/api/accounts/${account.id}`, values);
      toast.success("Account updated");
      onOpenChange(false);
      mutate((key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
          <DialogDescription>Update account details. Balance is managed through transactions.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...form.register("name")} />
          </div>
          {account?.type === "CREDIT" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Credit limit</Label>
                <Input inputMode="decimal" {...form.register("creditLimit")} />
              </div>
              <div className="space-y-1.5">
                <Label>Statement day</Label>
                <Input type="number" min={1} max={28} {...form.register("statementDay", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Due day</Label>
                <Input type="number" min={1} max={28} {...form.register("dueDay", { valueAsNumber: true })} />
              </div>
            </div>
          )}
          {account?.type === "SAVINGS" && (
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
                Interest appears as a dashboard review before Finarc records income.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Institution</Label>
            <Input {...form.register("institution")} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} {...form.register("notes")} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
