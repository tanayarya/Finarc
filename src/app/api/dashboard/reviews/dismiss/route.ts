import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/api";
import { dismissDashboardReview } from "@/lib/services/dashboard-review-dismissals";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.marker || typeof body.marker !== "string") throw new Error("Dismiss marker is required");
    await dismissDashboardReview(body.marker);
    return ok({ dismissed: true });
  } catch (e) {
    return handleError(e);
  }
}
