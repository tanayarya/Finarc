import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const type = params.get("type");
    const accountId = params.get("accountId");
    const categoryId = params.get("categoryId");
    const from = params.get("from");
    const to = params.get("to");
    const search = params.get("search");
    const take = Math.min(parseInt(params.get("take") ?? "100", 10), 500);
    const skip = parseInt(params.get("skip") ?? "0", 10);

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (accountId)
      where.OR = [
        { accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId },
      ];
    if (categoryId) where.categoryId = categoryId;
    if (from || to)
      where.occurredAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    if (search) {
      const term = search.trim();
      if (term)
        where.description = { contains: term, mode: "insensitive" as const };
    }

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take,
        skip,
        include: {
          category: true,
          account: true,
          fromAccount: true,
          toAccount: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    // Compute running balance when filtering by a single account
    let runningBalances: Record<string, string> | null = null;
    if (accountId && items.length > 0) {
      const acct = await prisma.account.findUnique({ where: { id: accountId } });
      if (acct) {
        // Get all transactions for this account up to the latest in our page
        const allTxns = await prisma.transaction.findMany({
          where: {
            OR: [{ accountId }, { fromAccountId: accountId }, { toAccountId: accountId }],
            occurredAt: { lte: items[0].occurredAt },
          },
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
          select: { id: true, type: true, amount: true, accountId: true, fromAccountId: true, toAccountId: true },
        });
        const { applyTxnToBalance } = await import("@/lib/finance/balances");
        const { toMoney } = await import("@/lib/money");
        let bal = toMoney(acct.openingBalance);
        const balMap: Record<string, string> = {};
        for (const t of allTxns) {
          bal = applyTxnToBalance(acct, bal, t);
          balMap[t.id] = bal.toFixed(2);
        }
        runningBalances = balMap;
      }
    }

    return ok({ items: serialize(items), total, take, skip, runningBalances });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const txn = await createTransaction(body);
    return ok(serialize(txn), 201);
  } catch (e) {
    return handleError(e);
  }
}
