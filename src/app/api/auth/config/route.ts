import { ok, handleError } from "@/lib/api";
import { getAuthConfig } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getAuthConfig());
  } catch (e) {
    return handleError(e);
  }
}
