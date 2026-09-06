import { NextRequest } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { ok, fail, handleError } from "@/lib/api";
import {
  deleteSetting,
  getSetting,
  getWebAuthnCredentials,
  getWebAuthnRequestContext,
  publicKeyFromBase64Url,
  saveWebAuthnCredentials,
} from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const response = await req.json();
    const expectedChallenge = await getSetting("authWebAuthnAuthenticationChallenge");
    if (!expectedChallenge) return fail("Start security key verification first", 400);

    const credentials = await getWebAuthnCredentials();
    const storedCredential = credentials.find((credential) => credential.id === response.id);
    if (!storedCredential) return fail("Security key is not registered", 401);

    const { rpID, origin } = getWebAuthnRequestContext(req);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.id,
        publicKey: publicKeyFromBase64Url(storedCredential.publicKey),
        counter: storedCredential.counter,
        transports: storedCredential.transports,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) return fail("Security key verification failed", 401);

    await saveWebAuthnCredentials(
      credentials.map((credential) =>
        credential.id === storedCredential.id
          ? { ...credential, counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() }
          : credential
      )
    );
    await deleteSetting("authWebAuthnAuthenticationChallenge");

    return ok({ authenticated: true, method: "webauthn" });
  } catch (e) {
    return handleError(e);
  }
}
