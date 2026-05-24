import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { rangeForKind, previousRange, type DateRangeKind } from "@/lib/finance/dates";
import {
  totalsForRange,
  incomeExpenseSeries,
  categoryBreakdown,
  accountDistribution,
} from "@/lib/finance/analytics";
import { computeNetWorth } from "@/lib/finance/balances";
import { computeBudgetProgress } from "@/lib/finance/budgets";
import { upcomingRecurring } from "@/lib/finance/recurring";
import { materializeDueRecurring } from "@/lib/services/recurring";
import { getPortfolioSummary } from "@/lib/services/investments";
import { runAllNotifications } from "@/lib/services/notifications";
import { pendingSavingsInterestReviews } from "@/lib/services/savings-interest";
import { pendingBondInterestReviews } from "@/lib/services/bond-interest";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { addDays, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Auto-materialize any overdue recurring transactions on dashboard load
    await materializeDueRecurring().catch(() => {});
    // Fire notifications (deduped to once per day, won't block)
    runAllNotifications().catch(() => {});

    const sp = req.nextUrl.searchParams;
    const kind = (sp.get("kind") ?? "MONTH") as DateRangeKind;
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const range = rangeForKind(kind, {
      from: fromStr ? new Date(fromStr) : undefined,
      to: toStr ? new Date(toStr) : undefined,
    });
    const prev = previousRange(range);

    const [
      netWorth,
      totals,
      previousTotals,
      series,
      categories,
      accountDist,
      budgets,
      recentTxns,
      upcoming,
      savingsInterestReviews,
      bondInterestReviews,
    ] = await Promise.all([
      computeNetWorth(),
      totalsForRange(range),
      totalsForRange(prev),
      incomeExpenseSeries(range),
      categoryBreakdown(range),
      accountDistribution(),
      computeBudgetProgress(),
      prisma.transaction.findMany({
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: { category: true, account: true, fromAccount: true, toAccount: true },
      }),
      upcomingRecurring(new Date(), addDays(new Date(), 14)),
      pendingSavingsInterestReviews(),
      pendingBondInterestReviews(),
    ]);

    const creditAccounts = await prisma.account.findMany({
      where: { archived: false, type: { in: ["CREDIT", "LOAN"] } },
    });

    // Get investment portfolio for net worth inclusion
    const portfolio = await getPortfolioSummary().catch(() => ({
      totalInvested: 0,
      totalCurrentValue: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      holdings: [],
    }));
    const maturedHoldings = await prisma.holding.findMany({
      where: {
        archived: false,
        maturityDate: { lte: endOfDay(new Date()) },
        OR: [
          { type: "BOND" },
          { type: "FIXED_DEPOSIT" },
          { assetClass: "RECURRING_DEPOSIT" },
        ],
      },
      orderBy: { maturityDate: "asc" },
      take: 5,
      include: { account: true },
    });
    const creditObligations = creditAccounts
      .map((a) => {
        const bal = netWorth.byAccount.find((b) => b.accountId === a.id)?.balance.toFixed(2) ?? "0.00";
        return {
          id: a.id,
          name: a.name,
          type: a.type,
          dueDay: a.dueDay,
          creditLimit: a.creditLimit?.toString() ?? null,
          balance: bal,
        };
      })
      .sort((a, b) => Number(b.balance) - Number(a.balance));

    // Net worth includes account balances + investment current values
    const investmentValue = portfolio.totalCurrentValue;
    const adjustedNetWorth = netWorth.netWorth.plus(investmentValue);
    const adjustedAssets = netWorth.totalAssets.plus(investmentValue);

    return ok({
      range: { kind: range.kind, from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      summary: {
        totalAssets: adjustedAssets.toFixed(2),
        totalLiabilities: netWorth.totalLiabilities.toFixed(2),
        netWorth: adjustedNetWorth.toFixed(2),
        investmentValue: investmentValue.toFixed(2),
        income: totals.income.toFixed(2),
        expense: totals.expense.toFixed(2),
        net: totals.net.toFixed(2),
        savingsRate: totals.savingsRate,
        previousIncome: previousTotals.income.toFixed(2),
        previousExpense: previousTotals.expense.toFixed(2),
        previousNet: previousTotals.net.toFixed(2),
      },
      series,
      categoryBreakdown: categories,
      accountDistribution: accountDist,
      budgets: budgets.map((p) => ({
        id: p.budget.id,
        name: p.budget.name,
        category: { id: p.budget.category.id, name: p.budget.category.name, color: p.budget.category.color },
        allocated: p.allocated.toFixed(2),
        spent: p.spent.toFixed(2),
        remaining: p.remaining.toFixed(2),
        usage: p.usage,
        status: p.status,
        period: p.budget.period,
      })),
      creditObligations,
      recentTransactions: serialize(recentTxns),
      upcomingRecurring: upcoming.map((u) => ({
        ruleId: u.rule.id,
        name: u.rule.name,
        type: u.rule.type,
        amount: u.rule.amount.toString(),
        date: u.date.toISOString(),
      })),
      portfolio: {
        totalInvested: portfolio.totalInvested,
        totalCurrentValue: portfolio.totalCurrentValue,
        totalPnl: portfolio.totalPnl,
        totalPnlPercent: portfolio.totalPnlPercent,
        holdingsCount: portfolio.holdings.length,
        byType: portfolio.holdings.reduce<Record<string, number>>((acc, h) => {
          acc[h.type] = (acc[h.type] ?? 0) + h.currentValue;
          return acc;
        }, {}),
      },
      maturedHoldings: maturedHoldings.map((h) => {
        const principal = h.principalAmount
          ? Number(h.principalAmount)
          : Number(h.units) * Number(h.avgBuyPrice);
        return {
          id: h.id,
          name: h.name,
          assetClass: h.assetClass,
          type: h.type,
          accountName: h.account.name,
          maturityDate: h.maturityDate?.toISOString() ?? null,
          principal,
          interestFreq: h.interestFreq,
        };
      }),
      savingsInterestReviews: savingsInterestReviews.map((r) => ({
        accountId: r.accountId,
        accountName: r.accountName,
        frequency: r.frequency,
        rate: r.rate,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
        dueDate: r.dueDate.toISOString(),
        amount: r.amount.toFixed(2),
      })),
      bondInterestReviews: bondInterestReviews.map((r) => ({
        holdingId: r.holdingId,
        name: r.name,
        accountId: r.accountId,
        accountName: r.accountName,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
        dueDate: r.dueDate.toISOString(),
        principal: r.principal.toFixed(2),
        rate: r.rate.toString(),
        tdsRate: r.tdsRate.toString(),
        grossInterest: r.grossInterest.toFixed(2),
        tdsAmount: r.tdsAmount.toFixed(2),
        netAmount: r.netAmount.toFixed(2),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
