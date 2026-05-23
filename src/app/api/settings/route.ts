import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getAppSettings, updateAppSettings } from "@/lib/services/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  currency: z.string().trim().min(3).max(3).optional(),
  defaultAccountId: z.string().optional(),
  defaultInvestmentAccountId: z.string().optional(),
  financialYearStart: z.number().int().min(1).max(12).optional(),
});

export async function GET() {
  try {
    return ok(await getAppSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = updateSchema.parse(await req.json());
    return ok(await updateAppSettings(body));
  } catch (e) {
    return handleError(e);
  }
}
