import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { fail } from "@/lib/api";
import { hasValidCronSecret } from "@/lib/machine-auth";
import { runAllNotifications } from "@/lib/services/notifications";
import { materializeDueRecurring } from "@/lib/services/recurring";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: checks all notification types and sends Telegram messages.
 * Each type is deduped to max once per day.
 * Call this via cron at 12:00 PM and 9:00 PM.
 */
export async function GET(req: NextRequest) {
  try {
    if (!hasValidCronSecret(req)) return fail("Invalid cron secret", 401);
    const materialized = await materializeDueRecurring();
    const notifications = await runAllNotifications();
    return ok({ materialized, notifications });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasValidCronSecret(req)) return fail("Invalid cron secret", 401);
    const materialized = await materializeDueRecurring();
    const notifications = await runAllNotifications();
    return ok({ materialized, notifications });
  } catch (e) {
    return handleError(e);
  }
}
