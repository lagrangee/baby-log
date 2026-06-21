import { describe, expect, test, vi } from "vitest";
import { completeLoginNavigation } from "../../src/client/utils/login-navigation";

describe("login navigation", () => {
  test("uses a document navigation after read login so mobile browsers commit the session cookie before loading /read", () => {
    const assign = vi.fn();
    const onNavigate = vi.fn();

    completeLoginNavigation("read", onNavigate, { assign } as unknown as Location);

    expect(assign).toHaveBeenCalledWith("/read");
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
