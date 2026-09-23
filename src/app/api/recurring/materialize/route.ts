import { ok, handleError } from "@/lib/api";
import { materializeDueRecurringWithResult } from "@/lib/services/recurring";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return ok(await materializeDueRecurringWithResult());
  } catch (e) {
    return handleError(e);
  }
}
