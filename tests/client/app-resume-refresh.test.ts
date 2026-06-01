import { describe, expect, test } from "vitest";
import { installAppResumeRefresh } from "../../src/client/utils/app-resume-refresh";

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

describe("app resume refresh", () => {
  test("refreshes when the installed web app becomes visible again", () => {
    const windowTarget = new EventTarget();
    const documentTarget = new FakeDocument();
    const calls: number[] = [];
    let now = 1000;

    const cleanup = installAppResumeRefresh(() => calls.push(now), {
      windowTarget,
      documentTarget,
      minIntervalMs: 0,
      now: () => now
    });

    documentTarget.visibilityState = "hidden";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    documentTarget.visibilityState = "visible";
    now = 2000;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    cleanup();
    now = 3000;
    windowTarget.dispatchEvent(new Event("focus"));

    expect(calls).toEqual([2000]);
  });

  test("coalesces focus and pageshow refresh bursts", () => {
    const windowTarget = new EventTarget();
    const documentTarget = new FakeDocument();
    let count = 0;
    let now = 1000;

    installAppResumeRefresh(() => {
      count += 1;
    }, { windowTarget, documentTarget, minIntervalMs: 1000, now: () => now });

    windowTarget.dispatchEvent(new Event("pageshow"));
    now = 1200;
    windowTarget.dispatchEvent(new Event("focus"));
    now = 2200;
    windowTarget.dispatchEvent(new Event("focus"));

    expect(count).toBe(2);
  });
});
