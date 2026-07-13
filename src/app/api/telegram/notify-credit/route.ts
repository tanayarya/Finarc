import { ok, handleError } from "@/lib/api";
import { notifyCreditDue } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await notifyCreditDue();
    return ok({ sent: result.count ?? 0, message: result.message, skipped: !result.sent });
  } catch (e) {
    return handleError(e);
  }
}
