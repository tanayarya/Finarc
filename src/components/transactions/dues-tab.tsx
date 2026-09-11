"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { Plus, Check, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/components/confirm-provider";
import { useCurrency } from "@/components/currency-provider";
import { useAccounts } from "@/hooks/use-data";
import { postJson, delJson, patchJson } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface DueItem {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  personName: string;
  amount: string;
  amountSettled: string;
  description: string | null;
  dueDate: string | null;
  status: "PENDING" | "PARTIAL" | "SETTLED";
  account: { id: string; name: string };
  notes: string | null;
  createdAt: string;
}

export function DuesTab() {
  const { data: dues, isLoading } = useSWR<DueItem[]>("/api/dues");
  const { formatCurrency } = useCurrency();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [settleId, setSettleId] = React.useState<string | null>(null);

  const receivables = (dues ?? []).filter((d) => d.type === "RECEIVABLE" && d.status !== "SETTLED");
  const payables = (dues ?? []).filter((d) => d.type === "PAYABLE" && d.status !== "SETTLED");
  const settled = (dues ?? []).filter((d) => d.status === "SETTLED");

  const totalReceivable = receivables.reduce((s, d) => s + Number(d.amount) - Number(d.amountSettled), 0);
  const totalPayable = payables.reduce((s, d) => s + Number(d.amount) - Number(d.amountSettled), 0);

  const onDelete = async (d: DueItem) => {
    const ok = await confirm({
      title: `Delete this ${d.type === "RECEIVABLE" ? "receivable" : "payable"}?`,
      description: `${d.personName} — ${formatCurrency(d.amount)}. The linked transaction will NOT be reversed.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await delJson(`/api/dues/${d.id}`);
      toast.success("Removed");
      mutate("/api/dues");
      mutate("/api/commitments/forecast");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const onSettle = async (id: string, amount?: string) => {
    try {
      await patchJson(`/api/dues/${id}`, { action: "settle", amount });
      toast.success("Settlement recorded");
      mutate("/api/dues");
      mutate("/api/commitments/forecast");
      mutate((key) => typeof key === "string" && key.startsWith("/api/accounts"), undefined, { revalidate: true });
      setSettleId(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">They owe me</CardTitle></CardHeader>
          <CardContent><p className="tabular text-lg font-semibold sm:text-2xl text-emerald-600">{formatCurrency(totalReceivable)}</p><p className="text-xs text-muted-foreground">{receivables.length} pending</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">I owe them</CardTitle></CardHeader>
          <CardContent><p className="tabular text-lg font-semibold sm:text-2xl text-rose-600">{formatCurrency(totalPayable)}</p><p className="text-xs text-muted-foreground">{payables.length} pending</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Net</CardTitle></CardHeader>
          <CardContent><p className={cn("tabular text-lg font-semibold sm:text-2xl", totalReceivable - totalPayable >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(totalReceivable - totalPayable)}</p></CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add due
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)}</div>
      ) : (dues ?? []).length === 0 ? (
        <EmptyState title="No dues" description="Track money you've lent or borrowed." action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add due</Button>} />
      ) : (
        <div className="space-y-4">
          {receivables.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-medium flex items-center gap-2"><AlertCircle className="h-4 w-4 text-emerald-600" /> They owe me</h3>
              <div className="space-y-2">
                {receivables.map((d) => <DueCard key={d.id} due={d} formatCurrency={formatCurrency} onSettle={() => setSettleId(d.id)} onDelete={() => onDelete(d)} />)}
              </div>
            </section>
          )}
          {payables.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-medium flex items-center gap-2"><AlertCircle className="h-4 w-4 text-rose-600" /> I owe them</h3>
              <div className="space-y-2">
                {payables.map((d) => <DueCard key={d.id} due={d} formatCurrency={formatCurrency} onSettle={() => setSettleId(d.id)} onDelete={() => onDelete(d)} />)}
              </div>
            </section>
          )}
          {settled.length > 0 && (
            <section>
              <Separator className="my-3" />
              <h3 className="mb-2 text-sm font-medium flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4" /> Settled ({settled.length})</h3>
              <div className="space-y-2">
                {settled.slice(0, 5).map((d) => <DueCard key={d.id} due={d} formatCurrency={formatCurrency} onSettle={() => {}} onDelete={() => onDelete(d)} settled />)}
              </div>
            </section>
          )}
        </div>
      )}

      <CreateDueDialog open={createOpen} onOpenChange={setCreateOpen} />
      <SettleDueDialog dueId={settleId} dues={dues ?? []} onClose={() => setSettleId(null)} onSettle={onSettle} formatCurrency={formatCurrency} />
    </div>
  );
}

function DueCard({ due, formatCurrency, onSettle, onDelete, settled }: { due: DueItem; formatCurrency: (v: number | string | null | undefined) => string; onSettle: () => void; onDelete: () => void; settled?: boolean }) {
  const remaining = Number(due.amount) - Number(due.amountSettled);
  return (
    <div className={cn("flex items-center justify-between rounded-md border px-4 py-3", settled && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{due.personName}</p>
          <Badge variant={due.status === "SETTLED" ? "success" : due.status === "PARTIAL" ? "warning" : "muted"} className="text-[10px]">{due.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {due.description ?? ""}{due.dueDate ? ` · Due ${format(new Date(due.dueDate), "MMM d, yyyy")}` : ""} · {due.account.name}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={cn("tabular text-sm font-semibold", due.type === "RECEIVABLE" ? "text-emerald-600" : "text-rose-600")}>
            {formatCurrency(remaining > 0 ? remaining : due.amount)}
          </p>
          {Number(due.amountSettled) > 0 && !settled && (
            <p className="text-[10px] text-muted-foreground">Settled: {formatCurrency(due.amountSettled)}</p>
          )}
        </div>
        {!settled && (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSettle}>Settle</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={onDelete}>×</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateDueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: accounts } = useAccounts();
  const form = useForm({
    defaultValues: { type: "RECEIVABLE", personName: "", amount: "", description: "", dueDate: "", accountId: "", createTransaction: true },
  });

  React.useEffect(() => { if (open) form.reset({ type: "RECEIVABLE", personName: "", amount: "", description: "", dueDate: "", accountId: "", createTransaction: true }); }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!values.personName) { toast.error("Enter person name"); return; }
    if (!values.amount || Number(values.amount) <= 0) { toast.error("Enter amount"); return; }
    if (!values.accountId) { toast.error("Select account"); return; }
    try {
      await postJson("/api/dues", { ...values, dueDate: values.dueDate || null });
      toast.success("Due recorded");
      onOpenChange(false);
      mutate("/api/dues");
      mutate("/api/commitments/forecast");
      mutate((key) => typeof key === "string" && key.startsWith("/api/accounts"), undefined, { revalidate: true });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add due</DialogTitle>
          <DialogDescription>Track money lent or borrowed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller control={form.control} name="type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIVABLE">They owe me (I gave money)</SelectItem>
                  <SelectItem value="PAYABLE">I owe them (I received money)</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Person name</Label>
              <Input placeholder="Rahul" {...form.register("personName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input inputMode="decimal" placeholder="5000" {...form.register("amount")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Controller control={form.control} name="accountId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{(accounts ?? []).filter((a) => ["SAVINGS", "CASH"].includes(a.type)).map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date (optional)</Label>
              <Controller control={form.control} name="dueDate" render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3.5 w-3.5" />{field.value ? format(new Date(field.value), "PP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(d) => field.onChange(d ? d.toISOString() : "")} /></PopoverContent>
                </Popover>
              )} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input placeholder="Dinner split, freelance payment..." {...form.register("description")} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="createTxn" {...form.register("createTransaction")} className="h-4 w-4 rounded border" />
            <Label htmlFor="createTxn" className="text-sm font-normal cursor-pointer">Also create a transaction (deduct/add to account)</Label>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Record"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettleDueDialog({ dueId, dues, onClose, onSettle, formatCurrency }: { dueId: string | null; dues: DueItem[]; onClose: () => void; onSettle: (id: string, amount?: string) => void; formatCurrency: (v: number | string | null | undefined) => string }) {
  const due = dues.find((d) => d.id === dueId);
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (due) setAmount(String(Number(due.amount) - Number(due.amountSettled)));
  }, [due]);

  if (!due) return null;
  const remaining = Number(due.amount) - Number(due.amountSettled);

  return (
    <Dialog open={Boolean(dueId)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Settle — {due.personName}</DialogTitle>
          <DialogDescription>Remaining: {formatCurrency(remaining)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Amount to settle</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">Enter full amount for complete settlement, or partial amount.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSettle(due.id, amount)}>Confirm settlement</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
