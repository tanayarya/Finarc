"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { ArrowLeft, Archive, ArchiveRestore, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { AccountEditDialog } from "@/components/accounts/account-edit-dialog";
import { AccountInsights, type AccountPeriodInsights } from "@/components/accounts/account-insights";
import { buildRangeQuery, type RangeValue } from "@/components/dashboard/range-picker";
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
  insights: AccountPeriodInsights | null;
}

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const [range, setRange] = React.useState<RangeValue>({ kind: "MONTH" });
  const rangeQuery = buildRangeQuery(range);
  const { data, isLoading } = useSWR<DetailsResponse>(`/api/accounts/${params.id}?${rangeQuery}`, { keepPreviousData: true });
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
  const availableCredit = limit === null ? null : limit - balance;
  const insightAccountType = a.type === "SAVINGS" || a.type === "CREDIT" ? a.type : null;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon"><Link href="/accounts"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Back</span></Link></Button>
          <h2 className="truncate text-xl font-semibold tracking-tight md:text-2xl">{a.name}</h2>
          <Badge variant="muted" className="ml-2">{a.type}</Badge>
          {a.archived ? <Badge variant="warning">Archived</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} aria-label="Edit account"><Pencil className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>Edit account</TooltipContent>
          </Tooltip>
          {a.archived ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={onRestore}><ArchiveRestore className="h-4 w-4" /> Restore</Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={onArchive}><Archive className="h-4 w-4" /> Archive</Button>
          )}
        </div>
      </div>

      <div>
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current balance</p>
                <p className="mt-1 tabular text-xl font-semibold sm:text-3xl">{formatCurrency(balance)}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Currency</p><p className="font-medium">{a.currency}</p></div>
                {a.type === "CREDIT" && limit !== null ? <div><p className="text-xs text-muted-foreground">Credit limit</p><p className="tabular font-medium">{formatCurrency(limit)}</p></div> : null}
                {a.type === "CREDIT" && availableCredit !== null ? <div><p className="text-xs text-muted-foreground">Available credit</p><p className="tabular font-medium">{formatCurrency(availableCredit)}</p></div> : null}
                {a.type === "CREDIT" && a.statementDay ? <div><p className="text-xs text-muted-foreground">Statement day</p><p className="font-medium">{a.statementDay}</p></div> : null}
                {a.type === "CREDIT" && a.dueDay ? <div><p className="text-xs text-muted-foreground">Due day</p><p className="font-medium">{a.dueDay}</p></div> : null}
                {a.type === "SAVINGS" && a.savingsInterestRate ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Savings interest</p>
                    <p className="font-medium">{a.savingsInterestRate}% · {(a.savingsInterestFrequency ?? "QUARTERLY").toLowerCase()}</p>
                  </div>
                ) : null}
                {a.type === "SAVINGS" ? <div><p className="text-xs text-muted-foreground">Account opened</p><p className="font-medium">{format(new Date(a.createdAt), "MMM yyyy")}</p></div> : null}
              </div>
            </div>
            {a.institution ? (
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-3">
                {a.institution ? <div><p className="text-xs text-muted-foreground">Institution</p><p className="font-medium">{a.institution}</p></div> : null}
              </div>
            ) : null}
            {util !== null ? (
              <>
                <Separator className="my-4" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs"><span>Utilization</span><span className="tabular">{formatPercent(util)}</span></div>
                  <Progress value={Math.min(100, util * 100)} />
                  <p className="text-xs text-muted-foreground">{formatCurrency(balance)} of {formatCurrency(limit!)}</p>
                </div>
              </>
            ) : null}
            {a.notes ? <><Separator className="my-4" /><p className="text-sm text-muted-foreground">{a.notes}</p></> : null}
          </CardContent>
        </Card>
      </div>

      {insightAccountType && data.insights ? (
        <AccountInsights
          accountType={insightAccountType}
          balance={balance}
          creditLimit={limit}
          insights={data.insights}
          range={range}
          onRangeChange={setRange}
        />
      ) : null}

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
