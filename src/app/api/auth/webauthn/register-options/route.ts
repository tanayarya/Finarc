import { generateRegistrationOptions } from "@simplewebauthn/server";
import { ok, handleError } from "@/lib/api";
import { getWebAuthnCredentials, getWebAuthnRequestContext, setSetting } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { rpID } = getWebAuthnRequestContext(req);
    const credentials = await getWebAuthnCredentials();
    const options = await generateRegistrationOptions({
      rpName: "Finarc",
      rpID,
      userID: new TextEncoder().encode("finarc-local-user"),
      userName: "finarc-user",
      userDisplayName: "Finarc user",
      attestationType: "none",
      timeout: 60_000,
      excludeCredentials: credentials.map((credential) => ({
        id: credential.id,
        transports: credential.transports,
      })),
      authenticatorSelection: {
        residentKey: "discouraged",
        userVerification: "discouraged",
      },
      preferredAuthenticatorType: "securityKey",
    });

    await setSetting("authWebAuthnRegisterChallenge", options.challenge);
    return ok(options);
  } catch (e) {
    return handleError(e);
  }
}
