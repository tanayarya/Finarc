"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { ArrowLeft, Archive, ArchiveRestore, Plus, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { AccountEditDialog } from "@/components/accounts/account-edit-dialog";
import { useConfirm } from "@/components/confirm-provider";
import { useCurrency } from "@/components/currency-provider";
import { delJson, patchJson } from "@/lib/fetcher";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionRow as TxRow, AccountWithBalance } from "@/hooks/use-data";

interface DetailsResponse {
  account: AccountWithBalance & { createdAt: string; openingBalance: string };
  balance: string;
  recentTransactions: TxRow[];
}

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useSWR<DetailsResponse>(`/api/accounts/${params.id}`);
  const [txOpen, setTxOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();

  if (isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );

  if (!data)
    return (
      <EmptyState
        title="Account not found"
        description="It may have been removed."
        action={<Button asChild variant="outline"><Link href="/accounts">Back to accounts</Link></Button>}
      />
    );

  const a = data.account;
  const balance = Number(data.balance);
  const limit = a.creditLimit ? Number(a.creditLimit) : null;
  const util = limit && limit > 0 ? balance / limit : null;

  const onArchive = async () => {
    const ok = await confirm({
      title: `Archive "${a.name}"?`,
      description: "The account will be hidden from lists but all transactions will be preserved. You can restore it later.",
      confirmLabel: "Archive",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await delJson(`/api/accounts/${a.id}`);
      toast.success("Account archived");
      mutate("/api/accounts");
      window.location.href = "/accounts";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    }
  };

  const onRestore = async () => {
    try {
      await patchJson(`/api/accounts/${a.id}`, { archived: false });
      toast.success("Account restored");
      mutate((key) => typeof key === "string" && key.startsWith("/api/accounts"), undefined, { revalidate: true });
      mutate(`/api/accounts/${a.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const defaultType = a.type === "CREDIT" ? "EXPENSE" : a.type === "LOAN" ? "LOAN_PAYMENT" : "EXPENSE";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link href="/accounts"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Back</span></Link></Button>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{a.name}</h2>
        <Badge variant="muted" className="ml-2">{a.type}</Badge>
        {a.archived ? <Badge variant="warning">Archived</Badge> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Current balance</CardDescription>
              <Badge variant="muted">{a.currency}</Badge>
            </div>
            <p className="tabular text-xl font-semibold sm:text-3xl">{formatCurrency(balance)}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Opening balance</p><p className="tabular font-medium">{formatCurrency(a.openingBalance)}</p></div>
              <div><p className="text-xs text-muted-foreground">Currency</p><p className="font-medium">{a.currency}</p></div>
              {a.institution ? <div><p className="text-xs text-muted-foreground">Institution</p><p className="font-medium">{a.institution}</p></div> : null}
              {a.dueDay ? <div><p className="text-xs text-muted-foreground">Due day</p><p className="font-medium">{a.dueDay}</p></div> : null}
              {a.type === "SAVINGS" && a.savingsInterestRate ? (
                <div>
                  <p className="text-xs text-muted-foreground">Savings interest</p>
                  <p className="font-medium">{a.savingsInterestRate}% · {(a.savingsInterestFrequency ?? "QUARTERLY").toLowerCase()}</p>
                </div>
              ) : null}
            </div>
            {util !== null ? (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs"><span>Utilization</span><span className="tabular">{formatPercent(util)}</span></div>
                  <Progress value={Math.min(100, util * 100)} />
                  <p className="text-xs text-muted-foreground">{formatCurrency(balance)} of {formatCurrency(limit!)}</p>
                </div>
              </>
            ) : null}
            {a.notes ? <><Separator /><p className="text-sm text-muted-foreground">{a.notes}</p></> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start gap-2" onClick={() => setTxOpen(true)} disabled={a.archived}><Plus className="h-4 w-4" /> Record transaction</Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit account</Button>
            {a.archived ? (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={onRestore}><ArchiveRestore className="h-4 w-4" /> Restore account</Button>
            ) : (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={onArchive}><Archive className="h-4 w-4" /> Archive account</Button>
            )}
            <p className="pt-2 text-xs text-muted-foreground">{a.archived ? "Archived accounts are hidden from active lists, but their ledger stays preserved." : "Manual balance editing is intentionally disabled. Adjustments must flow through transactions."}</p>
          </CardContent>
        </Card>
      </div>

      <TransactionDialog open={txOpen} onOpenChange={setTxOpen} defaultType={defaultType as never} defaultAccountId={a.id} />
      <AccountEditDialog open={editOpen} onOpenChange={setEditOpen} account={a} />

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent activity</CardTitle><CardDescription>Latest transactions for this account</CardDescription></CardHeader>
        <CardContent className="px-0">
          {data.recentTransactions.length === 0 ? (
            <div className="px-6"><EmptyState title="Quiet so far" description="No transactions yet." /></div>
          ) : (
            <ul className="divide-y">{data.recentTransactions.map((t) => (<li key={t.id} className="px-4"><TransactionRow tx={t} /></li>))}</ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">Account created {format(new Date(a.createdAt), "PP")}</p>
    </div>
  );
}
