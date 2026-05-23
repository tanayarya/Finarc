"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { Plus, RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Banknote, Building2, LineChart as LineChartIcon, BarChart3, Shield, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Cell, Pie, PieChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrency } from "@/components/currency-provider";
import { useAccounts } from "@/hooks/use-data";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAssetClassLabel, getAssetClassColor } from "@/lib/finance/asset-classes";
import { BuyDialog } from "@/components/investments/buy-dialog";
import { SellDialog } from "@/components/investments/sell-dialog";
import { AddQuantityDialog } from "@/components/investments/add-quantity-dialog";
import { EditHoldingDialog } from "@/components/investments/edit-holding-dialog";

interface HoldingItem {
  id: string;
  type: "STOCK" | "MUTUAL_FUND" | "BOND" | "FIXED_DEPOSIT" | "PROVIDENT_FUND" | "COMMODITY";
  assetClass: string;
  symbol: string;
  name: string;
  units: number;
  avgBuyPrice: number;
  currentPrice: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  lastPriceUpdate: string | null;
  accountId: string;
  accountName: string;
  interestRate: number | null;
  interestFreq: string | null;
  maturityDate: string | null;
  tags: string[];
}

interface PortfolioData {
  totalInvested: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  holdings: HoldingItem[];
}

const TYPE_ICONS = {
  STOCK: TrendingUp,
  MUTUAL_FUND: LineChartIcon,
  BOND: Banknote,
  FIXED_DEPOSIT: Building2,
  PROVIDENT_FUND: Shield,
  COMMODITY: TrendingUp,
} as const;

const TYPE_LABELS: Record<string, string> = {
  STOCK: "Stock",
  MUTUAL_FUND: "Mutual Fund",
  BOND: "Bond",
  FIXED_DEPOSIT: "Fixed Deposit",
  PROVIDENT_FUND: "Provident Fund",
};

const TYPE_COLORS: Record<string, string> = {
  STOCK: "hsl(var(--chart-1))",
  MUTUAL_FUND: "hsl(var(--chart-2))",
  BOND: "hsl(var(--chart-3))",
  FIXED_DEPOSIT: "hsl(var(--chart-4))",
  PROVIDENT_FUND: "hsl(var(--chart-5))",
};

