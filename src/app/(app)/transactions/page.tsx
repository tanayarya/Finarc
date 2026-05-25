"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { Plus, Search, Trash2, Pencil, Filter, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { DuesTab } from "@/components/transactions/dues-tab";
import { useConfirm } from "@/components/confirm-provider";
import { useCurrency } from "@/components/currency-provider";
import { useAppSettings } from "@/hooks/use-settings";
import { useAccounts } from "@/hooks/use-data";
import { delJson } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/hooks/use-data";

interface ListResponse {
  items: TransactionRow[];
  total: number;
  take: number;
  skip: number;
  runningBalances: Record<string, string> | null;
}

const TYPE_LABELS = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  CREDIT_PAYMENT: "Credit payment",
  LOAN_PAYMENT: "Loan payment",
} as const;

export default function TransactionsPage() {
  const { data: accounts } = useAccounts();
  const confirm = useConfirm();
  const { formatCurrency } = useCurrency();
  const { defaultAccountId: defaultAccId } = useAppSettings();
  const [open, setOpen] = React.useState(false);
  const [editTx, setEditTx] = React.useState<TransactionRow | null>(null);
  const [type, setType] = React.useState<string>("");
  const [accountId, setAccountId] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState<Date | null>(null);
  const [dateTo, setDateTo] = React.useState<Date | null>(null);
  const [page, setPage] = React.useState(0);
  const pageSize = 50;

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (accountId) params.set("accountId", accountId);
  if (debounced) params.set("search", debounced);
  if (dateFrom) params.set("from", dateFrom.toISOString());
  if (dateTo) params.set("to", dateTo.toISOString());
  params.set("take", String(pageSize));
  params.set("skip", String(page * pageSize));

  const { data, isLoading } = useSWR<ListResponse>(`/api/transactions?${params.toString()}`);

  const onDelete = async (tx: TransactionRow) => {
    const ok = await confirm({
      title: "Delete this transaction?",
      description: `This will permanently remove the ${TYPE_LABELS[tx.type].toLowerCase()} of ${formatCurrency(tx.amount)}${tx.description ? ` — "${tx.description}"` : ""}. Account balances and budget usage will be recalculated.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await delJson(`/api/transactions/${tx.id}`);
      toast.success("Transaction deleted");
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
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const onEdit = (tx: TransactionRow) => {
    setEditTx(tx);
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Transactions</h2>
          <p className="text-sm text-muted-foreground">
            All movement of money: income, expenses, transfers, credit and loan payments.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record transaction
        </Button>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="dues">Dues & Receivables</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" /> Filters
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search description or amount"
                className="h-9 w-full pl-8 sm:w-[220px]"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <Select value={type || "ALL"} onValueChange={(v) => { setType(v === "ALL" ? "" : v); setPage(0); }}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="CREDIT_PAYMENT">Credit payment</SelectItem>
                <SelectItem value="LOAN_PAYMENT">Loan payment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={accountId || "ALL"} onValueChange={(v) => { setAccountId(v === "ALL" ? "" : v); setPage(0); }}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All accounts</SelectItem>
                {(accounts ?? []).map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? `${format(dateFrom, "MMM d")}${dateTo ? ` – ${format(dateTo, "MMM d")}` : ""}` : "Date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={dateFrom ? { from: dateFrom, to: dateTo ?? undefined } : undefined}
                  onSelect={(r) => { setDateFrom(r?.from ?? null); setDateTo(r?.to ?? null); setPage(0); }}
                />
                {dateFrom && (
                  <div className="border-t px-3 py-2">
                    <Button variant="ghost" size="sm" onClick={() => { setDateFrom(null); setDateTo(null); setPage(0); }}>Clear dates</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="space-y-2 px-6 pb-6">
              {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState title="Nothing matches" description="Adjust filters or record your first transaction." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {data.runningBalances && <TableHead className="text-right">Balance</TableHead>}
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => {
                  const isInvestmentFlow = Boolean(t.trade);
                  const sign = t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "-" : "";
                  const tone = isInvestmentFlow ? "text-foreground" : t.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : t.type === "EXPENSE" ? "text-rose-600 dark:text-rose-400" : "text-foreground";
                  const accountLabel = (() => {
                    if (t.type === "INCOME" || t.type === "EXPENSE") return t.account?.name ?? "—";
                    return `${t.fromAccount?.name ?? "?"} → ${t.toAccount?.name ?? "?"}`;
                  })();
                  const label = isInvestmentFlow
                    ? t.trade?.action === "SELL" || t.trade?.action === "MATURITY"
                      ? "Investment redemption"
                      : t.trade?.action === "DIVIDEND" || t.trade?.action === "INTEREST"
                        ? "Investment income"
                        : "Investment buy"
                    : TYPE_LABELS[t.type];
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{format(new Date(t.occurredAt), "MMM d, yyyy")}</TableCell>
                      <TableCell><Badge variant="muted" className="text-[10px]">{label}</Badge></TableCell>
                      <TableCell className="max-w-[260px] truncate">{t.description || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{accountLabel}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{isInvestmentFlow ? t.trade?.holding?.name ?? "Investment" : t.category?.name ?? "—"}</TableCell>
                      <TableCell className={cn("text-right tabular font-medium", tone)}>{sign}{formatCurrency(t.amount)}</TableCell>
                      {data.runningBalances && (
                        <TableCell className="text-right tabular text-xs text-muted-foreground">
                          {data.runningBalances[t.id] ? formatCurrency(data.runningBalances[t.id]) : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onEdit(t)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(t)} aria-label="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {data && data.total > pageSize ? (
          <div className="flex items-center justify-between border-t px-6 py-3 text-sm text-muted-foreground">
            <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.total)} of {data.total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        ) : null}
      </Card>
        </TabsContent>

        <TabsContent value="dues">
          <DuesTab />
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <TransactionDialog open={open} onOpenChange={setOpen} defaultAccountId={defaultAccId} />
      {/* Edit dialog */}
      <TransactionDialog
        open={Boolean(editTx)}
        onOpenChange={(o) => { if (!o) setEditTx(null); }}
        editTransaction={editTx}
      />
    </div>
  );
}
