import { prisma } from "@/lib/prisma";
import type { z } from "zod";
import { budgetCreateSchema, budgetUpdateSchema } from "@/lib/validators";

export async function createBudget(raw: z.infer<typeof budgetCreateSchema>) {
  const input = budgetCreateSchema.parse(raw);
  const cat = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!cat) throw new Error("Category not found");
  if (cat.kind !== "EXPENSE") throw new Error("Budgets can only target expense categories");
  const existing = await prisma.budget.findFirst({
    where: {
      categoryId: input.categoryId,
      period: input.period,
      archived: false,
    },
    select: { name: true, period: true, category: { select: { name: true } } },
  });
  if (existing) {
    throw new Error(`${existing.category.name} already has a ${existing.period.toLowerCase()} budget (${existing.name}). Edit that budget or choose another category/period.`);
  }
  return prisma.budget.create({
    data: {
      name: input.name || cat.name,
      categoryId: input.categoryId,
      amount: input.amount,
      period: input.period,
      startDate: input.startDate,
    },
  });
}

export async function updateBudget(id: string, raw: z.infer<typeof budgetUpdateSchema>) {
  const input = budgetUpdateSchema.parse(raw);
  if (input.period) {
    const current = await prisma.budget.findUnique({ where: { id }, include: { category: true } });
    if (!current) throw new Error("Budget not found");
    const existing = await prisma.budget.findFirst({
      where: {
        id: { not: id },
        categoryId: current.categoryId,
        period: input.period,
        archived: false,
      },
      select: { name: true },
    });
    if (existing) {
      throw new Error(`${current.category.name} already has a ${input.period.toLowerCase()} budget (${existing.name}).`);
    }
  }
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
