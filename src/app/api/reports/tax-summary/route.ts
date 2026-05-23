import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rangeForKind, type DateRangeKind } from "@/lib/finance/dates";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = (sp.get("kind") ?? "YEAR") as DateRangeKind;
    const range = rangeForKind(kind);

    const taxTxns = await prisma.transaction.findMany({
      where: {
        taxDeductible: true,
        occurredAt: { gte: range.from, lte: range.to },
      },
      include: { category: true, account: true },
      orderBy: { occurredAt: "desc" },
    });

    const totalDeductible = taxTxns.reduce((s, t) => s + Number(t.amount), 0);

    const byCategory = taxTxns.reduce<Record<string, { name: string; total: number; count: number }>>((acc, t) => {
      const key = t.category?.name ?? "Uncategorized";
      if (!acc[key]) acc[key] = { name: key, total: 0, count: 0 };
      acc[key].total += Number(t.amount);
      acc[key].count += 1;
      return acc;
    }, {});

    return ok({
      range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      totalDeductible: Math.round(totalDeductible * 100) / 100,
      transactionCount: taxTxns.length,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      transactions: serialize(taxTxns.slice(0, 50)),
    });
  } catch (e) {
    return handleError(e);
  }
}