export default function InvestmentsPage() {
  const { data, isLoading } = useSWR<PortfolioData>("/api/investments");
  const { data: accounts } = useAccounts();
  const { formatCurrency, formatCompactCurrency } = useCurrency();
  const [buyOpen, setBuyOpen] = React.useState(false);
  const [sellHolding, setSellHolding] = React.useState<HoldingItem | null>(null);
  const [addHolding, setAddHolding] = React.useState<HoldingItem | null>(null);
  const [editHolding, setEditHolding] = React.useState<HoldingItem | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("finarc_inv_view") as "grid" | "list") ?? "grid";
    }
    return "grid";
  });

  React.useEffect(() => {
    localStorage.setItem("finarc_inv_view", viewMode);
  }, [viewMode]);
  const [pieDetail, setPieDetail] = React.useState(false); // false = by class, true = by individual holding
  const [chartFilter, setChartFilter] = React.useState("ALL");

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/investments/refresh", { method: "POST" });
      toast.success("Prices updated");
      mutate("/api/investments");
    } catch { toast.error("Failed to refresh"); }
    finally { setRefreshing(false); }
  };

  const holdings = data?.holdings ?? [];
  const stocks = holdings.filter((h) => h.type === "STOCK");
  const mfs = holdings.filter((h) => h.type === "MUTUAL_FUND");
  const bonds = holdings.filter((h) => h.type === "BOND");
  const fds = holdings.filter((h) => h.type === "FIXED_DEPOSIT");
  const pfs = holdings.filter((h) => h.type === "PROVIDENT_FUND");

  // Total wealth pie: investments + bank accounts
  const bankTotal = (accounts ?? [])
    .filter((a) => ["SAVINGS", "CASH"].includes(a.type))
    .reduce((s, a) => s + Number(a.balance), 0);
  const investmentsByType = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.assetClass] = (acc[h.assetClass] ?? 0) + h.currentValue;
    return acc;
  }, {});

  const wealthSlices = React.useMemo(() => [
    { name: "Bank Accounts", value: bankTotal, color: "hsl(160 60% 45%)" },
    ...Object.entries(investmentsByType).map(([cls, value]) => ({
      name: getAssetClassLabel(cls),
      value,
      color: getAssetClassColor(cls),
    })),
  ].filter((s) => s.value > 0), [bankTotal, investmentsByType]);

  const totalWealth = wealthSlices.reduce((s, sl) => s + sl.value, 0);

  // Detailed slices: each individual holding as its own slice
  const DETAIL_COLORS = [
    "hsl(221 83% 53%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(271 81% 56%)",
    "hsl(0 72% 51%)", "hsl(190 80% 45%)", "hsl(45 93% 47%)", "hsl(210 10% 65%)",
    "hsl(160 60% 45%)", "hsl(250 70% 55%)", "hsl(330 70% 50%)", "hsl(80 60% 45%)",
    "hsl(200 80% 50%)", "hsl(15 80% 55%)", "hsl(280 60% 60%)", "hsl(120 50% 40%)",
    "hsl(60 70% 50%)", "hsl(300 50% 55%)", "hsl(170 70% 40%)", "hsl(240 60% 55%)",
  ];
  const detailedSlices = React.useMemo(() => [
    ...(bankTotal > 0 ? [{ name: "Bank Accounts", value: bankTotal, color: "hsl(160 60% 45%)" }] : []),
    ...holdings.map((h, i) => ({
      name: `${h.name} (${getAssetClassLabel(h.assetClass)})`,
      value: h.currentValue,
      color: DETAIL_COLORS[(i + 1) % DETAIL_COLORS.length],
    })),
  ].filter((s) => s.value > 0), [bankTotal, holdings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Investments</h2>
          <p className="text-sm text-muted-foreground">Track stocks, mutual funds, bonds, FDs, and provident fund.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setBuyOpen(true)}>
            <Plus className="h-4 w-4" /> Buy / Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-4"><Skeleton className="h-[100px]" /><Skeleton className="h-[100px]" /><Skeleton className="h-[100px]" /><Skeleton className="h-[100px]" /></div>
      ) : holdings.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="No investments yet"
          description="Buy stocks, mutual funds, bonds, FDs, or add PF contributions."
          action={<Button onClick={() => setBuyOpen(true)}><Plus className="h-4 w-4" /> Add investment</Button>}
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invested</CardTitle></CardHeader><CardContent><p className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(data!.totalInvested)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current value</CardTitle></CardHeader><CardContent><p className="tabular text-lg font-semibold sm:text-2xl">{formatCurrency(data!.totalCurrentValue)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">P&L</CardTitle></CardHeader><CardContent><p className={cn("tabular text-lg font-semibold sm:text-2xl", data!.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600")}>{data!.totalPnl >= 0 ? "+" : ""}{formatCurrency(data!.totalPnl)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Returns</CardTitle></CardHeader><CardContent><p className={cn("tabular text-lg font-semibold sm:text-2xl", data!.totalPnlPercent >= 0 ? "text-emerald-600" : "text-rose-600")}>{data!.totalPnlPercent >= 0 ? "+" : ""}{data!.totalPnlPercent.toFixed(2)}%</p></CardContent></Card>
          </div>

          {/* Charts section — above tabs */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Total wealth pie */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Total wealth distribution</CardTitle>
                    <CardDescription>{pieDetail ? "By individual holding" : "By asset class"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{pieDetail ? "Detailed" : "Overview"}</span>
                    <Switch checked={pieDetail} onCheckedChange={setPieDetail} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <WealthPieChart
                  key={pieDetail ? "detailed" : "overview"}
                  slices={pieDetail ? detailedSlices : wealthSlices}
                  total={totalWealth}
                  formatCurrency={formatCurrency}
                />
              </CardContent>
            </Card>

            {/* Asset type allocation */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Investment allocation</CardTitle><CardDescription>By asset class</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(investmentsByType).map(([cls, value]) => {
                    const share = data!.totalCurrentValue > 0 ? value / data!.totalCurrentValue : 0;
                    return (
                      <div key={cls} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: getAssetClassColor(cls) }} />
                            <span className="font-medium">{getAssetClassLabel(cls)}</span>
                          </span>
                          <span className="tabular text-muted-foreground">{formatCurrency(value)} · {formatPercent(share)}</span>
                        </div>
                        <Progress value={share * 100} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Holdings tabs */}
          <Tabs defaultValue="all">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <TabsList className="flex-wrap">
                <TabsTrigger value="all">All ({holdings.length})</TabsTrigger>
                {stocks.length > 0 && <TabsTrigger value="stocks">Stocks ({stocks.length})</TabsTrigger>}
                {mfs.length > 0 && <TabsTrigger value="mf">MF ({mfs.length})</TabsTrigger>}
                {bonds.length > 0 && <TabsTrigger value="bonds">Bonds ({bonds.length})</TabsTrigger>}
                {fds.length > 0 && <TabsTrigger value="fd">FDs ({fds.length})</TabsTrigger>}
                {pfs.length > 0 && <TabsTrigger value="pf">PF ({pfs.length})</TabsTrigger>}
              </TabsList>
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-r-none"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-l-none border-l"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <TabsContent value="all">{viewMode === "grid" ? <HoldingsList holdings={holdings} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} /> : <HoldingsTable holdings={holdings} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} />}</TabsContent>
            <TabsContent value="stocks">{viewMode === "grid" ? <HoldingsList holdings={stocks} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} /> : <HoldingsTable holdings={stocks} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} />}</TabsContent>
            <TabsContent value="mf">{viewMode === "grid" ? <HoldingsList holdings={mfs} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} /> : <HoldingsTable holdings={mfs} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} />}</TabsContent>
            <TabsContent value="bonds">{viewMode === "grid" ? <HoldingsList holdings={bonds} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} /> : <HoldingsTable holdings={bonds} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} />}</TabsContent>
            <TabsContent value="fd">{viewMode === "grid" ? <HoldingsList holdings={fds} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} /> : <HoldingsTable holdings={fds} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} />}</TabsContent>
            <TabsContent value="pf">{viewMode === "grid" ? <HoldingsList holdings={pfs} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} /> : <HoldingsTable holdings={pfs} formatCurrency={formatCurrency} onSell={setSellHolding} onAdd={setAddHolding} onEdit={setEditHolding} />}</TabsContent>
          </Tabs>
        </>
      )}

      <BuyDialog open={buyOpen} onOpenChange={setBuyOpen} />
      <SellDialog open={Boolean(sellHolding)} onOpenChange={(o) => { if (!o) setSellHolding(null); }} holding={sellHolding} />
      <AddQuantityDialog open={Boolean(addHolding)} onOpenChange={(o) => { if (!o) setAddHolding(null); }} holding={addHolding} />
      <EditHoldingDialog open={Boolean(editHolding)} onOpenChange={(o) => { if (!o) setEditHolding(null); }} holding={editHolding} />
    </div>
  );
}

