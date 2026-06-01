export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
}

export function jsonResponse(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(value), {
    ...init,
    headers
  });
}

export function noContent(headers?: HeadersInit): Response {
  const merged = new Headers(headers);
  if (!merged.has("cache-control")) merged.set("cache-control", "no-store");
  return new Response(null, { status: 204, headers: merged });
}

export function httpError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export function errorResponse(error: unknown): Response {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 500;
  const message = error instanceof Error ? error.message : "Internal Server Error";
  return jsonResponse({ error: message }, { status: Number.isFinite(status) ? status : 500 });
}
