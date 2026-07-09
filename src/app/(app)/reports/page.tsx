"use client";

import * as React from "react";
import useSWR from "swr";
import { format } from "date-fns";
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RangePicker, buildRangeQuery, type RangeValue } from "@/components/dashboard/range-picker";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { CategoryPie } from "@/components/dashboard/category-pie";
import { useCurrency } from "@/components/currency-provider";
import { formatPercent } from "@/lib/format";
import { getAssetClassLabel } from "@/lib/finance/asset-classes";
import { cn } from "@/lib/utils";

interface ReportData {
  range: { kind: string; from: string; to: string; label: string };
  totals: { income: string; expense: string; net: string; savingsRate: number };
  series: Array<{ date: string; income: number; expense: number; net: number }>;
  categoryBreakdown: Array<{ categoryId: string; name: string; color: string | null; amount: number; share: number }>;
  accountPerformance: Array<{ id: string; name: string; type: string; income: number; expense: number; net: number }>;
  budgets: Array<{ id: string; name: string; period: string; category: string; allocated: string; spent: string; remaining: string; usage: number; status: "HEALTHY" | "NEAR_LIMIT" | "OVER_BUDGET" }>;
}

interface ComparisonData {
  current: { label: string; income: string; expense: string; net: string; savingsRate: number; categories: Array<{ name: string; amount: number }> };
  previous: { label: string; income: string; expense: string; net: string; savingsRate: number; categories: Array<{ name: string; amount: number }> };
}

interface CashflowData {
  range: { kind: string; from: string; to: string; label: string };
  summary: { income: number; expenses: number; debt: number; investments: number; retained: number };
  nodes: Array<{ name: string; type: "income" | "hub" | "expense" | "debt" | "investment" | "savings"; color: string }>;
  links: Array<{ source: number; target: number; value: number; color: string }>;
}

