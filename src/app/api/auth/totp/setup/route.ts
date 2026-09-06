import { ok, handleError } from "@/lib/api";
import { generateTotpSecret, getTotpUri, setSetting } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const secret = generateTotpSecret();
    await setSetting("authTotpPendingSecret", secret);
    return ok({ secret, otpauthUrl: getTotpUri(secret) });
  } catch (e) {
    return handleError(e);
  }
}
