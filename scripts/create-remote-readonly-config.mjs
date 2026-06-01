#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const inputPath = path.resolve(rootDir, process.argv[2] ?? "wrangler.local.toml");
const outputPath = path.resolve(rootDir, process.argv[3] ?? "wrangler.remote-readonly.toml");

if (!fs.existsSync(inputPath)) {
  throw new Error(`Missing ${path.relative(rootDir, inputPath)}. Create it from wrangler.toml and keep real values out of Git.`);
}

let config = fs.readFileSync(inputPath, "utf8");

config = forceWorkersDevOnly(config);
config = upsertAssetsRunWorkerFirst(config, ["/api/*", "/machine/*"]);
config = upsertRemoteD1(config);
config = upsertStringVar(config, "READ_ONLY_REMOTE_D1_PROBE", "true");

fs.writeFileSync(
  outputPath,
  [
    "# Generated from private Wrangler config for local remote-D1 read-only verification.",
    "# Do not commit this file. Mutating HTTP methods are blocked by READ_ONLY_REMOTE_D1_PROBE.",
    config.trimEnd(),
    ""
  ].join("\n")
);

console.log(`Wrote ${path.relative(rootDir, outputPath)} with remote D1 and read-only probe enabled`);

function upsertRemoteD1(input) {
  const tablePattern = /(\[\[d1_databases\]\][\s\S]*?)(?=\n\[[^\n]*\]|$)/;
  const match = input.match(tablePattern);
  if (!match) throw new Error("No [[d1_databases]] table found in Wrangler config.");
  const table = match[1];
  if (!/binding\s*=\s*"DB"/.test(table)) throw new Error('The first D1 binding must be binding = "DB".');
  let nextTable = table.replace(/^\s*remote\s*=.*\n?/gm, "");
  if (/database_id\s*=/.test(nextTable)) {
    nextTable = nextTable.replace(/(database_id\s*=\s*"[^"]+"\n)/, "$1remote = true\n");
  } else {
    nextTable = `${nextTable.trimEnd()}\nremote = true\n`;
  }
  return input.replace(table, nextTable);
}

function forceWorkersDevOnly(input) {
  let next = input.replace(/^routes\s*=\s*\[[\s\S]*?\]\n?/m, "");
  if (/^workers_dev\s*=/m.test(next)) {
    next = next.replace(/^workers_dev\s*=.*$/m, "workers_dev = true");
  } else {
    next = next.replace(/^(compatibility_date\s*=\s*"[^"]+"\n)/m, "$1workers_dev = true\n");
  }
  return next;
}

function upsertAssetsRunWorkerFirst(input, patterns) {
  const assetsPattern = /(\[assets\][\s\S]*?)(?=\n\[[^\n]*\]|$)/;
  const match = input.match(assetsPattern);
  if (!match) throw new Error("No [assets] table found in Wrangler config.");
  const line = `run_worker_first = [${patterns.map((pattern) => JSON.stringify(pattern)).join(", ")}]`;
  const assetsTable = match[1];
  const nextAssetsTable = /^\s*run_worker_first\s*=.*$/m.test(assetsTable)
    ? assetsTable.replace(/^\s*run_worker_first\s*=.*$/m, line)
    : `${assetsTable.trimEnd()}\n${line}\n`;
  return input.replace(assetsTable, nextAssetsTable);
}

function upsertStringVar(input, key, value) {
  const line = `${key} = ${JSON.stringify(value)}`;
  const varsPattern = /(\[vars\][\s\S]*?)(?=\n\[[^\n]*\]|$)/;
  const match = input.match(varsPattern);
  if (!match) {
    return `${input.trimEnd()}\n\n[vars]\n${line}\n`;
  }
  const varsTable = match[1];
  const nextVarsTable = new RegExp(`^\\s*${key}\\s*=.*$`, "m").test(varsTable)
    ? varsTable.replace(new RegExp(`^\\s*${key}\\s*=.*$`, "m"), line)
    : `${varsTable.trimEnd()}\n${line}\n`;
  return input.replace(varsTable, nextVarsTable);
}
