import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { deleteSetting, getSetting, setSetting, verifyTotp } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const secret = await getSetting("authTotpPendingSecret");
    if (!secret) return fail("Start authenticator setup first", 400);
    if (!verifyTotp(code, secret)) return fail("Incorrect authenticator code", 401);

    await setSetting("authTotpSecret", secret);
    await deleteSetting("authTotpPendingSecret");
    return ok({ enabled: true });
  } catch (e) {
    return handleError(e);
  }
}
