import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { deleteBudget, updateBudget } from "@/lib/services/budgets";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateBudget(ctx.params.id, body);
    return ok(serialize(updated));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await deleteBudget(ctx.params.id);
    return ok({ id: ctx.params.id });
  } catch (e) {
    return handleError(e);
  }
}
