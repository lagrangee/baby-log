export type SessionRole = "admin" | "read";

const encoder = new TextEncoder();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  return hex(new Uint8Array(digest));
}

export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  return constantEqual(await hashPassword(password), expectedHash);
}

export async function resolveLoginPasswordHash(role: SessionRole, existingHash: string | null, configuredPassword: string | undefined, allowDevDefaults: boolean): Promise<string> {
  const defaultPassword = role === "admin" ? "admin" : "read";
  if (existingHash) {
    const defaultHash = await hashPassword(defaultPassword);
    if (configuredPassword && constantEqual(existingHash, defaultHash)) {
      return hashPassword(configuredPassword);
    }
    if (!configuredPassword && !allowDevDefaults && constantEqual(existingHash, defaultHash)) {
      throwPasswordNotConfigured();
    }
    return existingHash;
  }
  if (configuredPassword) return hashPassword(configuredPassword);
  if (allowDevDefaults) return hashPassword(defaultPassword);
  throwPasswordNotConfigured();
}

function throwPasswordNotConfigured(): never {
  const error = new Error("Password is not configured") as Error & { status: number };
  error.status = 500;
  throw error;
}

export async function createSessionCookie(role: SessionRole, secret: string, nowIso: string) {
  const expiresAt = new Date(new Date(nowIso).getTime() + SESSION_TTL_MS).toISOString();
  const payload = `${role}.${expiresAt}`;
  const signature = await hmac(payload, secret);
  const name = role === "admin" ? "yb_admin_session" : "yb_read_session";
  return {
    name,
    value: `${payload}.${signature}`,
    header: `${name}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`
  };
}

export async function verifySessionCookie(cookieValue: string | undefined | null, role: SessionRole, secret: string, nowIso: string): Promise<boolean> {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length < 4) return false;
  const cookieRole = parts[0] as SessionRole;
  const signature = parts.at(-1)!;
  const expiresAt = parts.slice(1, -1).join(".");
  if (cookieRole !== role) return false;
  if (new Date(expiresAt).getTime() <= new Date(nowIso).getTime()) return false;
  const expected = await hmac(`${cookieRole}.${expiresAt}`, secret);
  return constantEqual(signature, expected);
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function clearCookieHeader(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return hex(new Uint8Array(signature));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}
