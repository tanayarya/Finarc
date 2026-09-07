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
  X,
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
import { Input } from "@/components/ui/input";
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
import { postJson } from "@/lib/fetcher";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { format } from "date-fns";
import { toast } from "sonner";

export default function DashboardPage() {
  const [range, setRange] = React.useState<RangeValue>({ kind: "MONTH" });
  const query = buildRangeQuery(range);
  const { data, isLoading, mutate } = useDashboard(query);
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
            <MaturityReviewCard holdings={data.maturedHoldings} onDone={() => mutate()} />
          )}

          {data.savingsInterestReviews.length > 0 && (
            <SavingsInterestReviewCard reviews={data.savingsInterestReviews} onDone={() => mutate()} />
          )}

          {data.bondInterestReviews.length > 0 && (
            <BondInterestReviewCard reviews={data.bondInterestReviews} onDone={() => mutate()} />
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
            <Card className="overflow-hidden">
              <CardHeader className="p-5 pb-3">
                <CardTitle>Income vs Expense</CardTitle>
                <CardDescription>{data.range.label}</CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <IncomeExpenseChart data={data.series} />
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader className="p-5 pb-3">
                <CardTitle>Spending by category</CardTitle>
                <CardDescription>Where your money goes</CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
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
            <Card className="overflow-hidden">
              <CardHeader className="p-5 pb-3">
                <CardTitle>Account distribution</CardTitle>
                <CardDescription>Where your assets live</CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
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

function BondInterestReviewCard({
  reviews,
  onDone,
}: {
  reviews: DashboardData["bondInterestReviews"];
  onDone: () => void;
}) {
  const { formatCurrency } = useCurrency();
  const primary = reviews[0];
  const [netAmount, setNetAmount] = React.useState(primary.netAmount);
  const [saving, setSaving] = React.useState(false);
  const extraCount = reviews.length - 1;

  React.useEffect(() => {
    setNetAmount(primary.netAmount);
  }, [primary.netAmount, primary.holdingId, primary.periodStart]);

  const approve = async () => {
    try {
      setSaving(true);
      await postJson("/api/bond-interest/approve", {
        holdingId: primary.holdingId,
        periodStart: primary.periodStart,
        periodEnd: primary.periodEnd,
        grossInterest: primary.grossInterest,
        tdsAmount: primary.tdsAmount,
        netAmount,
      });
      toast.success("Bond interest recorded");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record bond interest");
    } finally {
      setSaving(false);
    }
  };
  const dismiss = async () => {
    try {
      await postJson("/api/dashboard/reviews/dismiss", { marker: primary.dismissMarker });
      toast.success("Hidden for this month");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to hide review");
    }
  };

  return (
    <Card className="border-sky-500/30 bg-sky-500/5">
      <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Review bond interest for {primary.name}{extraCount > 0 ? `, plus ${extraCount} more` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Gross {formatCurrency(primary.grossInterest)} · TDS {formatCurrency(primary.tdsAmount)} · {format(new Date(primary.periodStart), "MMM d")} - {format(new Date(primary.periodEnd), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[9rem_auto_auto] sm:items-center">
          <Input
            className="h-9 tabular"
            inputMode="decimal"
            value={netAmount}
            onChange={(e) => setNetAmount(e.target.value)}
            aria-label="Bond interest net credited amount"
          />
          <Button size="sm" onClick={approve} disabled={saving}>
            {saving ? "Saving..." : `Approve ${formatCurrency(netAmount)}`}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 justify-self-start sm:justify-self-auto" onClick={dismiss} aria-label="Hide bond interest review">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SavingsInterestReviewCard({
  reviews,
  onDone,
}: {
  reviews: DashboardData["savingsInterestReviews"];
  onDone: () => void;
}) {
  const { formatCurrency } = useCurrency();
  const primary = reviews[0];
  const [amount, setAmount] = React.useState(primary.amount);
  const [saving, setSaving] = React.useState(false);
  const extraCount = reviews.length - 1;

  React.useEffect(() => {
    setAmount(primary.amount);
  }, [primary.amount, primary.accountId, primary.periodStart]);

  const normalizedAmount = amount.startsWith(".") ? `0${amount}` : amount;
  const isValidAmount = /^\d+(\.\d{1,2})?$/.test(normalizedAmount) && Number(normalizedAmount) > 0;

  const approve = async () => {
    try {
      setSaving(true);
      await postJson("/api/savings-interest/approve", {
        accountId: primary.accountId,
        periodStart: primary.periodStart,
        periodEnd: primary.periodEnd,
        amount: normalizedAmount,
      });
      toast.success("Savings interest recorded");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record interest");
    } finally {
      setSaving(false);
    }
  };
  const dismiss = async () => {
    try {
      await postJson("/api/dashboard/reviews/dismiss", { marker: primary.dismissMarker });
      toast.success("Hidden for this month");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to hide review");
    }
  };

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Review savings interest for {primary.accountName}{extraCount > 0 ? `, plus ${extraCount} more` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(primary.periodStart), "MMM d, yyyy")} - {format(new Date(primary.periodEnd), "MMM d, yyyy")}
              {" "}at {primary.rate}% p.a. daily balance basis.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[9rem_auto_auto] sm:items-center">
          <div className="relative">
            <Input
              className="h-9 tabular"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const next = e.target.value;
                if (/^\d*(\.\d{0,2})?$/.test(next)) setAmount(next);
              }}
              aria-label="Savings interest amount"
            />
          </div>
          <Button size="sm" onClick={approve} disabled={saving || !isValidAmount}>
            {saving ? "Saving..." : isValidAmount ? `Approve ${formatCurrency(normalizedAmount)}` : "Approve"}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 justify-self-start sm:justify-self-auto" onClick={dismiss} aria-label="Hide savings interest review">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <Card className="overflow-hidden">
      <CardHeader className="p-5 pb-3">
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
      <CardContent className="p-5 pt-0">
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
    category?: { name: string };
    usage: number;
    spent: string;
    allocated: string;
    status: "HEALTHY" | "NEAR_LIMIT" | "OVER_BUDGET";
  }>;
}) {
  const { formatCurrency } = useCurrency();
  const overBudget = data.filter((b) => b.status === "OVER_BUDGET").length;
  const nearLimit = data.filter((b) => b.status === "NEAR_LIMIT").length;
  const visibleBudgets = [...data]
    .sort((a, b) => {
      const priority = { OVER_BUDGET: 0, NEAR_LIMIT: 1, HEALTHY: 2 } as const;
      const priorityDiff = priority[a.status] - priority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      const spentDiff = Number(b.spent) - Number(a.spent);
      if (spentDiff !== 0) return spentDiff;
      return b.usage - a.usage;
    })
    .slice(0, 5);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-5 pb-3">
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
      <CardContent className="space-y-2.5 p-5 pt-0">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets defined yet.</p>
        ) : (
          visibleBudgets.map((b) => (
            <div key={b.id} className="rounded-md border bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{b.category?.name ?? b.name}</span>
                <span className="tabular text-muted-foreground">
                  {formatCurrency(b.spent)} / {formatCurrency(b.allocated)}
                </span>
              </div>
              <Progress
                className="mt-2 h-1.5"
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
    <Card className="overflow-hidden">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Credit obligations</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription className="pt-1">Outstanding liabilities and utilization</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5 p-5 pt-0">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No credit or loan accounts.</p>
        ) : (
          data.slice(0, 5).map((c) => {
            const limit = c.creditLimit ? Number(c.creditLimit) : null;
            const balance = Number(c.balance);
            const util = limit && limit > 0 ? balance / limit : null;
            return (
              <div key={c.id} className="rounded-md border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular text-muted-foreground">
                    {formatCurrency(balance)}
                    {limit ? ` / ${formatCurrency(limit)}` : ""}
                  </span>
                </div>
                {util !== null ? (
                  <Progress
                    className="mt-2 h-1.5"
                    value={Math.min(100, util * 100)}
                    indicatorClassName={cn(
                      util >= 0.8 ? "bg-rose-500" : util >= 0.5 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                  />
                ) : (
                  <Progress className="mt-2 h-1.5" value={Math.min(100, balance > 0 ? 50 : 0)} />
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
  onDone,
}: {
  holdings: DashboardData["maturedHoldings"];
  onDone: () => void;
}) {
  const { formatCurrency } = useCurrency();
  const primary = holdings[0];
  const extraCount = holdings.length - 1;
  const dismiss = async () => {
    try {
      await postJson("/api/dashboard/reviews/dismiss", { marker: primary.dismissMarker });
      toast.success("Hidden for this month");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to hide review");
    }
  };

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
        <div className="flex gap-2 sm:self-center">
          <Button asChild size="sm" variant="outline">
            <Link href="/investments">Review</Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={dismiss} aria-label="Hide maturity review">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingPanel({
  upcomingRecurring,
  creditObligations,
}: {
  upcomingRecurring: Array<{ ruleId: string; name: string; amount: string; type: string; date: string }>;
  creditObligations: Array<{ id: string; name: string; type: "CREDIT" | "LOAN"; dueDay: number | null; dueDate?: string | null; daysUntilDue?: number | null }>;
}) {
  const { formatCurrency } = useCurrency();
  const dueSoon = creditObligations
    .filter((c) => c.dueDay)
    .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))
    .slice(0, 3);
  const recurring = upcomingRecurring.slice(0, 4);
  const hasItems = recurring.length > 0 || dueSoon.length > 0;
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Upcoming</CardTitle>
            <CardDescription>Recurring activity & due dates</CardDescription>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasItems ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center">
            <p className="text-sm font-medium">Nothing due soon</p>
            <p className="mt-1 text-xs text-muted-foreground">Recurring rules and card due dates will appear here.</p>
          </div>
        ) : null}

        {recurring.length > 0 ? (
          <div className="space-y-2.5">
            <SectionLabel icon={<CalendarClock className="h-3.5 w-3.5" />} label="Recurring" />
            <ul className="space-y-2">
              {recurring.map((r, i) => {
                const positive = r.type === "INCOME";
                const isTransferLike = r.type === "TRANSFER" || r.type === "CREDIT_PAYMENT" || r.type === "LOAN_PAYMENT";
                return (
                  <li key={`${r.ruleId}-${i}`} className="rounded-md border bg-muted/20 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{format(new Date(r.date), "MMM d, yyyy")}</p>
                      </div>
                      <span className={cn("shrink-0 whitespace-nowrap tabular text-sm font-semibold", positive ? "text-emerald-600 dark:text-emerald-400" : isTransferLike ? "text-foreground" : "text-rose-600 dark:text-rose-400")}>
                        {positive ? "+" : r.type === "EXPENSE" ? "-" : ""}
                        {formatCurrency(r.amount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {dueSoon.length > 0 ? (
          <>
            {recurring.length > 0 ? <Separator /> : null}
            <div className="space-y-2.5">
              <SectionLabel icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Due dates" />
              <ul className="space-y-2">
                {dueSoon.map((c) => (
                  <li key={c.id} className="rounded-md border bg-muted/20 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.dueDate ? format(new Date(c.dueDate), "MMM d") : `Day ${c.dueDay}`}
                        </p>
                      </div>
                      <DueBadge days={c.daysUntilDue} />
                    </div>
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

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </p>
  );
}

function DueBadge({ days }: { days?: number | null }) {
  if (days === 0) return <Badge variant="destructive" className="shrink-0 whitespace-nowrap">Today</Badge>;
  if (days !== null && days !== undefined && days <= 2) return <Badge variant="warning" className="shrink-0 whitespace-nowrap">{days}d left</Badge>;
  if (days !== null && days !== undefined) return <Badge variant="muted" className="shrink-0 whitespace-nowrap">{days}d left</Badge>;
  return <Badge variant="muted" className="shrink-0 whitespace-nowrap">Soon</Badge>;
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
