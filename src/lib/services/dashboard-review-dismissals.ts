import { startOfMonth } from "date-fns";

import { prisma } from "@/lib/prisma";

const DISMISSED_REVIEW_KEY = "dashboardReviewDismissedMarkers";

export type DashboardReviewKind = "savingsInterest" | "bondInterest" | "maturity";

export function dashboardReviewDismissMarker(
  kind: DashboardReviewKind,
  entityId: string,
  date = new Date()
) {
  return [
    kind,
    entityId,
    startOfMonth(date).toISOString().slice(0, 10),
  ].join(":");
}

export async function getDismissedDashboardReviewMarkers() {
  const setting = await prisma.appSetting.findUnique({ where: { key: DISMISSED_REVIEW_KEY } });
  if (!setting?.value) return new Set<string>();
  try {
    const parsed = JSON.parse(setting.value);
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export async function dismissDashboardReview(marker: string) {
  const current = await getDismissedDashboardReviewMarkers();
  current.add(marker);
  const next = Array.from(current).slice(-500);
  await prisma.appSetting.upsert({
    where: { key: DISMISSED_REVIEW_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: DISMISSED_REVIEW_KEY, value: JSON.stringify(next) },
  });
}
