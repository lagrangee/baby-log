#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
loadEnvFile(path.join(rootDir, ".dev.vars"));

const args = parseArgs(process.argv.slice(2));
const baseUrl = stripTrailingSlash(args.baseUrl ?? process.env.BABY_LOG_REMOTE_READONLY_BASE_URL ?? "http://127.0.0.1:8788");
const machineToken = args.token ?? process.env.BABY_LOG_MACHINE_TOKEN;

if (!machineToken) {
  throw new Error("Missing BABY_LOG_MACHINE_TOKEN in .dev.vars or --token. The smoke test will not guess private tokens.");
}

const checks = [
  {
    label: "app shell",
    request: () => fetchUrl("/", { headers: { accept: "text/html" } }),
    expect: async (response) => {
      assertStatus(response, 200);
      assertHeaderIncludes(response, "content-type", "text/html");
    }
  },
  {
    label: "machine test HEAD",
    request: () => fetchUrl(`/machine/v1/${encodeURIComponent(machineToken)}/test`, { method: "HEAD" }),
    expect: async (response) => assertStatus(response, 200)
  },
  {
    label: "machine current JSON",
    request: () => fetchUrl(`/machine/v1/${encodeURIComponent(machineToken)}/current.json`),
    expect: async (response) => {
      assertStatus(response, 200);
      assertHeaderIncludes(response, "cache-control", "no-store");
      const body = await response.json();
      if (body.machine_payload_version !== "chatgpt_automation_1") {
        throw new Error(`Unexpected machine payload version: ${String(body.machine_payload_version)}`);
      }
      if (!body.generated_at || !body.timezone || !body.links?.current) {
        throw new Error("Machine current payload is missing required manifest fields.");
      }
    }
  },
  {
    label: "invalid machine token remains unauthorized",
    request: () => fetchUrl("/machine/v1/not-the-real-token/test"),
    expect: async (response) => assertStatus(response, 401)
  },
  {
    label: "admin write blocked",
    request: () => fetchUrl("/api/events", { method: "POST", body: "{}" }),
    expect: async (response) => {
      assertStatus(response, 405);
      assertHeaderIncludes(response, "allow", "GET, HEAD, OPTIONS");
    }
  },
  {
    label: "read-helper write blocked",
    request: () => fetchUrl("/api/read/events", { method: "POST", body: "{}" }),
    expect: async (response) => assertStatus(response, 405)
  },
  {
    label: "login write blocked",
    request: () => fetchUrl("/api/session/admin/login", { method: "POST", body: "{}" }),
    expect: async (response) => assertStatus(response, 405)
  }
];

for (const check of checks) {
  try {
    const response = await check.request();
    await check.expect(response);
    console.log(`ok ${check.label}`);
  } catch (error) {
    console.error(`not ok ${check.label}`);
    throw error;
  }
}

console.log("remote-readonly-smoke: ok");

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--base-url") {
      parsed.baseUrl = values[index + 1];
      index += 1;
    } else if (value === "--token") {
      parsed.token = values[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function fetchUrl(urlPath, init = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${urlPath}`, { ...init, headers });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = parseEnvValue(rawValue);
  }
}

function parseEnvValue(rawValue) {
  let value = rawValue.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function assertStatus(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected HTTP ${expectedStatus}, got ${response.status}`);
  }
}

function assertHeaderIncludes(response, name, value) {
  const actual = response.headers.get(name);
  if (!actual?.includes(value)) {
    throw new Error(`Expected ${name} header to include ${value}, got ${actual ?? "null"}`);
  }
}
