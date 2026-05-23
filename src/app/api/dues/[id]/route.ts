import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { Decimal } from "decimal.js";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const body = await req.json();
    const due = await prisma.due.findUnique({ where: { id: ctx.params.id } });
    if (!due) return fail("Due not found", 404);

    // Settle (full or partial)
    if (body.action === "settle") {
      const settleAmount = new Decimal(body.amount ?? due.amount.toString());
      const currentSettled = new Decimal(due.amountSettled.toString());
      const totalAmount = new Decimal(due.amount.toString());
      const newSettled = currentSettled.plus(settleAmount);
      const isFullySettled = newSettled.greaterThanOrEqualTo(totalAmount);

      // Create the return transaction
      if (due.type === "RECEIVABLE") {
        // Money coming back to you
        await prisma.transaction.create({
          data: {
            type: "INCOME",
            amount: settleAmount.toFixed(2),
            occurredAt: new Date(),
            description: `Received from ${due.personName}${due.description ? ` — ${due.description}` : ""}`,
            accountId: due.accountId,
          },
        });
      } else {
        // You're paying back
        await prisma.transaction.create({
          data: {
            type: "EXPENSE",
            amount: settleAmount.toFixed(2),
            occurredAt: new Date(),
            description: `Paid back to ${due.personName}${due.description ? ` — ${due.description}` : ""}`,
            accountId: due.accountId,
          },
        });
      }

      const updated = await prisma.due.update({
        where: { id: ctx.params.id },
        data: {
          amountSettled: newSettled.toFixed(2),
          status: isFullySettled ? "SETTLED" : "PARTIAL",
          settledAt: isFullySettled ? new Date() : null,
        },
      });

      return ok(serialize(updated));
    }

    // General update
    const updated = await prisma.due.update({
      where: { id: ctx.params.id },
      data: {
        personName: body.personName,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        notes: body.notes,
      },
    });

    return ok(serialize(updated));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await prisma.due.delete({ where: { id: ctx.params.id } });
    return ok({ id: ctx.params.id });
  } catch (e) {
    return handleError(e);
  }
}
