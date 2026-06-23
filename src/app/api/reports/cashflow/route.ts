import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { rangeForKind, type DateRangeKind } from "@/lib/finance/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = (sp.get("kind") ?? "MONTH") as DateRangeKind;
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const range = rangeForKind(kind, {
      from: fromStr ? new Date(fromStr) : undefined,
      to: toStr ? new Date(toStr) : undefined,
    });

    const txns = await prisma.transaction.findMany({
      where: { occurredAt: { gte: range.from, lte: range.to } },
      select: {
        type: true,
        amount: true,
        category: { select: { name: true, kind: true } },
        account: { select: { name: true, type: true } },
        toAccount: { select: { name: true, type: true } },
        trade: {
          select: {
            action: true,
            holding: { select: { name: true, type: true, assetClass: true } },
          },
        },
      },
    });

    const incomeBySource = new Map<string, number>();
    const expenseByCategory = new Map<string, number>();
    const debtByAccount = new Map<string, number>();
    const investmentByType = new Map<string, number>();

    for (const t of txns) {
      const amount = Number(t.amount);
      if (amount <= 0) continue;

      if (t.type === "INCOME" && t.account?.type !== "CREDIT" && !t.trade) {
        const name = t.category?.name ?? "Other income";
        incomeBySource.set(name, (incomeBySource.get(name) ?? 0) + amount);
      }

      if (t.type === "EXPENSE" && !t.trade) {
        const name = t.category?.name ?? "Uncategorized";
        expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + amount);
      }

      if (t.type === "CREDIT_PAYMENT" || t.type === "LOAN_PAYMENT") {
        const name = t.toAccount?.name ?? (t.type === "CREDIT_PAYMENT" ? "Credit cards" : "Loans");
        debtByAccount.set(name, (debtByAccount.get(name) ?? 0) + amount);
      }

      if (t.trade && ["BUY", "SIP_BUY"].includes(t.trade.action)) {
        const name = investmentLabel(t.trade.holding.type, t.trade.holding.assetClass);
        investmentByType.set(name, (investmentByType.get(name) ?? 0) + amount);
      }
    }

    const incomeTotal = sumMap(incomeBySource);
    const expenseTotal = sumMap(expenseByCategory);
    const debtTotal = sumMap(debtByAccount);
    const investmentTotal = sumMap(investmentByType);
    const retained = Math.max(0, incomeTotal - expenseTotal - debtTotal - investmentTotal);

    const nodes: Array<{ name: string; type: "income" | "hub" | "expense" | "debt" | "investment" | "savings"; color: string }> = [];
    const links: Array<{ source: number; target: number; value: number; color: string }> = [];
    const nodeIndex = new Map<string, number>();
    const addNode = (name: string, type: (typeof nodes)[number]["type"], color: string) => {
      const key = `${type}:${name}`;
      const existing = nodeIndex.get(key);
      if (existing !== undefined) return existing;
      const index = nodes.length;
      nodes.push({ name, type, color });
      nodeIndex.set(key, index);
      return index;
    };
    const addLink = (source: number, target: number, value: number, color: string) => {
      if (value > 0) links.push({ source, target, value: round(value), color });
    };

    const incomeHub = addNode("Income", "income", "hsl(173 58% 44%)");
    const availableHub = addNode("Available cash", "hub", "hsl(204 80% 55%)");
    const debtHub = addNode("Debt payments", "debt", "hsl(38 92% 50%)");
    const investmentsHub = addNode("Investments", "investment", "hsl(207 90% 54%)");
    const savingsHub = addNode("Retained savings", "savings", "hsl(160 60% 45%)");
    const expensesHub = addNode("Expenses", "expense", "hsl(0 84% 62%)");

    for (const [name, value] of sortedEntries(incomeBySource)) {
      const source = addNode(name, "income", "hsl(173 58% 44%)");
      addLink(source, incomeHub, value, "hsla(173, 58%, 44%, 0.28)");
    }

    addLink(incomeHub, availableHub, incomeTotal, "hsla(190, 75%, 62%, 0.3)");
    addLink(availableHub, debtHub, debtTotal, "hsla(38, 92%, 50%, 0.24)");
    addLink(availableHub, investmentsHub, investmentTotal, "hsla(207, 90%, 54%, 0.24)");
    addLink(availableHub, savingsHub, retained, "hsla(160, 60%, 45%, 0.24)");
    addLink(availableHub, expensesHub, expenseTotal, "hsla(0, 84%, 62%, 0.22)");

    for (const [name, value] of sortedEntries(debtByAccount)) {
      const target = addNode(name, "debt", "hsl(38 92% 50%)");
      addLink(debtHub, target, value, "hsla(38, 92%, 50%, 0.28)");
    }

    for (const [name, value] of sortedEntries(investmentByType)) {
      const target = addNode(name, "investment", "hsl(207 90% 54%)");
      addLink(investmentsHub, target, value, "hsla(207, 90%, 54%, 0.28)");
    }

    for (const [name, value] of sortedEntries(expenseByCategory)) {
      const target = addNode(name, "expense", "hsl(0 84% 62%)");
      addLink(expensesHub, target, value, "hsla(0, 84%, 62%, 0.25)");
    }

    return ok({
      range: { kind: range.kind, from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      summary: {
        income: round(incomeTotal),
        expenses: round(expenseTotal),
        debt: round(debtTotal),
        investments: round(investmentTotal),
        retained: round(retained),
      },
      nodes,
      links,
    });
  } catch (e) {
    return handleError(e);
  }
}

function sortedEntries(map: Map<string, number>) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function sumMap(map: Map<string, number>) {
  return Array.from(map.values()).reduce((sum, value) => sum + value, 0);
}

function round(n: number, dp = 2) {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

function investmentLabel(type: string, assetClass: string) {
  if (type === "MUTUAL_FUND") return "Mutual funds";
  if (type === "STOCK") return "Stocks";
  if (type === "BOND") return "Bonds";
  if (type === "FIXED_DEPOSIT") return "Fixed deposits";
  if (type === "PROVIDENT_FUND") return "Provident fund";
  if (assetClass === "GOLD") return "Gold";
  if (assetClass === "SILVER") return "Silver";
  return "Other investments";
}
