import { NextRequest } from "next/server";
import { z } from "zod";

import { ok, handleError } from "@/lib/api";
import { approveBondInterest } from "@/lib/services/bond-interest";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const approveSchema = z.object({
  holdingId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  grossInterest: z.union([z.string(), z.number()]).optional(),
  tdsAmount: z.union([z.string(), z.number()]).optional(),
  netAmount: z.union([z.string(), z.number()]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const transaction = await approveBondInterest(approveSchema.parse(await req.json()));
    return ok(serialize(transaction), 201);
  } catch (e) {
    return handleError(e);
  }
}
