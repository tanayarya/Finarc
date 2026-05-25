import { addMonths, differenceInCalendarDays, startOfDay } from "date-fns";

export function nextCreditDueDate(dueDay: number, anchor = new Date()) {
  const today = startOfDay(anchor);
  const day = clampBillingDay(dueDay);
  let dueDate = withBillingDay(today, day);
  if (dueDate < today) dueDate = withBillingDay(addMonths(today, 1), day);
  return dueDate;
}

export function daysUntilCreditDue(dueDay: number, anchor = new Date()) {
  return differenceInCalendarDays(nextCreditDueDate(dueDay, anchor), startOfDay(anchor));
}

export function dueMonthRelation(statementDay: number | null | undefined, dueDay: number | null | undefined) {
  if (!statementDay || !dueDay) return null;
  return dueDay <= statementDay ? "next_month" : "same_month";
}

function withBillingDay(date: Date, day: number) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), Math.min(day, lastDay)));
}

function clampBillingDay(day: number) {
  return Math.min(Math.max(day, 1), 28);
}
