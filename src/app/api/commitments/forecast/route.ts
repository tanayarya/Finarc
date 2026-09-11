import { handleError, ok } from "@/lib/api";
import { getCommitmentForecast } from "@/lib/services/commitment-forecast";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getCommitmentForecast());
  } catch (error) {
    return handleError(error);
  }
}
