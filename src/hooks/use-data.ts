"use client";

import useSWR from "swr";

export interface AccountWithBalance {
  id: string;
  name: string;
  type: "SAVINGS" | "CASH" | "CREDIT" | "LOAN" | "INVESTMENT";
  currency: string;
  balance: string;
  openingBalance: string;
  creditLimit: string | null;
  statementDay: number | null;
  dueDay: number | null;
  archived: boolean;
  institution: string | null;
  notes: string | null;
  savingsInterestRate: string | null;
  savingsInterestFrequency: "MONTHLY" | "QUARTERLY" | null;
  color: string | null;
  icon: string | null;
}

export interface Category {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  color: string | null;
  icon: string | null;
  archived: boolean;
}

export interface TransactionRow {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "CREDIT_PAYMENT" | "LOAN_PAYMENT";
  amount: string;
  occurredAt: string;
  description: string | null;
  account: AccountWithBalance | null;
  fromAccount: AccountWithBalance | null;
  toAccount: AccountWithBalance | null;
  category: Category | null;
  trade?: {
    id: string;
    action: "BUY" | "SELL" | "SIP_BUY" | "DIVIDEND" | "INTEREST" | "MATURITY";
    holding?: { id: string; name: string; assetClass: string } | null;
  } | null;
  taxDeductible?: boolean;
}

export interface BudgetWithProgress {
  id: string;
  name: string;
  category: Category;
  allocated: string;
  spent: string;
  remaining: string;
  usage: number;
  status: "HEALTHY" | "NEAR_LIMIT" | "OVER_BUDGET";
  period: "WEEKLY" | "MONTHLY" | "YEARLY";
  periodStart: string;
  periodEnd: string;
}

export function useAccounts(includeArchived = false) {
  return useSWR<AccountWithBalance[]>(`/api/accounts${includeArchived ? "?includeArchived=1" : ""}`);
}

export function useCategories(kind?: "INCOME" | "EXPENSE") {
  return useSWR<Category[]>(`/api/categories${kind ? `?kind=${kind}` : ""}`);
}

export function useBudgets() {
  return useSWR<BudgetWithProgress[]>("/api/budgets");
}

export function useTransactions(query: string = "") {
  return useSWR<{ items: TransactionRow[]; total: number; take: number; skip: number }>(
    `/api/transactions${query ? `?${query}` : ""}`
  );
}

export interface DashboardData {
  range: { kind: string; from: string; to: string; label: string };
  summary: {
    totalAssets: string;
    totalLiabilities: string;
    netWorth: string;
    income: string;
    expense: string;
    net: string;
    savingsRate: number;
    previousIncome: string;
    previousExpense: string;
    previousNet: string;
  };
  series: Array<{ date: string; income: number; expense: number; net: number }>;
  categoryBreakdown: Array<{ categoryId: string; name: string; color: string | null; amount: number; share: number }>;
  accountDistribution: Array<{ accountId: string; name: string; type: string; amount: number; share: number }>;
  budgets: Array<{
    id: string;
    name: string;
    category: { id: string; name: string; color: string | null };
    allocated: string;
    spent: string;
    remaining: string;
    usage: number;
    status: "HEALTHY" | "NEAR_LIMIT" | "OVER_BUDGET";
    period: "WEEKLY" | "MONTHLY" | "YEARLY";
  }>;
  creditObligations: Array<{
    id: string;
    name: string;
    type: "CREDIT" | "LOAN";
    statementDay: number | null;
    dueDay: number | null;
    dueDate: string | null;
    daysUntilDue: number | null;
    dueMonthRelation: "same_month" | "next_month" | null;
    creditLimit: string | null;
    balance: string;
  }>;
  recentTransactions: TransactionRow[];
  upcomingRecurring: Array<{
    ruleId: string;
    name: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amount: string;
    date: string;
  }>;
  portfolio: {
    totalInvested: number;
    totalCurrentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    holdingsCount: number;
    byType: Record<string, number>;
  };
  maturedHoldings: Array<{
    id: string;
    name: string;
    assetClass: string;
    type: "BOND" | "FIXED_DEPOSIT";
    accountName: string;
    maturityDate: string | null;
    principal: number;
    interestFreq: string | null;
    dismissMarker: string;
  }>;
  savingsInterestReviews: Array<{
    accountId: string;
    accountName: string;
    frequency: "MONTHLY" | "QUARTERLY";
    rate: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    amount: string;
    dismissMarker: string;
  }>;
  bondInterestReviews: Array<{
    holdingId: string;
    name: string;
    accountId: string;
    accountName: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    principal: string;
    rate: string;
    tdsRate: string;
    grossInterest: string;
    tdsAmount: string;
    netAmount: string;
    dismissMarker: string;
  }>;
}

export function useDashboard(query: string = "") {
  return useSWR<DashboardData>(`/api/dashboard${query ? `?${query}` : ""}`);
}
