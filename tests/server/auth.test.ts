import { describe, expect, test } from "vitest";
import {
  createSessionCookie,
  hashPassword,
  resolveLoginPasswordHash,
  verifyPassword,
  verifySessionCookie
} from "../../src/server/auth/session";

describe("shared-password session auth", () => {
  test("password hashes verify exact shared passwords only", async () => {
    const hash = await hashPassword("admin-secret");

    await expect(verifyPassword("admin-secret", hash)).resolves.toBe(true);
    await expect(verifyPassword("read-secret", hash)).resolves.toBe(false);
  });

  test("admin and read-only sessions are separate cookie roles", async () => {
    const cookie = await createSessionCookie("admin", "session-secret", "2026-04-24T00:00:00Z");

    await expect(verifySessionCookie(cookie.value, "admin", "session-secret", "2026-04-24T00:10:00Z")).resolves.toBe(true);
    await expect(verifySessionCookie(cookie.value, "read", "session-secret", "2026-04-24T00:10:00Z")).resolves.toBe(false);
  });

  test("default passwords only work when explicitly enabled for development", async () => {
    await expect(resolveLoginPasswordHash("admin", null, undefined, false)).rejects.toMatchObject({ status: 500 });
    await expect(resolveLoginPasswordHash("admin", await hashPassword("admin"), undefined, false)).rejects.toMatchObject({ status: 500 });

    const devHash = await resolveLoginPasswordHash("admin", null, undefined, true);
    await expect(verifyPassword("admin", devHash)).resolves.toBe(true);

    const configuredHash = await resolveLoginPasswordHash("admin", null, "admin-secret", false);
    await expect(verifyPassword("admin-secret", configuredHash)).resolves.toBe(true);

    const upgradedHash = await resolveLoginPasswordHash("admin", await hashPassword("admin"), "real-production-secret", false);
    await expect(verifyPassword("real-production-secret", upgradedHash)).resolves.toBe(true);
  });
});
