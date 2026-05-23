import { prisma } from "@/lib/prisma";
import type { z } from "zod";
import { accountCreateSchema, accountUpdateSchema } from "@/lib/validators";
import { computeAccountBalance } from "@/lib/finance/balances";

export async function createAccount(raw: z.infer<typeof accountCreateSchema>) {
  const input = accountCreateSchema.parse(raw);
  return prisma.account.create({
    data: {
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalance: input.openingBalance,
      creditLimit: input.creditLimit ?? null,
      statementDay: input.statementDay ?? null,
      dueDay: input.dueDay ?? null,
      loanPrincipal: input.loanPrincipal ?? null,
      loanStartDate: input.loanStartDate ?? null,
      loanEndDate: input.loanEndDate ?? null,
      institution: input.institution ?? null,
      notes: input.notes ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
    },
  });
}

export async function updateAccount(id: string, raw: z.infer<typeof accountUpdateSchema>) {
  const input = accountUpdateSchema.parse(raw);
  // Manual balance editing is intentionally not supported. openingBalance is locked
  // to preserve the ledger guarantee.
  return prisma.account.update({
    where: { id },
    data: {
      name: input.name,
      creditLimit: input.creditLimit ?? undefined,
      statementDay: input.statementDay ?? undefined,
      dueDay: input.dueDay ?? undefined,
      institution: input.institution ?? undefined,
      notes: input.notes ?? undefined,
      color: input.color ?? undefined,
      icon: input.icon ?? undefined,
      archived: input.archived ?? undefined,
    },
  });
}

export async function listAccountsWithBalance() {
  const accounts = await prisma.account.findMany({
    where: { archived: false },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  const txns = await prisma.transaction.findMany({
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });
  // Use shared helper for consistency
  const { applyTxnToBalance } = await import("@/lib/finance/balances");
  const { toMoney } = await import("@/lib/money");
  return accounts.map((a) => {
    let bal = toMoney(a.openingBalance);
    for (const t of txns) bal = applyTxnToBalance(a, bal, t);
    return { ...a, balance: bal.toFixed(2) };
  });
}

export async function getAccountDetails(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return null;
  const balance = (await computeAccountBalance(id)).toFixed(2);
  const recentTxns = await prisma.transaction.findMany({
    where: {
      OR: [{ accountId: id }, { fromAccountId: id }, { toAccountId: id }],
    },
    orderBy: { occurredAt: "desc" },
    take: 25,
    include: { category: true, account: true, fromAccount: true, toAccount: true },
  });
  return { account, balance, recentTransactions: recentTxns };
}

export async function archiveAccount(id: string) {
  return prisma.account.update({ where: { id }, data: { archived: true } });
}
