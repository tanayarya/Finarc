import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { setAuthPrimaryMethod } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { method } = await req.json();
    if (method !== "pin" && method !== "totp") return fail("Invalid unlock method", 400);
    await setAuthPrimaryMethod(method);
    return ok({ authPrimaryMethod: method });
  } catch (e) {
    return handleError(e);
  }
}
