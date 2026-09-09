import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await prisma.$transaction(async (tx) => {
      // Delete in strict dependency order
      await tx.vaultDocument.deleteMany();
      await tx.trade.deleteMany();
      await tx.holding.deleteMany();
      await tx.due.deleteMany();
      await tx.transaction.deleteMany();
      await tx.recurringRule.deleteMany();
      await tx.budget.deleteMany();
      await tx.category.deleteMany();
      await tx.account.deleteMany();
      // Keep AppSettings (currency, theme, API keys) — only financial data is cleared
    });
    return ok({ cleared: true });
  } catch (e) {
    return handleError(e);
  }
}
