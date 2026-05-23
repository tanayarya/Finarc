import { ok, handleError } from "@/lib/api";
import { materializeDueRecurring } from "@/lib/services/recurring";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const count = await materializeDueRecurring();
    return ok({ materialized: count });
  } catch (e) {
    return handleError(e);
  }
}
