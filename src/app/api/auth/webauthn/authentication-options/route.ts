import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { ok, fail, handleError } from "@/lib/api";
import { getWebAuthnCredentials, getWebAuthnRequestContext, setSetting } from "@/lib/services/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
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
      userVerification: "preferred",
    });

    await setSetting("authWebAuthnAuthenticationChallenge", options.challenge);
    return ok(options);
  } catch (e) {
    return handleError(e);
  }
}
