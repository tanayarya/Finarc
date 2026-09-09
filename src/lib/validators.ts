import { z } from "zod";

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => v.toString())
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter a valid amount with up to 2 decimal places",
  })
  .refine((v) => Number(v) > 0 || v === "0", { message: "Amount must be positive" });

const signedDecimalString = z
  .union([z.string(), z.number()])
  .transform((v) => v.toString())
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter a valid amount with up to 2 decimal places",
  });

const positiveDecimal = z
  .union([z.string(), z.number()])
  .transform((v) => v.toString())
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter a valid positive amount",
  })
  .refine((v) => Number(v) > 0, { message: "Amount must be greater than zero" });

const optionalRate = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v.toString()))
  .refine((v) => v === undefined || v === null || /^\d+(\.\d{1,4})?$/.test(v), {
    message: "Enter a valid rate",
  })
  .refine((v) => v === undefined || v === null || (Number(v) >= 0 && Number(v) <= 100), {
    message: "Rate must be between 0 and 100",
  });

const savingsInterestFrequencySchema = z.enum(["MONTHLY", "QUARTERLY"]);

export const accountTypeSchema = z.enum([
  "SAVINGS",
  "CASH",
  "CREDIT",
  "LOAN",
  "INVESTMENT",
]);

export const accountCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name required").max(80),
    type: accountTypeSchema,
    currency: z.string().trim().min(3).max(3).default("USD"),
    openingBalance: signedDecimalString.default("0"),
    creditLimit: positiveDecimal.optional(),
    statementDay: z.number().int().min(1).max(28).optional(),
    dueDay: z.number().int().min(1).max(28).optional(),
    loanPrincipal: positiveDecimal.optional(),
    loanStartDate: z.coerce.date().optional(),
    loanEndDate: z.coerce.date().optional(),
    institution: z.string().trim().max(80).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
    savingsInterestRate: optionalRate,
    savingsInterestFrequency: savingsInterestFrequencySchema.optional().nullable(),
    color: z.string().trim().max(20).optional().nullable(),
    icon: z.string().trim().max(40).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "CREDIT" && !data.creditLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["creditLimit"],
        message: "Credit limit required for credit accounts",
      });
    }
    if (data.type !== "CREDIT" && Number(data.openingBalance) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openingBalance"],
        message: "Opening balance can be negative only for credit cards",
      });
    }
    if (data.type === "LOAN" && !data.loanPrincipal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["loanPrincipal"],
        message: "Loan principal required",
      });
    }
    if (data.type !== "SAVINGS") {
      data.savingsInterestRate = undefined;
      data.savingsInterestFrequency = undefined;
    }
  });

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  creditLimit: positiveDecimal.optional(),
  statementDay: z.number().int().min(1).max(28).optional().nullable(),
  dueDay: z.number().int().min(1).max(28).optional().nullable(),
  institution: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  savingsInterestRate: optionalRate,
  savingsInterestFrequency: savingsInterestFrequencySchema.optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  archived: z.boolean().optional(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const transactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "CREDIT_PAYMENT",
  "LOAN_PAYMENT",
]);

export const transactionCreateSchema = z
  .object({
    type: transactionTypeSchema,
    amount: positiveDecimal,
    occurredAt: z.coerce.date(),
    description: z.string().trim().max(200).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
    accountId: z.string().optional().nullable(),
    fromAccountId: z.string().optional().nullable(),
    toAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "INCOME" || data.type === "EXPENSE") {
      if (!data.accountId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountId"],
          message: "Account is required",
        });
    }
    if (data.type === "TRANSFER" || data.type === "CREDIT_PAYMENT" || data.type === "LOAN_PAYMENT") {
      if (!data.fromAccountId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fromAccountId"],
          message: "Source account required",
        });
      if (!data.toAccountId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toAccountId"],
          message: "Destination account required",
        });
      if (data.fromAccountId && data.toAccountId && data.fromAccountId === data.toAccountId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toAccountId"],
          message: "Source and destination must differ",
        });
    }
  });

export const transactionUpdateSchema = z.object({
  amount: positiveDecimal.optional(),
  occurredAt: z.coerce.date().optional(),
  description: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  taxDeductible: z.boolean().optional(),
});

export const budgetCreateSchema = z.object({
  name: z.string().trim().max(80).optional(),
  categoryId: z.string().min(1),
  amount: positiveDecimal,
  period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  startDate: z.coerce.date().default(() => new Date()),
});

export const budgetUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  amount: positiveDecimal.optional(),
  period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  archived: z.boolean().optional(),
});

export const recurringCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "CREDIT_PAYMENT", "LOAN_PAYMENT"]),
    amount: decimalString.optional(),
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.number().int().min(1).max(365).default(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    description: z.string().trim().max(200).optional().nullable(),
    accountId: z.string().optional().nullable(),
    toAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    holdingId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "CREDIT_PAYMENT" && (!data.amount || Number(data.amount) <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Amount must be greater than zero",
      });
    }
    if (data.type === "TRANSFER" || data.type === "CREDIT_PAYMENT" || data.type === "LOAN_PAYMENT") {
      if (!data.accountId || !data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toAccountId"],
          message: "Both source and destination accounts required",
        });
      }
    } else if (!data.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountId"],
        message: "Account required",
      });
    }
  });

export const recurringUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  amount: positiveDecimal.optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  endDate: z.coerce.date().optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "ENDED"]).optional(),
  skipDate: z.coerce.date().optional(),
});

export const vaultDocumentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  type: z.enum([
    "BANK_STATEMENT",
    "FD_RECEIPT",
    "BOND_DOCUMENT",
    "INVESTMENT_STATEMENT",
    "INSURANCE",
    "LOAN_STATEMENT",
    "TAX",
    "CONTRACT_NOTE",
    "INVOICE",
    "OTHER",
  ]).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  accountId: z.string().optional().nullable(),
  holdingId: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  dueId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const links = [data.accountId, data.holdingId, data.transactionId, data.dueId].filter(Boolean);
  if (links.length > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Link a document to one record at a time" });
  }
});

export const dateRangeSchema = z
  .object({
    kind: z.enum(["WEEK", "MONTH", "YEAR", "CUSTOM"]).default("MONTH"),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .default({ kind: "MONTH" });

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type RecurringCreateInput = z.infer<typeof recurringCreateSchema>;
