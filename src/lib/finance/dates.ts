import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isAfter,
} from "date-fns";

export type DateRangeKind = "WEEK" | "MONTH" | "YEAR" | "CUSTOM";

export interface DateRange {
  from: Date;
  to: Date;
  kind: DateRangeKind;
  label: string;
}

export function rangeForKind(
  kind: DateRangeKind,
  custom?: { from?: Date; to?: Date }
): DateRange {
  const now = new Date();
  switch (kind) {
    case "WEEK":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
        kind,
        label: "This week",
      };
    case "MONTH":
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
        kind,
        label: "This month",
      };
    case "YEAR":
      return {
        from: startOfYear(now),
        to: endOfYear(now),
        kind,
        label: "This year",
      };
    case "CUSTOM":
      return {
        from: custom?.from ? startOfDay(custom.from) : startOfDay(subDays(now, 30)),
        to: custom?.to ? endOfDay(custom.to) : endOfDay(now),
        kind,
        label: "Custom range",
      };
  }
}

export function previousRange(range: DateRange): DateRange {
  switch (range.kind) {
    case "WEEK":
      return {
        from: subDays(range.from, 7),
        to: subDays(range.to, 7),
        kind: range.kind,
        label: "Previous week",
      };
    case "MONTH": {
      const from = startOfMonth(subMonths(range.from, 1));
      return {
        from,
        to: endOfMonth(from),
        kind: range.kind,
        label: "Previous month",
      };
    }
    case "YEAR": {
      const from = startOfYear(subYears(range.from, 1));
      return {
        from,
        to: endOfYear(from),
        kind: range.kind,
        label: "Previous year",
      };
    }
    case "CUSTOM":
    default: {
      const span =
        Math.floor(
          (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      return {
        from: subDays(range.from, span),
        to: subDays(range.to, span),
        kind: "CUSTOM",
        label: "Previous period",
      };
    }
  }
}

export function nextOccurrence(
  current: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  interval = 1
): Date {
  switch (frequency) {
    case "DAILY":
      return addDays(current, interval);
    case "WEEKLY":
      return addWeeks(current, interval);
    case "MONTHLY":
      return addMonths(current, interval);
    case "YEARLY":
      return addYears(current, interval);
  }
}

export function isUpcoming(date: Date, withinDays = 14) {
  const now = new Date();
  return isAfter(date, now) && date.getTime() - now.getTime() <= withinDays * 24 * 3600 * 1000;
}

export { startOfDay, endOfDay };
