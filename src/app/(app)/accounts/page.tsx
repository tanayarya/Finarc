"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Wallet, CreditCard, Landmark, PiggyBank, TrendingUp, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountDialog } from "@/components/accounts/account-dialog";
import { useAccounts, type AccountWithBalance } from "@/hooks/use-data";
import { useCurrency } from "@/components/currency-provider";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_META = {
  SAVINGS: { label: "Savings", Icon: PiggyBank, asset: true },
  CASH: { label: "Cash", Icon: Wallet, asset: true },
  CREDIT: { label: "Credit card", Icon: CreditCard, asset: false },
  LOAN: { label: "Loan", Icon: Landmark, asset: false },
  INVESTMENT: { label: "Investment", Icon: TrendingUp, asset: true },
} as const;

export default function AccountsPage() {
  const { data, isLoading } = useAccounts();
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");

  const allAccounts = data ?? [];
  const accounts = allAccounts.filter((a) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.institution ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "ALL" || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const grouped = accounts.reduce<Record<string, AccountWithBalance[]>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  const totalAssets = allAccounts
    .filter((a) => TYPE_META[a.type].asset)
    .reduce((s, a) => s + Number(a.balance), 0);
  const totalLiab = allAccounts
    .filter((a) => !TYPE_META[a.type].asset)
    .reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Ledger-style accounts. Balances update only through transactions.
          </p>
        </div>
        <AccountDialog
          trigger={
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> New account
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(totalAssets)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total liabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(totalLiab)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Net worth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-lg font-semibold sm:text-2xl">
              {formatCurrency(totalAssets - totalLiab)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            className="h-9 w-full pl-8 sm:w-[240px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="SAVINGS">Savings</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="CREDIT">Credit</SelectItem>
            <SelectItem value="LOAN">Loan</SelectItem>
            <SelectItem value="INVESTMENT">Investment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No accounts yet"
          description="Add your first savings, credit, loan, or investment account to start tracking."
          action={
            <AccountDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> Create account
                </Button>
              }
            />
          }
        />
      ) : (
        Object.entries(TYPE_META).map(([type, meta]) => {
          const list = grouped[type] ?? [];
          if (list.length === 0) return null;
          return (
            <section key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                <meta.Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{meta.label}</h3>
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {list.map((a) => (
                  <AccountCard key={a.id} account={a} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function AccountCard({ account }: { account: AccountWithBalance }) {
  const { formatCurrency } = useCurrency();
  const meta = TYPE_META[account.type];
  const Icon = meta.Icon;
  const balance = Number(account.balance);
  const limit = account.creditLimit ? Number(account.creditLimit) : null;
  const utilization = limit && limit > 0 ? balance / limit : null;
  return (
    <Link
      href={`/accounts/${account.id}`}
      className="group block focus:outline-none"
    >
      <Card className="transition-colors hover:border-foreground/30">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardDescription className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" /> {meta.label}
            </CardDescription>
            <CardTitle className="text-base">{account.name}</CardTitle>
          </div>
          <Badge variant={meta.asset ? "success" : "warning"}>
            {meta.asset ? "Asset" : "Liability"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(balance)}</p>
          {utilization !== null ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Utilization</span>
                <span className="tabular">{formatPercent(utilization)}</span>
              </div>
              <Progress
                value={Math.min(100, utilization * 100)}
                indicatorClassName={cn(
                  utilization >= 0.8
                    ? "bg-rose-500"
                    : utilization >= 0.5
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Limit {formatCurrency(limit!)}
              </p>
            </div>
          ) : null}
          {account.dueDay ? (
            <p className="text-xs text-muted-foreground">Due day {account.dueDay}</p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
