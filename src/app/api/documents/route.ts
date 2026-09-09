import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, VaultDocumentType } from "@prisma/client";
import { fail, handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { encryptVaultFile, validateVaultFile } from "@/lib/services/document-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.nativeEnum(VaultDocumentType),
  notes: z.string().trim().max(1000).optional().nullable(),
  accountId: z.string().optional().nullable(),
  holdingId: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  dueId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const links = [data.accountId, data.holdingId, data.transactionId, data.dueId].filter(Boolean);
  if (links.length > 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Link a document to one record at a time" });
});

const documentInclude = {
  account: { select: { id: true, name: true, type: true } },
  holding: { select: { id: true, name: true, type: true, assetClass: true } },
  transaction: { select: { id: true, description: true, amount: true, occurredAt: true } },
  due: { select: { id: true, personName: true, description: true } },
} satisfies Prisma.VaultDocumentInclude;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const query = params.get("q")?.trim();
    const type = params.get("type");
    const where: Prisma.VaultDocumentWhereInput = {};

    if (type && Object.values(VaultDocumentType).includes(type as VaultDocumentType)) {
      where.type = type as VaultDocumentType;
    }
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { originalFilename: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
        { account: { name: { contains: query, mode: "insensitive" } } },
        { holding: { name: { contains: query, mode: "insensitive" } } },
      ];
    }

    const documents = await prisma.vaultDocument.findMany({
      where,
      include: documentInclude,
      orderBy: [{ createdAt: "desc" }],
    });
    return ok(serialize(documents));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Choose a document to upload", 400);
    validateVaultFile(file);

    const metadata = createSchema.parse({
      title: form.get("title"),
      type: form.get("type"),
      notes: form.get("notes") || null,
      accountId: form.get("accountId") || null,
      holdingId: form.get("holdingId") || null,
      transactionId: form.get("transactionId") || null,
      dueId: form.get("dueId") || null,
    });
    const bytes = Buffer.from(await file.arrayBuffer());
    const encrypted = encryptVaultFile(bytes);
    const document = await prisma.vaultDocument.create({
      data: {
        ...metadata,
        originalFilename: file.name.slice(0, 255),
        mimeType: file.type,
        byteSize: file.size,
        ...encrypted,
      },
      include: documentInclude,
    });
    return ok(serialize(document), 201);
  } catch (e) {
    return handleError(e);
  }
}
