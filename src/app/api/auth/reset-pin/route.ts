import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PIN = "123456";

export async function POST(req: NextRequest) {
  try {
    const { currentPin, newPin } = await req.json();
    if (!currentPin || !newPin) return fail("Both current and new PIN required", 400);
    if (typeof newPin !== "string" || newPin.length !== 6 || !/^\d{6}$/.test(newPin))
      return fail("PIN must be exactly 6 digits", 400);

    const setting = await prisma.appSetting.findUnique({ where: { key: "pin" } });
    const storedPin = setting?.value ?? DEFAULT_PIN;

    if (currentPin !== storedPin) return fail("Current PIN is incorrect", 401);

    await prisma.appSetting.upsert({
      where: { key: "pin" },
      update: { value: newPin },
      create: { key: "pin", value: newPin },
    });

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
