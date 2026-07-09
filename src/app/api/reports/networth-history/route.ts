import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toMoney, ZERO } from "@/lib/money";
import { applyTxnToBalance, isAsset, isLiability } from "@/lib/finance/balances";
import { currentHoldingValue } from "@/lib/services/investments";
import { Decimal } from "decimal.js";
import {
  eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval,
  startOfWeek, startOfMonth, startOfYear,
  subWeeks, subMonths, subYears, endOfDay, endOfMonth, format,
} from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind") ?? "YEAR"; // WEEK, MONTH, YEAR
    const filter = sp.get("filter") ?? "ALL"; // ALL, ASSETS, LIABILITIES, INVESTMENTS, STOCKS, MF, BONDS, FD, PF, GOLD

    const now = new Date();
    let from: Date;
    let points: Date[];

    if (kind === "WEEK") {
      from = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      points = eachDayOfInterval({ start: from, end: now });
    } else if (kind === "MONTH") {
      from = startOfMonth(subMonths(now, 1));
      points = eachDayOfInterval({ start: from, end: now });
    } else {
      from = startOfYear(subYears(now, 1));
      points = eachMonthOfInterval({ start: from, end: now });
    }

    const accounts = await prisma.account.findMany({ where: { archived: false } });
    const allTxns = await prisma.transaction.findMany({
      select: { type: true, amount: true, accountId: true, fromAccountId: true, toAccountId: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    });

    // Get investment holdings for investment filters
    const holdings = await prisma.holding.findMany({
      where: { archived: false },
      include: { trades: { orderBy: { occurredAt: "asc" } } },
    });

    const series = points.map((point) => {
      const asOf = kind === "YEAR" ? endOfMonth(point) : endOfDay(point);
      const txnsBefore = allTxns.filter((t) => t.occurredAt <= asOf);

      let assets = ZERO;
      let liabilities = ZERO;

      for (const account of accounts) {
        let bal = toMoney(account.openingBalance);
        for (const t of txnsBefore) {
          bal = applyTxnToBalance(account, bal, t);
        }
        if (isAsset(account.type)) assets = assets.plus(bal);
        else liabilities = liabilities.plus(bal);
      }

      // Investment value (simplified: use current value as proxy for historical)
      let investmentValue = 0;
      if (filter === "ALL" || filter === "INVESTMENTS" || ["STOCKS", "MF", "BONDS", "FD", "PF", "GOLD"].includes(filter)) {
        for (const h of holdings) {
          if (filter === "STOCKS" && h.type !== "STOCK") continue;
          if (filter === "MF" && h.type !== "MUTUAL_FUND") continue;
          if (filter === "BONDS" && h.type !== "BOND") continue;
          if (filter === "FD" && h.type !== "FIXED_DEPOSIT") continue;
          if (filter === "PF" && h.type !== "PROVIDENT_FUND") continue;
          if (filter === "GOLD" && h.assetClass !== "GOLD") continue;
          const units = new Decimal(h.units.toString());
          const price = h.currentPrice ? new Decimal(h.currentPrice.toString()) : new Decimal(h.avgBuyPrice.toString());
          investmentValue += currentHoldingValue(h, units.mul(price), asOf).toNumber();
        }
      }

      const assetsNum = assets.toNumber();
      const liabNum = liabilities.toNumber();

      // Apply filter
      let value: number;
      if (filter === "ASSETS") value = assetsNum;
      else if (filter === "LIABILITIES") value = liabNum;
      else if (filter === "INVESTMENTS" || ["STOCKS", "MF", "BONDS", "FD", "PF", "GOLD"].includes(filter)) value = investmentValue;
      else value = assetsNum + investmentValue - liabNum; // ALL = net worth

      return {
        date: format(point, kind === "YEAR" ? "MMM yy" : "MMM d"),
        dateRaw: point.toISOString(),
        assets: assetsNum,
        liabilities: liabNum,
        investments: investmentValue,
        netWorth: assetsNum + investmentValue - liabNum,
        filtered: Math.round(value * 100) / 100,
      };
    });

    return ok(series);
  } catch (e) {
    return handleError(e);
  }
}
