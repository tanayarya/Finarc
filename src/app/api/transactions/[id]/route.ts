import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { deleteTransaction, updateTransaction } from "@/lib/services/transactions";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const body = await req.json();
    const txn = await updateTransaction(ctx.params.id, body);
    return ok(serialize(txn));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await deleteTransaction(ctx.params.id);
    return ok({ id: ctx.params.id });
  } catch (e) {
    return handleError(e);
  }
}
