import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = (await prisma.appSetting.findUnique({ where: { key: "aiProvider" } }))?.value ?? "openai";
    const hasKey = Boolean((await prisma.appSetting.findUnique({ where: { key: "openaiApiKey" } }))?.value);
    const ollamaUrl = (await prisma.appSetting.findUnique({ where: { key: "ollamaUrl" } }))?.value ?? "http://localhost:11434";
    const shareDetails = (await prisma.appSetting.findUnique({ where: { key: "aiShareDetails" } }))?.value === "true";
    const openaiModel = (await prisma.appSetting.findUnique({ where: { key: "openaiModel" } }))?.value ?? "gpt-4o-mini";
    const ollamaModel = (await prisma.appSetting.findUnique({ where: { key: "ollamaModel" } }))?.value ?? "llama3.2";

    return ok({ provider, hasOpenAIKey: hasKey, ollamaUrl, shareDetails, openaiModel, ollamaModel });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.provider !== undefined) {
      await prisma.appSetting.upsert({ where: { key: "aiProvider" }, update: { value: body.provider }, create: { key: "aiProvider", value: body.provider } });
    }
    if (body.openaiApiKey !== undefined) {
      await prisma.appSetting.upsert({ where: { key: "openaiApiKey" }, update: { value: body.openaiApiKey }, create: { key: "openaiApiKey", value: body.openaiApiKey } });
    }
    if (body.ollamaUrl !== undefined) {
      await prisma.appSetting.upsert({ where: { key: "ollamaUrl" }, update: { value: body.ollamaUrl }, create: { key: "ollamaUrl", value: body.ollamaUrl } });
    }
    if (body.shareDetails !== undefined) {
      await prisma.appSetting.upsert({ where: { key: "aiShareDetails" }, update: { value: String(body.shareDetails) }, create: { key: "aiShareDetails", value: String(body.shareDetails) } });
    }
    if (body.openaiModel !== undefined) {
      await prisma.appSetting.upsert({ where: { key: "openaiModel" }, update: { value: body.openaiModel }, create: { key: "openaiModel", value: body.openaiModel } });
    }
    if (body.ollamaModel !== undefined) {
      await prisma.appSetting.upsert({ where: { key: "ollamaModel" }, update: { value: body.ollamaModel }, create: { key: "ollamaModel", value: body.ollamaModel } });
    }

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
