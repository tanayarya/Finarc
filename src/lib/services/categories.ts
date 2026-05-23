import { prisma } from "@/lib/prisma";
import type { z } from "zod";
import { categoryCreateSchema, categoryUpdateSchema } from "@/lib/validators";

export async function listCategories(kind?: "INCOME" | "EXPENSE") {
  return prisma.category.findMany({
    where: { archived: false, ...(kind ? { kind } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(raw: z.infer<typeof categoryCreateSchema>) {
  const input = categoryCreateSchema.parse(raw);
  return prisma.category.create({
    data: {
      name: input.name,
      kind: input.kind,
      color: input.color ?? null,
      icon: input.icon ?? null,
    },
  });
}

export async function updateCategory(id: string, raw: z.infer<typeof categoryUpdateSchema>) {
  const input = categoryUpdateSchema.parse(raw);
  return prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      color: input.color ?? undefined,
      icon: input.icon ?? undefined,
      archived: input.archived ?? undefined,
    },
  });
}
