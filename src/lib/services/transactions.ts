import { prisma } from "@/lib/prisma";
import type { Prisma, Transaction, TransactionType } from "@prisma/client";
import type { z } from "zod";
import { transactionCreateSchema, transactionUpdateSchema } from "@/lib/validators";

/**
 * Create a transaction with strict business-logic validation.
 *
 * Rules enforced here (single source of truth):
 *   • INCOME / EXPENSE require accountId.
 *       - INCOME may target any non-LOAN account.
 *       - EXPENSE may target SAVINGS, CASH, or CREDIT (credit purchase).
 *       - EXPENSE on CREDIT increases liability and consumes budget.
 *   • TRANSFER requires fromAccountId + toAccountId, both non-LOAN, distinct.
 *       - Transfers do NOT consume budget and do NOT count as income/expense.
 *   • CREDIT_PAYMENT requires from = asset (SAVINGS/CASH), to = CREDIT.
 *       - Reduces source balance and reduces credit liability.
 *       - Never consumes a budget category.
 *   • LOAN_PAYMENT requires from = asset, to = LOAN.
 *       - Reduces source balance and reduces loan principal.
 *
 * The accountId/from/to constraints exist to make balance computation
 * unambiguous and to avoid double-counting.
 */
export async function createTransaction(
  rawInput: z.infer<typeof transactionCreateSchema>
): Promise<Transaction> {
  const input = transactionCreateSchema.parse(rawInput);
  await assertTransactionShape(input);
  const data: Prisma.TransactionCreateInput = {
    type: input.type,
    amount: input.amount,
    occurredAt: input.occurredAt,
    description: input.description ?? null,
    notes: input.notes ?? null,
  };
  if (input.accountId) data.account = { connect: { id: input.accountId } };
  if (input.fromAccountId) data.fromAccount = { connect: { id: input.fromAccountId } };
  if (input.toAccountId) data.toAccount = { connect: { id: input.toAccountId } };
  if (input.categoryId && input.type === "EXPENSE")
    data.category = { connect: { id: input.categoryId } };
  if (input.categoryId && input.type === "INCOME")
    data.category = { connect: { id: input.categoryId } };

  return prisma.transaction.create({ data });
}

async function assertTransactionShape(input: z.infer<typeof transactionCreateSchema>) {
  const ids = [input.accountId, input.fromAccountId, input.toAccountId].filter(
    (x): x is string => Boolean(x)
  );
  const accounts = ids.length
    ? await prisma.account.findMany({ where: { id: { in: ids } } })
    : [];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const get = (id?: string | null) => (id ? byId.get(id) : undefined);

  switch (input.type) {
    case "INCOME": {
      const a = get(input.accountId);
      if (!a) throw new Error("Account not found");
      if (a.type === "LOAN") throw new Error("Income cannot land in a loan account");
      break;
    }
    case "EXPENSE": {
      const a = get(input.accountId);
      if (!a) throw new Error("Account not found");
      if (a.type === "LOAN" || a.type === "INVESTMENT")
        throw new Error("Expenses can only be paid from savings, cash, or credit accounts");
      break;
    }
    case "TRANSFER": {
      const from = get(input.fromAccountId);
      const to = get(input.toAccountId);
      if (!from || !to) throw new Error("Both accounts required");
      if (from.type === "LOAN") throw new Error("Cannot transfer out of a loan");
      if (to.type === "LOAN")
        throw new Error("Use loan payment instead of transfer to a loan account");
      if (to.type === "CREDIT")
        throw new Error("Use credit payment instead of transfer to a credit account");
      break;
    }
    case "CREDIT_PAYMENT": {
      const from = get(input.fromAccountId);
      const to = get(input.toAccountId);
      if (!from || !to) throw new Error("Both accounts required");
      if (!(from.type === "SAVINGS" || from.type === "CASH"))
        throw new Error("Pay credit from savings or cash account");
      if (to.type !== "CREDIT") throw new Error("Destination must be a credit account");
      break;
    }
    case "LOAN_PAYMENT": {
      const from = get(input.fromAccountId);
      const to = get(input.toAccountId);
      if (!from || !to) throw new Error("Both accounts required");
      if (!(from.type === "SAVINGS" || from.type === "CASH"))
        throw new Error("Pay loan from savings or cash account");
      if (to.type !== "LOAN") throw new Error("Destination must be a loan account");
      const { computeAccountBalance } = await import("@/lib/finance/balances");
      const outstanding = await computeAccountBalance(to.id);
      if (outstanding.lessThan(input.amount)) {
        throw new Error("Loan payment cannot exceed outstanding principal");
      }
      break;
    }
  }

  // Categories: only EXPENSE/INCOME may have a category. Budgets only consumed by EXPENSE.
  if (input.categoryId && !["EXPENSE", "INCOME"].includes(input.type)) {
    throw new Error("Only income or expense transactions may carry a category");
  }
}

export async function updateTransaction(
  id: string,
  rawInput: z.infer<typeof transactionUpdateSchema>
) {
  const input = transactionUpdateSchema.parse(rawInput);
  return prisma.transaction.update({
    where: { id },
    data: {
      amount: input.amount,
      occurredAt: input.occurredAt,
      description: input.description ?? undefined,
      notes: input.notes ?? undefined,
      categoryId: input.categoryId ?? undefined,
      taxDeductible: input.taxDeductible,
    },
  });
}

export async function deleteTransaction(id: string) {
  return prisma.transaction.delete({ where: { id } });
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  CREDIT_PAYMENT: "Credit Payment",
  LOAN_PAYMENT: "Loan Payment",
};
