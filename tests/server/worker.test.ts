import { describe, expect, test } from "vitest";
import worker from "../../src/worker";

describe("worker asset fallback", () => {
  test("read-only remote D1 probe mode rejects mutating requests before they reach the API", async () => {
    const env = {
      READ_ONLY_REMOTE_D1_PROBE: "true",
      ASSETS: {
        fetch: async () => new Response("should not reach assets")
      }
    } as unknown as Env;

    const response = await worker.fetch(new Request("https://example.com/api/events", { method: "POST" }), env);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    await expect(response.json()).resolves.toEqual({ error: "Read-only remote D1 probe rejects mutating requests" });
  });

  test("unknown machine paths return JSON 404 instead of the app shell", async () => {
    const env = {
      ASSETS: {
        fetch: async (request: Request) => new Response(request.url.endsWith("/index.html") ? "<div id=\"app\"></div>" : "asset missing", { status: request.url.endsWith("/index.html") ? 200 : 404 })
      }
    } as unknown as Env;

    const response = await worker.fetch(new Request("https://example.com/machine/v1/token/not-real.html", { headers: { accept: "text/html" } }), env);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Machine endpoint not found" });
  });
});
