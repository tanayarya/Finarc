import { NextRequest } from "next/server";
import { ok, handleError, fail } from "@/lib/api";
import { archiveAccount, getAccountDetails, updateAccount } from "@/lib/services/accounts";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const details = await getAccountDetails(ctx.params.id);
    if (!details) return fail("Account not found", 404);
    return ok(serialize(details));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const body = await req.json();
    const account = await updateAccount(ctx.params.id, body);
    return ok(serialize(account));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const account = await archiveAccount(ctx.params.id);
    return ok(serialize(account));
  } catch (e) {
    return handleError(e);
  }
}