export default function ReportsPage() {
  const [range, setRange] = React.useState<RangeValue>({ kind: "MONTH" });
  const query = buildRangeQuery(range);
  const { data, isLoading } = useSWR<ReportData>(`/api/reports/summary?${query}`);
  const { data: comparison } = useSWR<ComparisonData>(`/api/reports/comparison?kind=${range.kind}`);
  const { data: cashflow } = useSWR<CashflowData>(`/api/reports/cashflow?${query}`);
  const { formatCurrency, formatCompactCurrency } = useCurrency();
  const sortedBudgets = React.useMemo(() => {
    if (!data) return [];
    const priority = { OVER_BUDGET: 0, NEAR_LIMIT: 1, HEALTHY: 2 } as const;
    return [...data.budgets].sort((a, b) => {
      const statusDiff = priority[a.status] - priority[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.usage - a.usage;
    });
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Reports</h2>
          <p className="text-sm text-muted-foreground">{data?.range.label ?? "Loading..."}</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {isLoading || !data ? (
        <div className="grid gap-3 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-[120px]" />))}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard title="Income" value={formatCurrency(data.totals.income)} />
            <SummaryCard title="Expenses" value={formatCurrency(data.totals.expense)} />
            <SummaryCard title="Net" value={formatCurrency(data.totals.net)} tone={Number(data.totals.net) >= 0 ? "good" : "bad"} />
            <SummaryCard title="Savings rate" value={formatPercent(data.totals.savingsRate)} tone={data.totals.savingsRate >= 0 ? "good" : "bad"} />
          </div>

          <Tabs defaultValue="trend">
            <TabsList className="flex-wrap h-auto gap-1 overflow-x-auto max-w-full">
              <TabsTrigger value="trend">Trend</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="budgets">Budgets</TabsTrigger>
              <TabsTrigger value="networth">Net Worth</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
              <TabsTrigger value="top">Top Spending</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
            </TabsList>

            <TabsContent value="trend">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Income vs expense trend</CardTitle>
                  <CardDescription>{data.range.label}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <IncomeExpenseChart data={data.series} xAxisInterval={data.range.kind === "MONTH" ? 0 : "preserveStartEnd"} />
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <TrendStat label="Income" value={formatCurrency(data.totals.income)} tone="good" />
                    <TrendStat label="Expense" value={formatCurrency(data.totals.expense)} tone="bad" />
                    <TrendStat label="Net movement" value={formatCurrency(data.totals.net)} tone={Number(data.totals.net) >= 0 ? "good" : "bad"} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories">
              <Card>
                <CardHeader><CardTitle className="text-sm">Spending breakdown</CardTitle></CardHeader>
                <CardContent><CategoryPie data={data.categoryBreakdown} /></CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="accounts">
              <AccountBalanceChart kind={range.kind} formatCurrency={formatCurrency} formatCompactCurrency={formatCompactCurrency} />
            </TabsContent>

            <TabsContent value="budgets">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Budget performance</CardTitle>
                  <CardDescription>Over-limit budgets are shown first for quick review</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.budgets.length === 0 ? (<EmptyState title="No budgets" description="Create budgets to track performance." />) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {sortedBudgets.map((b) => (
                        <div key={b.id} className="rounded-md border bg-muted/15 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{b.category}</p>
                              <p className="text-xs capitalize text-muted-foreground">{b.period.toLowerCase()}</p>
                            </div>
                            <span className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                              b.status === "HEALTHY" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                              b.status === "NEAR_LIMIT" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                              b.status === "OVER_BUDGET" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                            )}>
                              {b.status === "OVER_BUDGET" ? "Over" : b.status === "NEAR_LIMIT" ? "Near" : "Healthy"}
                            </span>
                          </div>
                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div>
                              <p className="tabular text-lg font-semibold">{formatCurrency(b.spent)}</p>
                              <p className="text-xs text-muted-foreground">of {formatCurrency(b.allocated)}</p>
                            </div>
                            <p className="tabular text-xs font-medium text-muted-foreground">{formatPercent(b.usage)}</p>
                          </div>
                          <Progress className="mt-3 h-2" value={Math.min(100, b.usage * 100)} indicatorClassName={cn(b.status === "HEALTHY" && "bg-emerald-500", b.status === "NEAR_LIMIT" && "bg-amber-500", b.status === "OVER_BUDGET" && "bg-rose-500")} />
                          <p className={cn("mt-2 tabular text-xs", Number(b.remaining) >= 0 ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400")}>
                            {Number(b.remaining) >= 0 ? `${formatCurrency(b.remaining)} left` : `${formatCurrency(Math.abs(Number(b.remaining)))} over`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="networth">
              <NetWorthChart formatCurrency={formatCurrency} formatCompactCurrency={formatCompactCurrency} />
            </TabsContent>

            <TabsContent value="comparison">
              <Card>
                <CardHeader><CardTitle className="text-sm">Period comparison</CardTitle><CardDescription>{comparison ? `${comparison.current.label} vs ${comparison.previous.label}` : "Loading..."}</CardDescription></CardHeader>
                <CardContent>
                  {!comparison ? (<Skeleton className="h-[200px]" />) : (
                    <div className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <ComparisonMetric label="Income" current={Number(comparison.current.income)} previous={Number(comparison.previous.income)} formatValue={formatCurrency} goodWhenHigher />
                        <ComparisonMetric label="Expenses" current={Number(comparison.current.expense)} previous={Number(comparison.previous.expense)} formatValue={formatCurrency} />
                        <ComparisonMetric label="Net" current={Number(comparison.current.net)} previous={Number(comparison.previous.net)} formatValue={formatCurrency} goodWhenHigher />
                        <ComparisonMetric label="Savings rate" current={comparison.current.savingsRate} previous={comparison.previous.savingsRate} formatValue={formatPercent} goodWhenHigher />
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <ComparisonCategoryList title={comparison.current.label} categories={comparison.current.categories} formatCurrency={formatCurrency} />
                        <ComparisonCategoryList title={comparison.previous.label} categories={comparison.previous.categories} formatCurrency={formatCurrency} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="top">
              <Card>
                <CardHeader><CardTitle className="text-sm">Top spending categories</CardTitle><CardDescription>Ranked by total spend in this period</CardDescription></CardHeader>
                <CardContent>
                  {data.categoryBreakdown.length === 0 ? (<EmptyState title="No expenses" />) : (
                    <div className="space-y-3">
                      {data.categoryBreakdown.slice(0, 10).map((c, i) => (
                        <div key={c.categoryId} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{c.name}</span>
                              <span className="tabular text-muted-foreground">{formatCurrency(c.amount)} · {formatPercent(c.share)}</span>
                            </div>
                            <Progress value={c.share * 100} indicatorClassName="bg-primary" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cashflow">
              <Card>
                <CardHeader><CardTitle className="text-sm">Cash flow map</CardTitle><CardDescription>How income is allocated across spending, debt, investments, and savings</CardDescription></CardHeader>
                <CardContent>
                  {!cashflow || cashflow.links.length === 0 ? (<EmptyState title="No data" description="Add income and expense transactions to see cash flow." />) : (
                    <CashflowSankey data={cashflow} formatCurrency={formatCurrency} formatCompactCurrency={formatCompactCurrency} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="distribution">
              <DistributionChart />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className={cn("tabular text-lg font-semibold sm:text-2xl", tone === "good" && "text-emerald-600 dark:text-emerald-400", tone === "bad" && "text-rose-600 dark:text-rose-400")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TrendStat({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 tabular text-sm font-semibold", tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{value}</p>
    </div>
  );
}

function ComparisonMetric({
  label,
  current,
  previous,
  formatValue,
  goodWhenHigher = false,
}: {
  label: string;
  current: number;
  previous: number;
  formatValue: (value: number) => string;
  goodWhenHigher?: boolean;
}) {
  const delta = current - previous;
  const better = goodWhenHigher ? delta >= 0 : delta <= 0;
  const base = Math.max(Math.abs(current), Math.abs(previous), 1);
  const currentWidth = Math.max(4, Math.min(100, (Math.abs(current) / base) * 100));
  const previousWidth = Math.max(4, Math.min(100, (Math.abs(previous) / base) * 100));

  return (
    <div className="rounded-md border bg-muted/15 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 tabular text-lg font-semibold">{formatValue(current)}</p>
        </div>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          better ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        )}>
          {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${formatValue(delta)}`}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <ComparisonBar label="Current" value={formatValue(current)} width={currentWidth} className="bg-primary" />
        <ComparisonBar label="Previous" value={formatValue(previous)} width={previousWidth} className="bg-muted-foreground/35" />
      </div>
    </div>
  );
}

function ComparisonBar({ label, value, width, className }: { label: string; value: string; width: number; className: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={cn("h-2 rounded-full", className)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ComparisonCategoryList({
  title,
  categories,
  formatCurrency,
}: {
  title: string;
  categories: Array<{ name: string; amount: number }>;
  formatCurrency: (value: number) => string;
}) {
  const topCategories = categories.slice(0, 5);
  const max = Math.max(...topCategories.map((c) => c.amount), 1);

  return (
    <div className="rounded-md border bg-muted/15 p-3">
      <p className="text-sm font-medium">{title}</p>
      {topCategories.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No category spend in this period.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {topCategories.map((category) => (
            <div key={category.name} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium">{category.name}</span>
                <span className="tabular text-muted-foreground">{formatCurrency(category.amount)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${Math.max(4, (category.amount / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CashflowSankey({
  data,
  formatCurrency,
  formatCompactCurrency,
}: {
  data: CashflowData;
  formatCurrency: (v: number) => string;
  formatCompactCurrency: (v: number) => string;
}) {
  const summary = [
    { label: "Income", value: data.summary.income, color: "bg-emerald-500" },
    { label: "Expenses", value: data.summary.expenses, color: "bg-rose-500" },
    { label: "Debt", value: data.summary.debt, color: "bg-amber-500" },
    { label: "Investments", value: data.summary.investments, color: "bg-sky-500" },
    { label: "Saved", value: data.summary.retained, color: "bg-teal-500" },
  ].filter((item) => item.value > 0);
  const sankeyHeight = Math.max(620, data.nodes.length * 38);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {summary.map((item) => (
          <div key={item.label} className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", item.color)} />
              {item.label}
            </div>
            <p className="mt-1 tabular text-sm font-semibold">{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>
      <div className="w-full overflow-x-auto rounded-md border bg-background">
        <div className="min-w-[1120px]" style={{ height: sankeyHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={data}
            dataKey="value"
            nameKey="name"
            nodePadding={26}
            nodeWidth={12}
            linkCurvature={0.52}
            iterations={24}
            sort={false}
            margin={{ top: 24, right: 170, bottom: 32, left: 96 }}
            node={(props) => <CashflowNode {...props} formatCompactCurrency={formatCompactCurrency} />}
            link={<CashflowLink />}
          >
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" }}
              formatter={(v: number) => [formatCurrency(v), "Amount"]}
            />
          </Sankey>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CashflowNode(props: { x: number; y: number; width: number; height: number; payload: { name: string; value?: number; color?: string }; formatCompactCurrency: (v: number) => string }) {
  const { x, y, width, height, payload, formatCompactCurrency } = props;
  const isRightSide = x > 760;
  const textX = isRightSide ? x + width + 10 : x + width + 8;
  const anchor = "start";
  const labelY = y + Math.max(12, height / 2 - 4);
  const displayName = payload.name.length > 22 ? `${payload.name.slice(0, 21)}…` : payload.name;

  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(4, height)} rx={3} fill={payload.color ?? "hsl(var(--primary))"} />
      <text x={textX} y={labelY} textAnchor={anchor} fill="hsl(var(--foreground))" fontSize={11} fontWeight={600}>
        {displayName}
      </text>
      {typeof payload.value === "number" && payload.value > 0 ? (
        <text x={textX} y={labelY + 15} textAnchor={anchor} fill="hsl(var(--muted-foreground))" fontSize={10} fontWeight={500}>
          {formatCompactCurrency(payload.value)}
        </text>
      ) : null}
    </g>
  );
}

function CashflowLink(props: { sourceX?: number; sourceY?: number; sourceControlX?: number; targetX?: number; targetY?: number; targetControlX?: number; linkWidth?: number; payload?: { color?: string } }) {
  const { sourceX = 0, sourceY = 0, sourceControlX = 0, targetX = 0, targetY = 0, targetControlX = 0, linkWidth = 1, payload } = props;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={payload?.color ?? "hsla(204, 80%, 55%, 0.28)"}
      strokeWidth={Math.max(1, linkWidth)}
      strokeOpacity={0.9}
    />
  );
}


function AccountBalanceChart({ kind, formatCurrency, formatCompactCurrency }: { kind: string; formatCurrency: (v: number) => string; formatCompactCurrency: (v: number) => string }) {
  const [period, setPeriod] = React.useState(kind === "WEEK" ? "WEEK" : kind === "YEAR" ? "YEAR" : "MONTH");
  const { data } = useSWR<{ series: Array<Record<string, unknown>>; accounts: Array<{ id: string; name: string }> }>(`/api/reports/account-history?kind=${period}`);

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(160 60% 45%)"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Account balance trend</CardTitle>
            <CardDescription>How your account balances fluctuated over time</CardDescription>
          </div>
          <div className="flex rounded-md border">
            {["WEEK", "MONTH", "YEAR"].map((p) => (
              <Button key={p} variant={period === p ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-2.5" onClick={() => setPeriod(p)}>
                {p === "WEEK" ? "W" : p === "MONTH" ? "M" : "Y"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.series.length === 0 ? (<EmptyState title="No data" />) : (
          <>
            <div className="h-[220px] w-full sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" }} formatter={(v: number) => [formatCurrency(v)]} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--foreground))" strokeWidth={2.5} dot={false} name="Total" />
                  {data.accounts.map((a, i) => (
                    <Line key={a.id} type="monotone" dataKey={a.name} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={a.name} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-foreground" />Total</span>
              {data.accounts.map((a, i) => (
                <span key={a.id} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: COLORS[i % COLORS.length], opacity: 0.7 }} />{a.name}</span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NetWorthChart({ formatCurrency, formatCompactCurrency }: { formatCurrency: (v: number) => string; formatCompactCurrency: (v: number) => string }) {
  const [period, setPeriod] = React.useState("YEAR");
  const [filter, setFilter] = React.useState("ALL");
  const { data } = useSWR<Array<{ date: string; assets: number; liabilities: number; investments: number; netWorth: number; filtered: number }>>(`/api/reports/networth-history?kind=${period}&filter=${filter}`);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Net worth over time</CardTitle>
            <CardDescription>Track how your wealth grows</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Net Worth (All)</SelectItem>
                <SelectItem value="ASSETS">Bank Accounts</SelectItem>
                <SelectItem value="LIABILITIES">Liabilities</SelectItem>
                <SelectItem value="INVESTMENTS">All Investments</SelectItem>
                <SelectItem value="STOCKS">Stocks only</SelectItem>
                <SelectItem value="MF">Mutual Funds</SelectItem>
                <SelectItem value="BONDS">Bonds</SelectItem>
                <SelectItem value="FD">Fixed Deposits</SelectItem>
                <SelectItem value="PF">Provident Fund</SelectItem>
                <SelectItem value="GOLD">Gold</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-md border">
              {["WEEK", "MONTH", "YEAR"].map((p) => (
                <Button key={p} variant={period === p ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-2.5" onClick={() => setPeriod(p)}>
                  {p === "WEEK" ? "W" : p === "MONTH" ? "M" : "Y"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (<EmptyState title="Not enough data" description="Add transactions to see trends." />) : (
          <>
            <div className="h-[220px] w-full sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" }} formatter={(v: number, key) => [formatCurrency(v), key]} />
                  {filter === "ALL" ? (
                    <>
                      <Line type="monotone" dataKey="netWorth" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} name="Net Worth" />
                      <Line type="monotone" dataKey="assets" stroke="hsl(var(--chart-2))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Assets" />
                      <Line type="monotone" dataKey="investments" stroke="hsl(var(--chart-3))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Investments" />
                      <Line type="monotone" dataKey="liabilities" stroke="hsl(var(--chart-5))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Liabilities" />
                    </>
                  ) : (
                    <Line type="monotone" dataKey="filtered" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} name={filter} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {filter === "ALL" ? (
                <>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--chart-1))" }} />Net Worth</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--chart-2))" }} />Bank Accounts</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--chart-3))" }} />Investments</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--chart-5))" }} />Liabilities</span>
                </>
              ) : (
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--chart-1))" }} />{filter}</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


function DistributionChart() {
  const { data: portfolio } = useSWR<{
    totalCurrentValue: number;
    holdings: Array<{ id: string; name: string; symbol: string; assetClass: string; currentValue: number; type: string }>;
  }>("/api/investments");
  const { data: accounts } = useSWR<Array<{ id: string; name: string; type: string; balance: string }>>("/api/accounts");
  const { formatCurrency: fmtCurrency } = useCurrency();
  const [groupBy, setGroupBy] = React.useState<"class" | "holding" | "subcategory">("holding");

  const COLORS = [
    "hsl(221 83% 53%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(271 81% 56%)",
    "hsl(0 72% 51%)", "hsl(190 80% 45%)", "hsl(45 93% 47%)", "hsl(210 10% 65%)",
    "hsl(160 60% 45%)", "hsl(250 70% 55%)", "hsl(330 70% 50%)", "hsl(80 60% 45%)",
    "hsl(200 80% 50%)", "hsl(15 80% 55%)", "hsl(280 60% 60%)", "hsl(120 50% 40%)",
    "hsl(60 70% 50%)", "hsl(300 50% 55%)", "hsl(170 70% 40%)", "hsl(240 60% 55%)",
  ];

  const bankTotal = (accounts ?? [])
    .filter((a) => ["SAVINGS", "CASH"].includes(a.type))
    .reduce((s, a) => s + Number(a.balance), 0);

  const holdings = portfolio?.holdings ?? [];

  const slices = React.useMemo(() => {
    if (groupBy === "class") {
      const byClass: Record<string, number> = {};
      if (bankTotal > 0) byClass["Bank Accounts"] = bankTotal;
      for (const h of holdings) {
        const label = getAssetClassLabel(h.assetClass);
        byClass[label] = (byClass[label] ?? 0) + h.currentValue;
      }
      return Object.entries(byClass)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
    }

    if (groupBy === "subcategory") {
      // Group ETFs by underlying (gold/silver/index), MFs individually, others by class
      const groups: Record<string, number> = {};
      if (bankTotal > 0) groups["Bank Accounts"] = bankTotal;
      for (const h of holdings) {
        if (h.currentValue <= 0) continue;
        let label: string;
        if (h.assetClass === "ETF") {
          // Auto-detect subcategory from name/symbol
          const sym = (h.symbol + h.name).toLowerCase();
          if (sym.includes("gold") || sym.includes("goldbees")) label = "Gold ETF";
          else if (sym.includes("silver") || sym.includes("silverbees")) label = "Silver ETF";
          else if (sym.includes("nifty") || sym.includes("sensex") || sym.includes("index")) label = "Index ETF";
          else if (sym.includes("bank")) label = "Banking ETF";
          else if (sym.includes("it") || sym.includes("tech")) label = "IT ETF";
          else label = `ETF: ${h.name}`;
        } else if (h.assetClass === "MUTUAL_FUND") {
          label = h.name; // Each MF is its own slice
        } else {
          label = getAssetClassLabel(h.assetClass);
        }
        groups[label] = (groups[label] ?? 0) + h.currentValue;
      }
      return Object.entries(groups)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
    }

    // By individual holding
    const items: Array<{ name: string; value: number; color: string }> = [];
    if (bankTotal > 0) items.push({ name: "Bank Accounts", value: bankTotal, color: COLORS[0] });
    holdings
      .filter((h) => h.currentValue > 0)
      .sort((a, b) => b.currentValue - a.currentValue)
      .forEach((h, i) => {
        items.push({ name: `${h.name} (${h.symbol})`, value: h.currentValue, color: COLORS[(i + 1) % COLORS.length] });
      });
    return items;
  }, [groupBy, holdings, bankTotal]);

  const total = slices.reduce((s, sl) => s + sl.value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Portfolio distribution</CardTitle>
            <CardDescription>Complete breakdown of all your assets</CardDescription>
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "class" | "holding" | "subcategory")}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="class">By asset class</SelectItem>
              <SelectItem value="subcategory">By subcategory (ETF/MF split)</SelectItem>
              <SelectItem value="holding">By individual holding</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (<EmptyState title="No assets" description="Add accounts or investments to see distribution." />) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="h-[220px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" }} formatter={(v: number) => [fmtCurrency(v)]} />
                  <Pie data={slices} dataKey="value" innerRadius={60} outerRadius={120} paddingAngle={1} stroke="hsl(var(--background))" strokeWidth={2}>
                    {slices.map((s, i) => (<Cell key={i} fill={s.color} />))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
              <ul className="space-y-2 text-sm pr-2">
                {slices.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="tabular text-xs text-muted-foreground whitespace-nowrap">
                      {fmtCurrency(s.value)} · {total > 0 ? formatPercent(s.value / total) : "0%"}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular">{fmtCurrency(total)}</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
