"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useCurrency } from "@/components/currency-provider";
import { formatPercent } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/category-colors";

interface Slice {
  name: string;
  amount: number;
  share: number;
  color?: string | null;
}

export function CategoryPie({ data }: { data: Slice[] }) {
  const { formatCurrency } = useCurrency();
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  if (data.length === 0)
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No data in this period
      </p>
    );
  return (
    <div className="grid grid-cols-1 items-center gap-4 xl:grid-cols-5">
      <div className="relative h-[240px] w-full xl:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12, color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value: number, _n, p) => [
                `${formatCurrency(value)} (${formatPercent(p.payload.share)})`,
                p.payload.name,
              ]}
            />
            <Pie
              data={data}
              dataKey="amount"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[120px] text-center">
            <p className="truncate text-[11px] text-muted-foreground">Total spent</p>
            <p className="truncate tabular text-sm font-semibold">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-2 text-sm sm:grid-cols-2 xl:col-span-3">
        {data.slice(0, 10).map((d, i) => (
          <li key={d.name} className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: d.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
                <span className="truncate font-medium">{d.name}</span>
              </span>
              <span className="shrink-0 tabular text-xs text-muted-foreground">
                {formatPercent(d.share)}
              </span>
            </div>
            <div className="mt-1 tabular text-xs text-muted-foreground">
              {formatCurrency(d.amount)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
