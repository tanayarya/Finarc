import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PIN = "123456";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin || typeof pin !== "string") return fail("PIN required", 400);

    const setting = await prisma.appSetting.findUnique({ where: { key: "pin" } });
    const storedPin = setting?.value ?? DEFAULT_PIN;

    if (pin === storedPin) {
      return ok({ authenticated: true });
    }
    return fail("Incorrect PIN", 401);
  } catch (e) {
    return handleError(e);
  }
}
