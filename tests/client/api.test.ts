import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../../src/client/api";

describe("client API helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("uses same-origin credentials so session cookies are stored and sent", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/api/read/summary")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/read/summary",
      expect.objectContaining({
        credentials: "same-origin"
      })
    );
  });
});
