"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { mutate } from "swr";
import { addMonths, format } from "date-fns";
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
import { postJson } from "@/lib/fetcher";
import { useAccounts } from "@/hooks/use-data";
import { useCurrency } from "@/components/currency-provider";

interface HoldingItem {
  id: string;
  symbol: string;
  name: string;
  accountId: string;
  accountName: string;
  recurringAmount?: number | null;
}

interface FormValues {
  amount: string;
  frequency: "MONTHLY" | "WEEKLY" | "YEARLY";
  startDate: Date;
  accountId: string;
}

export function SipDialog({
  open,
  onOpenChange,
  holding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: HoldingItem | null;
}) {
  const { data: accounts } = useAccounts();
  const { formatCurrency } = useCurrency();

  const form = useForm<FormValues>({
    defaultValues: {
      amount: "",
      frequency: "MONTHLY",
      startDate: addMonths(new Date(), 1),
      accountId: "",
    },
  });

  React.useEffect(() => {
    if (open && holding) {
      form.reset({
        amount: holding.recurringAmount ? String(holding.recurringAmount) : "",
        frequency: "MONTHLY",
        startDate: addMonths(new Date(), 1),
        accountId: holding.accountId,
      });
    }
  }, [open, holding, form]);

  const sourceAccounts = (accounts ?? []).filter((a) => ["SAVINGS", "CASH", "INVESTMENT"].includes(a.type));

  const onSubmit = form.handleSubmit(async (values) => {
    if (!holding) return;
    if (holding.recurringAmount) {
      toast.error("SIP is already active for this fund");
      return;
    }
    if (!values.amount || Number(values.amount) <= 0) {
      toast.error("Enter SIP amount");
      return;
    }
    if (!values.accountId) {
      toast.error("Select debit account");
      return;
    }

    try {
      await postJson("/api/recurring", {
        name: `SIP: ${holding.name}`,
        type: "EXPENSE",
        amount: values.amount,
        frequency: values.frequency,
        interval: 1,
        startDate: values.startDate,
        description: `Recurring Mutual Fund contribution`,
        accountId: values.accountId,
        holdingId: holding.id,
      });
      toast.success("SIP set up");
      onOpenChange(false);
      mutate("/api/investments");
      mutate("/api/recurring");
      mutate((key) => typeof key === "string" && (key.startsWith("/api/accounts") || key.startsWith("/api/dashboard")), undefined, { revalidate: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set up SIP");
    }
  });

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Set up SIP</DialogTitle>
          <DialogDescription>
            {holding.name} · future units will be added to this holding.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Fund</span>
              <span className="truncate font-medium">{holding.symbol}</span>
            </div>
            {holding.recurringAmount ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                SIP already active at {formatCurrency(holding.recurringAmount)}.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SIP amount</Label>
              <Input inputMode="decimal" placeholder="5000" {...form.register("amount")} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Controller control={form.control} name="frequency" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First debit date</Label>
              <Controller control={form.control} name="startDate" render={({ field }) => (
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
            <div className="space-y-1.5">
              <Label>Debit account</Label>
              <Controller control={form.control} name="accountId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Cash will be debited only when the applicable NAV is available, then units are credited as an investment buy.
          </p>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting || Boolean(holding.recurringAmount)}>
              {form.formState.isSubmitting ? "Saving..." : "Set up SIP"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
