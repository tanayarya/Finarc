"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCurrency } from "@/components/currency-provider";

interface Props {
  data: Array<{ date: string; income: number; expense: number; net: number }>;
}

export function IncomeExpenseChart({ data }: Props) {
  const { formatCurrency, formatCompactCurrency } = useCurrency();
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis
            tickFormatter={(v) => formatCompactCurrency(v)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            width={60}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12, color: "hsl(var(--popover-foreground))",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number, key) => [formatCurrency(value), key]}
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fill="url(#incomeFill)"
            name="Income"
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="hsl(var(--chart-5))"
            strokeWidth={2}
            fill="url(#expenseFill)"
            name="Expense"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
