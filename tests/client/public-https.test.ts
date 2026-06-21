import { describe, expect, test, vi } from "vitest";
import { enforcePublicHttps } from "../../src/client/utils/public-https";

describe("public HTTPS guard", () => {
  test("replaces public HTTP pages with HTTPS before the app starts fetching APIs", () => {
    const replace = vi.fn();

    const redirected = enforcePublicHttps({
      href: "http://yubao.lagrangee.xyz/login/read?next=%2Fread",
      replace
    });

    expect(redirected).toBe(true);
    expect(replace).toHaveBeenCalledWith("https://yubao.lagrangee.xyz/login/read?next=%2Fread");
  });

  test("keeps local HTTP development URLs in place", () => {
    const replace = vi.fn();

    const redirected = enforcePublicHttps({
      href: "http://localhost:8788/login/read",
      replace
    });

    expect(redirected).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});
