import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { createCategory, listCategories } from "@/lib/services/categories";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const kind = req.nextUrl.searchParams.get("kind");
    const cats = await listCategories(
      kind === "INCOME" || kind === "EXPENSE" ? kind : undefined
    );
    return ok(serialize(cats));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cat = await createCategory(body);
    return ok(serialize(cat), 201);
  } catch (e) {
    return handleError(e);
  }
}
