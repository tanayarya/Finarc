import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { deleteRecurringRule, updateRecurringRule } from "@/lib/services/recurring";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const body = await req.json();
    const rule = await updateRecurringRule(ctx.params.id, body);
    return ok(serialize(rule));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await deleteRecurringRule(ctx.params.id);
    return ok({ id: ctx.params.id });
  } catch (e) {
    return handleError(e);
  }
}
