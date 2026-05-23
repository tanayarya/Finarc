import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { add, sub, toMoney, ZERO, type Money } from "@/lib/money";
import type { Account, AccountType, Transaction } from "@prisma/client";

/**
 * Ledger-style balance computation.
 *
 * Asset accounts (SAVINGS, CASH, INVESTMENT):
 *   balance = openingBalance + INCOME + transferIn - EXPENSE - transferOut
 *           - CREDIT_PAYMENT (out)  - LOAN_PAYMENT (out)
 *
 * Liability accounts (CREDIT, LOAN):
 *   liability = openingBalance + EXPENSE (charged on this account)
 *             - CREDIT_PAYMENT incoming - LOAN_PAYMENT incoming
 *   For CREDIT, expenses are recorded with accountId = credit account.
 *   For LOAN, the openingBalance represents principal owed.
 */

export const ASSET_TYPES: AccountType[] = ["SAVINGS", "CASH", "INVESTMENT"];
export const LIABILITY_TYPES: AccountType[] = ["CREDIT", "LOAN"];

export function isAsset(type: AccountType) {
  return ASSET_TYPES.includes(type);
}

export function isLiability(type: AccountType) {
  return LIABILITY_TYPES.includes(type);
}

type TxnLite = Pick<
  Transaction,
  "type" | "amount" | "accountId" | "fromAccountId" | "toAccountId"
>;

export function applyTxnToBalance(
  account: Pick<Account, "id" | "type">,
  current: Money,
  txn: TxnLite
): Money {
  const amount = toMoney(txn.amount);

  if (isAsset(account.type)) {
    if (txn.type === "INCOME" && txn.accountId === account.id) {
      return current.plus(amount);
    }
    if (txn.type === "EXPENSE" && txn.accountId === account.id) {
      return current.minus(amount);
    }
    if (txn.type === "TRANSFER") {
      if (txn.fromAccountId === account.id) return current.minus(amount);
      if (txn.toAccountId === account.id) return current.plus(amount);
    }
    if (txn.type === "CREDIT_PAYMENT" || txn.type === "LOAN_PAYMENT") {
      // Money leaves the source asset account
      if (txn.fromAccountId === account.id) return current.minus(amount);
    }
    return current;
  }

  // Liability accounts: balance represents amount owed.
  if (account.type === "CREDIT") {
    // Expense charged to credit increases liability
    if (txn.type === "EXPENSE" && txn.accountId === account.id) {
      return current.plus(amount);
    }
    // Payment toward credit reduces liability
    if (txn.type === "CREDIT_PAYMENT" && txn.toAccountId === account.id) {
      return current.minus(amount);
    }
    // Refunds (income) on a credit account reduce liability
    if (txn.type === "INCOME" && txn.accountId === account.id) {
      return current.minus(amount);
    }
    return current;
  }

  if (account.type === "LOAN") {
    if (txn.type === "LOAN_PAYMENT" && txn.toAccountId === account.id) {
      return current.minus(amount);
    }
    return current;
  }

  return current;
}

export async function computeAccountBalance(
  accountId: string,
  asOf?: Date
): Promise<Decimal> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");

  const txns = await prisma.transaction.findMany({
    where: {
      OR: [
        { accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId },
      ],
      ...(asOf ? { occurredAt: { lte: asOf } } : {}),
    },
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });

  let balance = toMoney(account.openingBalance);
  for (const t of txns) {
    balance = applyTxnToBalance(account, balance, t);
  }
  return balance;
}

export async function computeAllBalances(asOf?: Date) {
  const accounts = await prisma.account.findMany({
    where: { archived: false },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  const txns = await prisma.transaction.findMany({
    where: asOf ? { occurredAt: { lte: asOf } } : undefined,
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });

  return accounts.map((account) => {
    let balance = toMoney(account.openingBalance);
    for (const t of txns) balance = applyTxnToBalance(account, balance, t);
    return { account, balance };
  });
}

export interface NetWorthBreakdown {
  totalAssets: Money;
  totalLiabilities: Money;
  netWorth: Money;
  byAccount: Array<{ accountId: string; name: string; type: AccountType; balance: Money }>;
}

export async function computeNetWorth(asOf?: Date): Promise<NetWorthBreakdown> {
  const balances = await computeAllBalances(asOf);
  let totalAssets = ZERO;
  let totalLiabilities = ZERO;
  const byAccount = balances.map(({ account, balance }) => {
    if (isAsset(account.type)) totalAssets = add(totalAssets, balance);
    else if (balance.isNegative()) totalAssets = add(totalAssets, balance.abs());
    else totalLiabilities = add(totalLiabilities, balance);
    return {
      accountId: account.id,
      name: account.name,
      type: account.type,
      balance,
    };
  });

  return {
    totalAssets,
    totalLiabilities,
    netWorth: sub(totalAssets, totalLiabilities),
    byAccount,
  };
}
