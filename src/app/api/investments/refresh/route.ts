import { ok, handleError } from "@/lib/api";
import { refreshPrices } from "@/lib/services/investments";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await refreshPrices();
    return ok(results);
  } catch (e) {
    return handleError(e);
  }
}
