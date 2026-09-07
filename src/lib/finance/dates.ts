import {
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isAfter,
} from "date-fns";

export type DateRangeKind = "WEEK" | "MONTH" | "YEAR" | "CUSTOM";
const FINANCE_TIME_ZONE = "Asia/Kolkata";
const FINANCE_TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const financeDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: FINANCE_TIME_ZONE,
});
const financeMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: FINANCE_TIME_ZONE,
});

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
  const parts = financeParts(now);
  switch (kind) {
    case "WEEK":
      return {
        from: financeDate(parts.year, parts.month, parts.day - 6),
        to: financeDate(parts.year, parts.month, parts.day, true),
        kind,
        label: "Last 7 days",
      };
    case "MONTH":
      return {
        from: financeDate(parts.year, parts.month, 1),
        to: financeDate(parts.year, parts.month + 1, 0, true),
        kind,
        label: "This month",
      };
    case "YEAR":
      return {
        from: financeDate(parts.year, 0, 1),
        to: financeDate(parts.year, 11, 31, true),
        kind,
        label: "This year",
      };
    case "CUSTOM":
      return {
        from: custom?.from ? startOfFinanceDay(custom.from) : startOfFinanceDay(subDays(now, 30)),
        to: custom?.to ? endOfFinanceDay(custom.to) : endOfFinanceDay(now),
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
      const parts = financeParts(range.from);
      const from = financeDate(parts.year, parts.month - 1, 1);
      return {
        from,
        to: financeDate(parts.year, parts.month, 0, true),
        kind: range.kind,
        label: "Previous month",
      };
    }
    case "YEAR": {
      const parts = financeParts(range.from);
      const from = financeDate(parts.year - 1, 0, 1);
      return {
        from,
        to: financeDate(parts.year - 1, 11, 31, true),
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

export function startOfFinanceDay(date: Date) {
  const parts = financeParts(date);
  return financeDate(parts.year, parts.month, parts.day);
}

export function endOfFinanceDay(date: Date) {
  const parts = financeParts(date);
  return financeDate(parts.year, parts.month, parts.day, true);
}

export function financeDayKey(date: Date) {
  const { year, month, day } = financeParts(date);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function financeMonthKey(date: Date) {
  const { year, month } = financeParts(date);
  return `${year}-${pad(month + 1)}`;
}

export function financeDayLabel(date: Date) {
  return financeDayFormatter.format(date);
}

export function financeMonthLabel(date: Date) {
  return financeMonthFormatter.format(date);
}

export function eachFinanceDay(from: Date, to: Date) {
  const start = financeParts(from);
  const end = financeParts(to);
  let cursor = Date.UTC(start.year, start.month, start.day);
  const last = Date.UTC(end.year, end.month, end.day);
  const days: Date[] = [];

  while (cursor <= last) {
    const date = new Date(cursor);
    days.push(financeDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    cursor += DAY_MS;
  }

  return days;
}

export function eachFinanceMonth(from: Date, to: Date) {
  const start = financeParts(from);
  const end = financeParts(to);
  const months: Date[] = [];
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push(financeDate(year, month, 1));
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return months;
}

function financeParts(date: Date) {
  const shifted = new Date(date.getTime() + FINANCE_TZ_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function financeDate(year: number, month: number, day: number, end = false) {
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      end ? 23 : 0,
      end ? 59 : 0,
      end ? 59 : 0,
      end ? 999 : 0
    ) - FINANCE_TZ_OFFSET_MS
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export { startOfDay, endOfDay };
