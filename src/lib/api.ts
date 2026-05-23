import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json({ data }, typeof init === "number" ? { status: init } : init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

export function serializeError(err: unknown): { message: string; status: number; details?: unknown } {
  if (err instanceof ZodError) {
    return {
      status: 400,
      message: "Invalid input",
      details: err.flatten(),
    };
  }
  if (err instanceof Error) return { status: 400, message: err.message };
  return { status: 500, message: "Unexpected error" };
}

export function handleError(err: unknown) {
  const e = serializeError(err);
  return fail(e.message, e.status, e.details);
}
