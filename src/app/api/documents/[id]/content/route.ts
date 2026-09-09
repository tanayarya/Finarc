import { NextRequest, NextResponse } from "next/server";
import { fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { decryptVaultFile } from "@/lib/services/document-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const document = await prisma.vaultDocument.findUnique({
      where: { id: ctx.params.id },
      select: {
        originalFilename: true,
        mimeType: true,
        encryptedData: true,
        encryptionIv: true,
        encryptionTag: true,
      },
    });
    if (!document) return fail("Document not found", 404);

    const bytes = decryptVaultFile(document);
    const download = req.nextUrl.searchParams.get("download") === "1";
    const filename = document.originalFilename.replace(/[\\\r\n\"]/g, "_");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename=\"${filename}\"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
