"use client";

import { Clock3, TrendingDown, TrendingUp, WalletCards } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/components/currency-provider";
import { useCommitmentForecast } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

export function CashRunwayMetrics() {
  const { data, isLoading } = useCommitmentForecast();
  const { formatCurrency } = useCurrency();

  if (isLoading || !data) return <CashRunwayMetricsSkeleton />;

  const next30Negative = data.next30Days.net.startsWith("-");

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric
        icon={WalletCards}
        label="Liquid now"
        value={formatCurrency(data.liquidBalance)}
        detail={`${data.liquidAccountCount} savings/cash account${data.liquidAccountCount === 1 ? "" : "s"}`}
      />
      <Metric
        icon={next30Negative ? TrendingDown : TrendingUp}
        label="Next 30 days"
        value={`${next30Negative ? "" : "+"}${formatCurrency(data.next30Days.net)}`}
        detail={`Projected ${formatCurrency(data.next30Days.projectedBalance)}`}
        tone={next30Negative ? "negative" : "positive"}
      />
      <Metric
        icon={Clock3}
        label="Runway"
        value={data.runwayMonths === null ? "—" : `${data.runwayMonths.toFixed(1)} months`}
        detail={data.runwayMonths === null ? "No known scheduled outflow" : `${formatCurrency(data.monthlyKnownOutflow)} known outflow/month`}
      />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        <p className={cn("mt-2 truncate tabular text-xl font-semibold", tone === "negative" && "text-destructive", tone === "positive" && "text-emerald-600 dark:text-emerald-400")}>{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function CashRunwayMetricsSkeleton() {
  return <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
}
