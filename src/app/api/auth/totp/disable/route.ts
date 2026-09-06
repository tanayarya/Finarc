import { ok, handleError } from "@/lib/api";
import { deleteSetting } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await Promise.all([
      deleteSetting("authTotpSecret"),
      deleteSetting("authTotpPendingSecret"),
    ]);
    return ok({ enabled: false });
  } catch (e) {
    return handleError(e);
  }
}
