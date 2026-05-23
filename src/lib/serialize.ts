/**
 * Convert Prisma Decimal & Date types into plain JSON-safe values.
 * Recurses into objects and arrays.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize) as unknown as T;
  if (typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v && typeof v === "object" && "toFixed" in (v as object) && typeof (v as { toFixed?: unknown }).toFixed === "function") {
        // Decimal-like
        obj[k] = (v as { toFixed: (dp: number) => string }).toFixed(2);
      } else if (v instanceof Date) {
        obj[k] = v.toISOString();
      } else {
        obj[k] = serialize(v);
      }
    }
    return obj as T;
  }
  return value;
}
