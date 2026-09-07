import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { ok, fail, handleError } from "@/lib/api";
import { getWebAuthnCredentials, getWebAuthnRequestContext, setSetting } from "@/lib/services/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(`auth:webauthn-options:${getClientIp(req)}`, { limit: 20, windowMs: 5 * 60 * 1000 });
    if (!limited.ok) return fail("Too many attempts. Try again in a few minutes.", 429);

    const credentials = await getWebAuthnCredentials();
    if (!credentials.length) return fail("No security key is configured", 400);

    const { rpID } = getWebAuthnRequestContext(req);
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((credential) => ({
        id: credential.id,
        transports: credential.transports,
      })),
      timeout: 60_000,
      userVerification: "discouraged",
    });

    await setSetting("authWebAuthnAuthenticationChallenge", options.challenge);
    return ok(options);
  } catch (e) {
    return handleError(e);
  }
}
