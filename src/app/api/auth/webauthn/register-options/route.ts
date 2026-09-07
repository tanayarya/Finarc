import { generateRegistrationOptions } from "@simplewebauthn/server";
import { ok, fail, handleError } from "@/lib/api";
import { getWebAuthnCredentials, getWebAuthnRequestContext, setSetting } from "@/lib/services/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(`auth:webauthn-register:${getClientIp(req)}`, { limit: 10, windowMs: 10 * 60 * 1000 });
    if (!limited.ok) return fail("Too many attempts. Try again in a few minutes.", 429);

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
