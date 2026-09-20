"use client";

import { ArrowDownLeft, ArrowUpRight, CreditCard, Landmark, ReceiptText, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { RangePicker, type RangeValue } from "@/components/dashboard/range-picker";
import { useCurrency } from "@/components/currency-provider";

export interface AccountPeriodInsights {
  range: { kind: string; from: string; to: string; label: string };
  totalCredits: string;
  totalDebits: string;
  incomeReceived: string;
  interestCredited: string;
  cardSpend: string;
  paymentsReceived: string;
  refundsReceived: string;
  topCategories: Array<{ categoryId: string; name: string; color: string | null; amount: string }>;
  transactionCount: number;
}

interface Props {
  accountType: "SAVINGS" | "CREDIT";
  balance: number;
  creditLimit: number | null;
  insights: AccountPeriodInsights;
  range: RangeValue;
  onRangeChange: (range: RangeValue) => void;
}

export function AccountInsights({
  accountType,
  balance,
  creditLimit,
  insights,
  range,
  onRangeChange,
}: Props) {
  const { formatCurrency } = useCurrency();
  const isCredit = accountType === "CREDIT";
  const availableCredit = creditLimit === null ? null : Math.max(0, creditLimit - balance);
  const netMovement = Number(insights.totalCredits) - Number(insights.totalDebits);

  const metrics = isCredit
    ? [
        { label: "Card spend", value: insights.cardSpend, Icon: CreditCard, tone: "text-rose-500" },
        { label: "Payments received", value: insights.paymentsReceived, Icon: ArrowDownLeft, tone: "text-emerald-500" },
        { label: "Refunds & credits", value: insights.refundsReceived, Icon: ReceiptText, tone: "text-sky-500" },
        { label: "Available credit", value: availableCredit, Icon: Landmark, tone: "text-violet-500" },
      ]
    : [
        { label: "Total credited", value: insights.totalCredits, Icon: ArrowDownLeft, tone: "text-emerald-500" },
        { label: "Total debited", value: insights.totalDebits, Icon: ArrowUpRight, tone: "text-rose-500" },
        { label: "Income received", value: insights.incomeReceived, Icon: Landmark, tone: "text-sky-500" },
        { label: "Interest credited", value: insights.interestCredited, Icon: Sparkles, tone: "text-amber-500" },
      ];

  return (
    <section className="space-y-3" aria-label="Account period summary">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold">Account activity</h3>
          <p className="text-xs text-muted-foreground">{insights.range.label} · {insights.transactionCount} transaction{insights.transactionCount === 1 ? "" : "s"}</p>
        </div>
        <RangePicker value={range} onChange={onRangeChange} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, Icon, tone }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="flex min-h-24 flex-col justify-between p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <p className="mt-3 truncate tabular text-lg font-semibold">{formatCurrency(value ?? 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={`grid gap-3 rounded-md border bg-muted/20 p-4 ${isCredit ? "" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"}`}>
        {!isCredit ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Net cash movement</p>
            <>
              <p className={`tabular text-sm font-semibold ${netMovement < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {netMovement > 0 ? "+" : ""}{formatCurrency(netMovement)}
              </p>
              <p className="text-xs text-muted-foreground">Credits less debits in this period</p>
            </>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Top spending categories</p>
          {insights.topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categorized spending in this period.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {insights.topCategories.map((category) => (
                <div key={category.categoryId} className="min-w-0 border-l-2 pl-2" style={{ borderColor: category.color ?? "hsl(var(--muted-foreground))" }}>
                  <p className="truncate text-sm font-medium">{category.name}</p>
                  <p className="tabular text-xs text-muted-foreground">{formatCurrency(category.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
