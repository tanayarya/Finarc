import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  personName: z.string().trim().min(1).max(100),
  amount: z.string().or(z.number()).transform((v) => String(v)),
  description: z.string().trim().max(200).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  accountId: z.string().min(1),
  notes: z.string().trim().max(500).optional().nullable(),
  createTransaction: z.boolean().default(true),
});

export async function GET() {
  try {
    const dues = await prisma.due.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: { account: true },
    });
    return ok(serialize(dues));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = createSchema.parse(body);

    // Create the due entry
    const due = await prisma.due.create({
      data: {
        type: input.type,
        personName: input.personName,
        amount: input.amount,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        accountId: input.accountId,
        notes: input.notes ?? null,
      },
    });

    // Optionally create the corresponding transaction
    if (input.createTransaction) {
      if (input.type === "RECEIVABLE") {
        // Money left your account (you gave it to someone)
        await prisma.transaction.create({
          data: {
            type: "EXPENSE",
            amount: input.amount,
            occurredAt: new Date(),
            description: `Lent to ${input.personName}${input.description ? ` — ${input.description}` : ""}`,
            accountId: input.accountId,
          },
        });
      } else {
        // Money came into your account (someone gave it to you)
        await prisma.transaction.create({
          data: {
            type: "INCOME",
            amount: input.amount,
            occurredAt: new Date(),
            description: `Borrowed from ${input.personName}${input.description ? ` — ${input.description}` : ""}`,
            accountId: input.accountId,
          },
        });
      }
    }

    return ok(serialize(due), 201);
  } catch (e) {
    return handleError(e);
  }
}
