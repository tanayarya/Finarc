import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { updateCategory } from "@/lib/services/categories";
import { serialize } from "@/lib/serialize";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const body = await req.json();
    const cat = await updateCategory(ctx.params.id, body);
    return ok(serialize(cat));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    // Archive instead of hard delete to preserve transaction references
    await prisma.category.update({
      where: { id: ctx.params.id },
      data: { archived: true },
    });
    return ok({ id: ctx.params.id });
  } catch (e) {
    return handleError(e);
  }
}
