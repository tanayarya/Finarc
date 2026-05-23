import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { createAccount, listAccountsWithBalance } from "@/lib/services/accounts";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await listAccountsWithBalance();
    return ok(serialize(accounts));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const account = await createAccount(body);
    return ok(serialize(account), 201);
  } catch (e) {
    return handleError(e);
  }
}
