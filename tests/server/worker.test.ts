import { describe, expect, test } from "vitest";
import worker from "../../src/worker";

describe("worker asset fallback", () => {
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
