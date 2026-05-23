"use client";

import { format } from "date-fns";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, CreditCard, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { TransactionRow as TxRow } from "@/hooks/use-data";

const ICONS = {
  INCOME: ArrowDownLeft,
  EXPENSE: ArrowUpRight,
  TRANSFER: ArrowLeftRight,
  CREDIT_PAYMENT: CreditCard,
  LOAN_PAYMENT: Landmark,
} as const;

export function TransactionRow({ tx }: { tx: TxRow }) {
  const Icon = ICONS[tx.type];
  const isInvestmentFlow = Boolean(tx.trade);
  const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : "";
  const tone =
    isInvestmentFlow
      ? "text-foreground"
      : tx.type === "INCOME"
      ? "text-emerald-600 dark:text-emerald-400"
      : tx.type === "EXPENSE"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  // Use the account's currency for display
  const currency =
    tx.account?.currency ??
    tx.fromAccount?.currency ??
    tx.toAccount?.currency ??
    "USD";

  const subtitle = (() => {
    if (tx.type === "INCOME" || tx.type === "EXPENSE") {
      if (isInvestmentFlow) return [tx.account?.name, tx.trade?.holding?.name].filter(Boolean).join(" · ");
      return [tx.account?.name, tx.category?.name].filter(Boolean).join(" · ");
    }
    if (tx.type === "TRANSFER" || tx.type === "CREDIT_PAYMENT" || tx.type === "LOAN_PAYMENT") {
      return `${tx.fromAccount?.name ?? "?"} → ${tx.toAccount?.name ?? "?"}`;
    }
    return "";
  })();

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {tx.description || labelFor(tx)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {format(new Date(tx.occurredAt), "MMM d, yyyy")} · {subtitle}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className={cn("tabular text-sm font-medium", tone)}>
          {sign}
          {formatCurrency(tx.amount, currency)}
        </span>
        {isInvestmentFlow || tx.type !== "INCOME" && tx.type !== "EXPENSE" ? (
          <Badge variant="muted" className="text-[10px]">
            {labelFor(tx)}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function labelFor(tx: TxRow | TxRow["type"]) {
  if (typeof tx !== "string" && tx.trade) {
    if (tx.trade.action === "SELL" || tx.trade.action === "MATURITY") return "Investment redemption";
    if (tx.trade.action === "DIVIDEND" || tx.trade.action === "INTEREST") return "Investment income";
    return "Investment buy";
  }
  const t = typeof tx === "string" ? tx : tx.type;
  return {
    INCOME: "Income",
    EXPENSE: "Expense",
    TRANSFER: "Transfer",
    CREDIT_PAYMENT: "Credit payment",
    LOAN_PAYMENT: "Loan payment",
  }[t];
}
