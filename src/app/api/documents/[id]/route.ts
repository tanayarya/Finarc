import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { vaultDocumentUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const documentInclude = {
  account: { select: { id: true, name: true, type: true } },
  holding: { select: { id: true, name: true, type: true, assetClass: true } },
  transaction: { select: { id: true, description: true, amount: true, occurredAt: true } },
  due: { select: { id: true, personName: true, description: true } },
} satisfies Prisma.VaultDocumentInclude;

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const input = vaultDocumentUpdateSchema.parse(await req.json());
    const document = await prisma.vaultDocument.update({
      where: { id: ctx.params.id },
      data: input,
      include: documentInclude,
    });
    return ok(serialize(document));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await prisma.vaultDocument.delete({ where: { id: ctx.params.id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
