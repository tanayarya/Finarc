import { prisma } from "@/lib/prisma";
import { isAfter, isBefore, isSameDay } from "date-fns";
import { nextOccurrence } from "./dates";
import type { RecurringRule } from "@prisma/client";

/**
 * Compute upcoming occurrences for a single recurring rule between two dates.
 * Skipped dates are honored, paused rules are excluded.
 */
export function occurrencesBetween(
  rule: RecurringRule,
  from: Date,
  to: Date
): Date[] {
  if (rule.status !== "ACTIVE") return [];
  const out: Date[] = [];
  let cursor = new Date(rule.nextRunDate);
  const end = rule.endDate ? new Date(rule.endDate) : null;
  // Safety bound to avoid infinite loops in edge cases
  let guard = 0;
  while (cursor && !isAfter(cursor, to) && guard < 365) {
    if (end && isAfter(cursor, end)) break;
    if (!isBefore(cursor, from)) {
      const skipped = rule.skippedDates.some((s) => isSameDay(s, cursor));
      if (!skipped) out.push(new Date(cursor));
    }
    cursor = nextOccurrence(cursor, rule.frequency, rule.interval);
    guard += 1;
  }
  return out;
}

/**
 * List upcoming recurring transactions in a date window.
 */
export async function upcomingRecurring(
  from: Date = new Date(),
  to: Date
): Promise<Array<{ rule: RecurringRule; date: Date }>> {
  const rules = await prisma.recurringRule.findMany({
    where: { status: "ACTIVE" },
    include: { account: true, toAccount: true, category: true },
  });
  const items: Array<{ rule: RecurringRule; date: Date }> = [];
  for (const rule of rules) {
    const dates = occurrencesBetween(rule, from, to);
    for (const date of dates) items.push({ rule, date });
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