function HoldingsList({
  holdings,
  formatCurrency,
  onSell,
  onAdd,
  onEdit,
}: {
  holdings: HoldingItem[];
  formatCurrency: (v: number | string | null | undefined) => string;
  onSell: (h: HoldingItem) => void;
  onAdd: (h: HoldingItem) => void;
  onEdit: (h: HoldingItem) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {holdings.map((h) => {
        const Icon = TYPE_ICONS[h.type] ?? TrendingUp;
        const positive = h.pnl >= 0;
        const isFdBondPf = h.type === "FIXED_DEPOSIT" || h.type === "BOND" || h.type === "PROVIDENT_FUND";
        return (
          <Card key={h.id} className="transition-colors hover:border-foreground/20">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardDescription className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {getAssetClassLabel(h.assetClass)}</CardDescription>
                <CardTitle className="text-base">{h.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{h.symbol} · {h.accountName}</p>
              </div>
              <Badge variant={positive ? "success" : "destructive"} className="gap-1">
                {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {positive ? "+" : ""}{h.pnlPercent.toFixed(2)}%
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {isFdBondPf ? (
                  <>
                    <div><p className="text-xs text-muted-foreground">Invested</p><p className="tabular font-medium">{formatCurrency(h.invested)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Current value</p><p className="tabular font-medium">{formatCurrency(h.currentValue)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Growth</p><p className={cn("tabular font-medium", "text-emerald-600")}>{formatCurrency(h.pnl > 0 ? h.pnl : 0)}</p></div>
                    {h.interestRate && <div><p className="text-xs text-muted-foreground">Rate</p><p className="tabular font-medium">{h.interestRate}%</p></div>}
                  </>
                ) : (
                  <>
                    <div><p className="text-xs text-muted-foreground">Units</p><p className="tabular font-medium">{h.units.toFixed(h.type === "STOCK" ? 0 : 3)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Avg price</p><p className="tabular font-medium">{formatCurrency(h.avgBuyPrice)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Current</p><p className="tabular font-medium">{formatCurrency(h.currentPrice)}</p></div>
                    <div><p className="text-xs text-muted-foreground">P&L</p><p className={cn("tabular font-medium", positive ? "text-emerald-600" : "text-rose-600")}>{positive ? "+" : ""}{formatCurrency(h.pnl)}</p></div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {h.lastPriceUpdate ? `Updated ${new Date(h.lastPriceUpdate).toLocaleDateString()}` : isFdBondPf ? (h.maturityDate ? `Matures ${new Date(h.maturityDate).toLocaleDateString()}` : "") : "Price not fetched"}
                </span>
                <div className="flex gap-1.5">
                  {(h.type === "STOCK") && h.units > 0 && (
                    <Button variant="outline" size="sm" onClick={() => onAdd(h)}>Add</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onEdit(h)}>Edit</Button>
                  {h.units > 0 && (
                    <Button variant="outline" size="sm" onClick={() => onSell(h)}>
                      {isFdBondPf ? "Redeem" : "Sell"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


function HoldingsTable({
  holdings,
  formatCurrency,
  onSell,
  onAdd,
  onEdit,
}: {
  holdings: HoldingItem[];
  formatCurrency: (v: number | string | null | undefined) => string;
  onSell: (h: HoldingItem) => void;
  onAdd: (h: HoldingItem) => void;
  onEdit: (h: HoldingItem) => void;
}) {
  return (
    <Card>
      <CardContent className="px-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Avg Price</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Invested</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">P&L</TableHead>
              <TableHead className="text-right">Return</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((h) => {
              const positive = h.pnl >= 0;
              const isFdBondPf = h.type === "FIXED_DEPOSIT" || h.type === "BOND" || h.type === "PROVIDENT_FUND";
              return (
                <TableRow key={h.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{h.name}</p>
                      <p className="text-xs text-muted-foreground">{h.symbol}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted" className="text-[10px]">{getAssetClassLabel(h.assetClass)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {isFdBondPf ? "—" : h.units.toFixed(h.type === "STOCK" ? 0 : 3)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {isFdBondPf ? "—" : formatCurrency(h.avgBuyPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {isFdBondPf ? "—" : formatCurrency(h.currentPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(h.invested)}</TableCell>
                  <TableCell className="text-right tabular font-medium">{formatCurrency(h.currentValue)}</TableCell>
                  <TableCell className={cn("text-right tabular font-medium", positive ? "text-emerald-600" : "text-rose-600")}>
                    {positive ? "+" : ""}{formatCurrency(h.pnl)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular", positive ? "text-emerald-600" : "text-rose-600")}>
                    {positive ? "+" : ""}{h.pnlPercent.toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {h.type === "STOCK" && h.units > 0 && (
                          <DropdownMenuItem onClick={() => onAdd(h)}>Add quantities</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(h)}>Edit</DropdownMenuItem>
                        {h.units > 0 && (
                          <DropdownMenuItem onClick={() => onSell(h)}>
                            {isFdBondPf ? "Redeem" : "Sell"}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


function WealthPieChart({
  slices,
  total,
  formatCurrency,
}: {
  slices: Array<{ name: string; value: number; color: string }>;
  total: number;
  formatCurrency: (v: number | string | null | undefined) => string;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" }}
              formatter={(v: number) => [formatCurrency(v)]}
            />
            <Pie data={slices} dataKey="value" innerRadius={50} outerRadius={85} paddingAngle={1} stroke="hsl(var(--background))" strokeWidth={2}>
              {slices.map((s, i) => (<Cell key={i} fill={s.color} />))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="max-h-[220px] overflow-y-auto scrollbar-thin">
        <ul className="space-y-1.5 text-sm pr-2">
          {slices.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="tabular text-xs text-muted-foreground whitespace-nowrap">
                {total > 0 ? formatPercent(s.value / total) : "0%"}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between border-t pt-2 font-medium">
            <span>Total</span>
            <span className="tabular">{formatCurrency(total)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
