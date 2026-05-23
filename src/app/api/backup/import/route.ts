import { NextRequest } from "next/server";
import { ok, handleError, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BACKUP_FORMAT = "finarc.backup";
const SUPPORTED_VERSIONS = [1, 2];

interface BackupPayload {
  format: string;
  version: number;
  exportedAt: string;
  data: {
    accounts: Array<Record<string, unknown>>;
    categories: Array<Record<string, unknown>>;
    transactions: Array<Record<string, unknown>>;
    recurringRules: Array<Record<string, unknown>>;
    budgets: Array<Record<string, unknown>>;
    holdings?: Array<Record<string, unknown>>;
    trades?: Array<Record<string, unknown>>;
    dues?: Array<Record<string, unknown>>;
    settings?: Array<Record<string, unknown>>;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<BackupPayload>;
    if (body?.format !== BACKUP_FORMAT)
      return fail("Not a Finarc backup file", 400);
    if (!body.version || !SUPPORTED_VERSIONS.includes(body.version))
      return fail("Unsupported backup version", 400);
    if (!body.data) return fail("Backup payload missing data", 400);

    await prisma.$transaction(async (tx) => {
      // Wipe in dependency order (most dependent first)
      await tx.trade.deleteMany();
      await tx.holding.deleteMany();
      await tx.due.deleteMany();
      await tx.transaction.deleteMany();
      await tx.recurringRule.deleteMany();
      await tx.budget.deleteMany();
      await tx.category.deleteMany();
      await tx.account.deleteMany();
      await tx.appSetting.deleteMany();

      // Restore in dependency order (least dependent first)
      for (const s of body.data!.settings ?? []) {
        await tx.appSetting.create({ data: s as never });
      }
      for (const a of body.data!.accounts) {
        await tx.account.create({ data: a as never });
      }
      for (const c of body.data!.categories) {
        await tx.category.create({ data: c as never });
      }
      for (const r of body.data!.recurringRules) {
        await tx.recurringRule.create({ data: r as never });
      }
      for (const b of body.data!.budgets) {
        await tx.budget.create({ data: b as never });
      }
      for (const t of body.data!.transactions) {
        await tx.transaction.create({ data: t as never });
      }
      for (const h of body.data!.holdings ?? []) {
        await tx.holding.create({ data: h as never });
      }
      for (const t of body.data!.trades ?? []) {
        await tx.trade.create({ data: t as never });
      }
      for (const d of body.data!.dues ?? []) {
        await tx.due.create({ data: d as never });
      }
    }, { timeout: 120000 }); // 2 minute timeout for large imports

    const counts = {
      accounts: body.data!.accounts.length,
      categories: body.data!.categories.length,
      transactions: body.data!.transactions.length,
      recurringRules: body.data!.recurringRules.length,
      budgets: body.data!.budgets.length,
      holdings: body.data!.holdings?.length ?? 0,
      trades: body.data!.trades?.length ?? 0,
      settings: body.data!.settings?.length ?? 0,
    };

    return ok({ imported: true, counts });
  } catch (e) {
    return handleError(e);
  }
}
