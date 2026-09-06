import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getWebAuthnCredentials, saveWebAuthnCredentials } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const credentialId = decodeURIComponent(params.id);
    const credentials = await getWebAuthnCredentials();
    await saveWebAuthnCredentials(credentials.filter((credential) => credential.id !== credentialId));
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
