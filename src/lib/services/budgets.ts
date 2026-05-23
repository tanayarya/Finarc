import { prisma } from "@/lib/prisma";
import type { z } from "zod";
import { budgetCreateSchema, budgetUpdateSchema } from "@/lib/validators";

export async function createBudget(raw: z.infer<typeof budgetCreateSchema>) {
  const input = budgetCreateSchema.parse(raw);
  const cat = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!cat) throw new Error("Category not found");
  if (cat.kind !== "EXPENSE") throw new Error("Budgets can only target expense categories");
  return prisma.budget.create({
    data: {
      name: input.name,
      categoryId: input.categoryId,
      amount: input.amount,
      period: input.period,
      startDate: input.startDate,
    },
  });
}

export async function updateBudget(id: string, raw: z.infer<typeof budgetUpdateSchema>) {
  const input = budgetUpdateSchema.parse(raw);
  return prisma.budget.update({
    where: { id },
    data: {
      name: input.name,
      amount: input.amount,
      period: input.period,
      archived: input.archived,
    },
  });
}

export async function deleteBudget(id: string) {
  return prisma.budget.delete({ where: { id } });
}
