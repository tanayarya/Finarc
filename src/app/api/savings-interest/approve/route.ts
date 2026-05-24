import { NextRequest } from "next/server";
import { z } from "zod";

import { ok, handleError } from "@/lib/api";
import { approveSavingsInterest } from "@/lib/services/savings-interest";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const approveSchema = z.object({
  accountId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v.toString()))
    .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount"),
});

export async function POST(req: NextRequest) {
  try {
    const body = approveSchema.parse(await req.json());
    const transaction = await approveSavingsInterest(body);
    return ok(serialize(transaction), 201);
  } catch (e) {
    return handleError(e);
  }
}
