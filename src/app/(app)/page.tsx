"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { CategoryPie } from "@/components/dashboard/category-pie";
import { SavingsTrendChart } from "@/components/dashboard/savings-trend-chart";
import { RangePicker, buildRangeQuery, type RangeValue } from "@/components/dashboard/range-picker";
import { useDashboard, type DashboardData } from "@/hooks/use-data";
import { useCurrency } from "@/components/currency-provider";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { format } from "date-fns";

export default function DashboardPage() {
  const [range, setRange] = React.useState<RangeValue>({ kind: "WEEK" });
  const query = buildRangeQuery(range);
  const { data, isLoading } = useDashboard(query);
  const { formatCurrency } = useCurrency();

  const incomeDelta = computeDelta(
    Number(data?.summary.income ?? 0),
    Number(data?.summary.previousIncome ?? 0)
  );
  const expenseDelta = computeDelta(
    Number(data?.summary.expense ?? 0),
    Number(data?.summary.previousExpense ?? 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Overview</h2>
          <p className="text-sm text-muted-foreground">{data?.range.label ?? "Loading..."}</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {isLoading || !data ? (
        <SummarySkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              title="Net worth"
              value={formatCurrency(data.summary.netWorth)}
              hint={`Assets ${formatCurrency(data.summary.totalAssets)}`}
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Total liabilities"
              value={formatCurrency(data.summary.totalLiabilities)}
              hint="Credit + loans"
              icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Income"
              value={formatCurrency(data.summary.income)}
              delta={incomeDelta}
              icon={<ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Expenses"
              value={formatCurrency(data.summary.expense)}
              delta={expenseDelta}
              invertDelta
              icon={<ArrowDownRight className="h-4 w-4 text-muted-foreground" />}
            />
          </div>

          {data.maturedHoldings.length > 0 && (
            <MaturityReviewCard holdings={data.maturedHoldings} />
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            <SavingsCard
              net={data.summary.net}
              savingsRate={data.summary.savingsRate}
              series={data.series}
            />
            <BudgetUsageCard data={data.budgets} />
            <CreditObligationsCard data={data.creditObligations} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expense</CardTitle>
                <CardDescription>{data.range.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <IncomeExpenseChart data={data.series} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Spending by category</CardTitle>
                <CardDescription>Where your money goes</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryPie
                  data={data.categoryBreakdown.map((c) => ({
                    name: c.name,
                    amount: c.amount,
                    share: c.share,
                    color: c.color,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
            <Card className="lg:col-span-2 overflow-hidden">
              <CardHeader>
                <CardTitle>Recent transactions</CardTitle>
                <CardDescription>Latest activity across all accounts</CardDescription>
              </CardHeader>
              <CardContent className="px-0 overflow-hidden">
                {data.recentTransactions.length === 0 ? (
                  <div className="px-6">
                    <EmptyState
                      title="Nothing yet"
                      description="Record your first transaction to start tracking."
                    />
                  </div>
                ) : (
                  <ul className="divide-y">
                    {data.recentTransactions.map((t) => (
                      <li key={t.id} className="px-4">
                        <TransactionRow tx={t} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <UpcomingPanel
              upcomingRecurring={data.upcomingRecurring}
              creditObligations={data.creditObligations}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Account distribution</CardTitle>
                <CardDescription>Where your assets live</CardDescription>
              </CardHeader>
              <CardContent>
                {data.accountDistribution.length === 0 ? (
                  <EmptyState title="No assets yet" description="Add an account to see your distribution." />
                ) : (
                  <div className="space-y-3">
                    {data.accountDistribution.map((a) => (
                      <div key={a.accountId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{a.name}</span>
                          <span className="tabular text-muted-foreground">
                            {formatCurrency(a.amount)} · {formatPercent(a.share)}
                          </span>
                        </div>
                        <Progress value={a.share * 100} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <PortfolioWidget portfolio={data.portfolio} />
          </div>
        </>
      )}
    </div>
  );
}

function SavingsCard({
  net,
  savingsRate,
  series,
}: {
  net: string;
  savingsRate: number;
  series: Array<{ date: string; income: number; expense: number; net: number }>;
}) {
  const { formatCurrency } = useCurrency();
  const positive = Number(net) >= 0;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Savings trend</CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(net)}</span>
          <Badge variant={positive ? "success" : "destructive"}>
            {formatPercent(savingsRate)} rate
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <SavingsTrendChart data={series.map((s) => ({ date: s.date, net: s.net }))} />
      </CardContent>
    </Card>
  );
}

function BudgetUsageCard({
  data,
}: {
  data: Array<{
    id: string;
    name: string;
    usage: number;
    spent: string;
    allocated: string;
    status: "HEALTHY" | "NEAR_LIMIT" | "OVER_BUDGET";
  }>;
}) {
  const { formatCurrency } = useCurrency();
  const overBudget = data.filter((b) => b.status === "OVER_BUDGET").length;
  const nearLimit = data.filter((b) => b.status === "NEAR_LIMIT").length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Budget health</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2 pt-1">
          {overBudget > 0 ? (
            <Badge variant="destructive">{overBudget} over budget</Badge>
          ) : null}
          {nearLimit > 0 ? <Badge variant="warning">{nearLimit} near limit</Badge> : null}
          {overBudget === 0 && nearLimit === 0 && data.length > 0 ? (
            <Badge variant="success">All on track</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets defined yet.</p>
        ) : (
          data.slice(0, 4).map((b) => (
            <div key={b.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{b.name}</span>
                <span className="tabular text-muted-foreground">
                  {formatCurrency(b.spent)} / {formatCurrency(b.allocated)}
                </span>
              </div>
              <Progress
                value={Math.min(100, b.usage * 100)}
                indicatorClassName={cn(
                  b.status === "HEALTHY" && "bg-emerald-500",
                  b.status === "NEAR_LIMIT" && "bg-amber-500",
                  b.status === "OVER_BUDGET" && "bg-rose-500"
                )}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CreditObligationsCard({
  data,
}: {
  data: Array<{
    id: string;
    name: string;
    type: "CREDIT" | "LOAN";
    creditLimit: string | null;
    balance: string;
    dueDay: number | null;
  }>;
}) {
  const { formatCurrency } = useCurrency();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Credit obligations</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription className="pt-1">Outstanding liabilities and utilization</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No credit or loan accounts.</p>
        ) : (
          data.slice(0, 3).map((c) => {
            const limit = c.creditLimit ? Number(c.creditLimit) : null;
            const balance = Number(c.balance);
            const util = limit && limit > 0 ? balance / limit : null;
            return (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular text-muted-foreground">
                    {formatCurrency(balance)}
                    {limit ? ` / ${formatCurrency(limit)}` : ""}
                  </span>
                </div>
                {util !== null ? (
                  <Progress
                    value={Math.min(100, util * 100)}
                    indicatorClassName={cn(
                      util >= 0.8 ? "bg-rose-500" : util >= 0.5 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                  />
                ) : (
                  <Progress value={Math.min(100, balance > 0 ? 50 : 0)} />
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function MaturityReviewCard({
  holdings,
}: {
  holdings: DashboardData["maturedHoldings"];
}) {
  const { formatCurrency } = useCurrency();
  const primary = holdings[0];
  const extraCount = holdings.length - 1;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {primary.name} has matured{extraCount > 0 ? `, plus ${extraCount} more` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Review redemption for {formatCurrency(primary.principal)} in {primary.accountName}
              {primary.maturityDate ? ` · matured ${format(new Date(primary.maturityDate), "MMM d, yyyy")}` : ""}.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="sm:self-center">
          <Link href="/investments">Review</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function UpcomingPanel({
  upcomingRecurring,
  creditObligations,
}: {
  upcomingRecurring: Array<{ ruleId: string; name: string; amount: string; type: string; date: string }>;
  creditObligations: Array<{ id: string; name: string; type: "CREDIT" | "LOAN"; dueDay: number | null }>;
}) {
  const { formatCurrency } = useCurrency();
  const dueSoon = creditObligations.filter((c) => c.dueDay).slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upcoming</CardTitle>
        <CardDescription>Recurring activity & due dates</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Recurring
          </p>
          {upcomingRecurring.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingRecurring.slice(0, 5).map((r, i) => (
                <li
                  key={`${r.ruleId}-${i}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular text-sm font-medium",
                      r.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    {r.type === "INCOME" ? "+" : r.type === "EXPENSE" ? "-" : ""}
                    {formatCurrency(r.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {dueSoon.length > 0 ? (
          <>
            <Separator />
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Due dates
              </p>
              <ul className="space-y-2">
                {dueSoon.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground">Day {c.dueDay}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PortfolioWidget({ portfolio }: { portfolio: DashboardData["portfolio"] }) {
  const { formatCurrency } = useCurrency();
  if (portfolio.holdingsCount === 0) {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Landmark className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm">Investments</CardTitle>
            <CardDescription>Add stocks, mutual funds, bonds, or FDs to see your portfolio here.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const positive = portfolio.totalPnl >= 0;
  const typeLabels: Record<string, string> = { STOCK: "Stocks", MUTUAL_FUND: "Mutual Funds", BOND: "Bonds", FIXED_DEPOSIT: "Fixed Deposits" };
  const typeColors: Record<string, string> = { STOCK: "hsl(var(--chart-1))", MUTUAL_FUND: "hsl(var(--chart-2))", BOND: "hsl(var(--chart-3))", FIXED_DEPOSIT: "hsl(var(--chart-4))" };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Portfolio</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(portfolio.totalCurrentValue)}</span>
          <Badge variant={positive ? "success" : "destructive"}>
            {positive ? "+" : ""}{portfolio.totalPnlPercent.toFixed(2)}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Invested {formatCurrency(portfolio.totalInvested)} · P&L {positive ? "+" : ""}{formatCurrency(portfolio.totalPnl)}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(portfolio.byType).map(([type, value]) => {
          const share = portfolio.totalCurrentValue > 0 ? value / portfolio.totalCurrentValue : 0;
          return (
            <div key={type} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: typeColors[type] ?? "hsl(var(--muted))" }} />
                {typeLabels[type] ?? type}
              </span>
              <span className="tabular text-muted-foreground">{formatCurrency(value)} · {(share * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-[180px]" />
        <Skeleton className="h-[180px]" />
        <Skeleton className="h-[180px]" />
      </div>
      <Skeleton className="h-[320px]" />
    </div>
  );
}

function computeDelta(current: number, previous: number) {
  if (!previous) return current > 0 ? 1 : 0;
  return (current - previous) / previous;
}
