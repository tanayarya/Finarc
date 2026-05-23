import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import { applyTxnToBalance } from "@/lib/finance/balances";
import {
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subWeeks, subMonths, subYears, format, endOfDay,
} from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind") ?? "MONTH"; // WEEK, MONTH, YEAR
    const accountId = sp.get("accountId"); // optional: specific account

    const now = new Date();
    let from: Date;
    let to: Date;
    let points: Date[];

    if (kind === "WEEK") {
      from = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      to = endOfDay(now);
      points = eachDayOfInterval({ start: from, end: to });
    } else if (kind === "YEAR") {
      from = startOfYear(subYears(now, 1));
      to = endOfDay(now);
      points = eachMonthOfInterval({ start: from, end: to });
    } else {
      // MONTH
      from = startOfMonth(subMonths(now, 1));
      to = endOfDay(now);
      points = eachDayOfInterval({ start: from, end: to });
    }

    const accounts = accountId
      ? await prisma.account.findMany({ where: { id: accountId } })
      : await prisma.account.findMany({ where: { archived: false, type: { in: ["SAVINGS", "CASH"] } } });

    const allTxns = await prisma.transaction.findMany({
      where: {
        occurredAt: { lte: to },
        ...(accountId
          ? { OR: [{ accountId }, { fromAccountId: accountId }, { toAccountId: accountId }] }
          : {}),
      },
      select: { type: true, amount: true, accountId: true, fromAccountId: true, toAccountId: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    });

    const series = points.map((point) => {
      const asOf = endOfDay(point);
      const txnsBefore = allTxns.filter((t) => t.occurredAt <= asOf);

      let totalBalance = 0;
      const accountBalances: Record<string, number> = {};

      for (const account of accounts) {
        let bal = toMoney(account.openingBalance);
        for (const t of txnsBefore) {
          bal = applyTxnToBalance(account, bal, t);
        }
        const balNum = bal.toNumber();
        totalBalance += balNum;
        accountBalances[account.name] = balNum;
      }

      return {
        date: format(point, kind === "YEAR" ? "MMM yy" : "MMM d"),
        total: Math.round(totalBalance * 100) / 100,
        ...accountBalances,
      };
    });

    return ok({
      series,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
    });
  } catch (e) {
    return handleError(e);
  }
}
