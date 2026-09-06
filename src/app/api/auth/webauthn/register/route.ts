import { NextRequest } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { ok, fail, handleError } from "@/lib/api";
import {
  deleteSetting,
  getSetting,
  getWebAuthnCredentials,
  getWebAuthnRequestContext,
  publicKeyToBase64Url,
  saveWebAuthnCredentials,
} from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const expectedChallenge = await getSetting("authWebAuthnRegisterChallenge");
    if (!expectedChallenge) return fail("Start security key setup first", 400);

    const { rpID, origin } = getWebAuthnRequestContext(req);
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return fail("Security key registration failed", 401);
    }

    const credentials = await getWebAuthnCredentials();
    const credential = verification.registrationInfo.credential;
    const now = new Date().toISOString();
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "Security key";

    const withoutDuplicate = credentials.filter((item) => item.id !== credential.id);
    await saveWebAuthnCredentials([
      ...withoutDuplicate,
      {
        id: credential.id,
        name,
        publicKey: publicKeyToBase64Url(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports,
        createdAt: now,
      },
    ]);
    await deleteSetting("authWebAuthnRegisterChallenge");

    return ok({ registered: true });
  } catch (e) {
    return handleError(e);
  }
}
