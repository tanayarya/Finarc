import { ok, handleError } from "@/lib/api";
import { runAllNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: checks all notification types and sends Telegram messages.
 * Each type is deduped to max once per day.
 * Call this via cron at 12:00 PM and 9:00 PM.
 */
export async function GET() {
  try {
    const results = await runAllNotifications();
    return ok(results);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST() {
  try {
    const results = await runAllNotifications();
    return ok(results);
  } catch (e) {
    return handleError(e);
  }
}
