export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function fetcher<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? "Request failed", res.status, json?.error?.details);
  }
  return json.data as T;
}

export function postJson<T>(url: string, body: unknown) {
  return fetcher<T>(url, { method: "POST", body: JSON.stringify(body) });
}
export function patchJson<T>(url: string, body: unknown) {
  return fetcher<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}
export function delJson<T>(url: string) {
  return fetcher<T>(url, { method: "DELETE" });
}
