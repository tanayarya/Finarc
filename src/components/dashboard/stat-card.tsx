import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

interface StatCardProps {
  title: string;
  value: string;
  hint?: string;
  delta?: number;
  invertDelta?: boolean;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, hint, delta, invertDelta, icon }: StatCardProps) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const positive = showDelta && (invertDelta ? delta! < 0 : delta! > 0);
  const negative = showDelta && (invertDelta ? delta! > 0 : delta! < 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="tabular text-lg font-semibold sm:text-2xl truncate">{value}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {showDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                positive && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                negative && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                !positive && !negative && "bg-muted text-muted-foreground"
              )}
            >
              {positive ? <ArrowUpRight className="h-3 w-3" /> : null}
              {negative ? <ArrowDownRight className="h-3 w-3" /> : null}
              {!positive && !negative ? <Minus className="h-3 w-3" /> : null}
              {formatPercent(Math.abs(delta!), 1)}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
