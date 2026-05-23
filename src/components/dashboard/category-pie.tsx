"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useCurrency } from "@/components/currency-provider";
import { formatPercent } from "@/lib/format";

interface Slice {
  name: string;
  amount: number;
  share: number;
  color?: string | null;
}

const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220 60% 50%)",
  "hsl(160 60% 45%)",
  "hsl(30 80% 55%)",
];

export function CategoryPie({ data }: { data: Slice[] }) {
  const { formatCurrency } = useCurrency();

  if (data.length === 0)
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No data in this period
      </p>
    );
  return (
    <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-2">
      <div className="h-[200px] w-full">
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
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.slice(0, 8).map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: d.color ?? PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="tabular text-muted-foreground">
              {formatCurrency(d.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
