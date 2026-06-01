#!/usr/bin/env node
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const DAILY_BRIEF_PATH = "baby_log_daily_brief.md";
const GENERATED_ARCHIVE_PATTERN = /^events_\d{4}-W\d{2}\.md$/;

const EVENT_LABELS = {
  feed_breast: "breast feeding",
  feed_bottle: "bottle feeding",
  diaper_pee: "pee",
  diaper_poop: "poop",
  sleep_session: "sleep",
  temperature: "temperature",
  medicine: "medicine",
  note: "note",
  symptom: "symptom",
  tummy_time: "tummy time",
  growth_measurement: "growth measurement"
};

export function buildSourcePackFiles({ current, daysPayload, recentEventsPayload, weeklyEventPayloads }) {
  const generatedAt = current.generated_at ?? daysPayload.generated_at ?? recentEventsPayload.generated_at;
  const timezone = current.timezone ?? daysPayload.timezone ?? recentEventsPayload.timezone ?? "Asia/Shanghai";
  const files = [
    {
      path: "README.md",
      content: formatReadme({ current, generatedAt, timezone })
    },
    {
      path: DAILY_BRIEF_PATH,
      content: formatDailyBrief({ current, daysPayload })
    },
    {
      path: "baby_log_7days_events.md",
      content: formatEventsDocument({
        title: "Baby Log complete events from the last 7 days",
        generatedAt,
        timezone,
        rangeLabel: eventRangeLabel(recentEventsPayload),
        events: recentEventsPayload.events ?? [],
        includeReadHint: true,
        hasMore: recentEventsPayload.pagination?.has_more === true
      })
    },
    {
      path: "baby_log_data_dictionary.md",
      content: formatDataDictionary({ generatedAt, timezone })
    },
    {
      path: "sync_status.txt",
      content: formatSyncStatus({ current, daysPayload, recentEventsPayload, weeklyEventPayloads, generatedAt, timezone })
    }
  ];

  for (const weekly of weeklyEventPayloads) {
    files.push({
      path: `events_archive/events_${weekly.weekKey}.md`,
      content: formatEventsDocument({
        title: `Baby Log archived complete events ${weekly.weekKey}`,
        generatedAt,
        timezone,
        rangeLabel: `${weekly.from} to ${weekly.to}`,
        events: weekly.payload.events ?? [],
        includeReadHint: false,
        hasMore: weekly.payload.pagination?.has_more === true
      })
    });
  }

  return files;
}

export function formatDailyBrief({ current, daysPayload }) {
  const generatedAt = current.generated_at ?? daysPayload.generated_at;
  const timezone = current.timezone ?? daysPayload.timezone ?? "Asia/Shanghai";
  const rows = (daysPayload.days ?? []).slice().sort((a, b) => b.local_date.localeCompare(a.local_date));
  const lines = [
    "# Baby Log Daily Brief",
    "",
    `updated_at: ${generatedAt}`,
    `timezone: ${timezone}`,
    `data_range: ${current.data_range?.available_from_local_date ?? "unknown"} to ${current.data_range?.available_to_local_date ?? "unknown"}`,
    "",
    "This file is the long-running daily summary ledger. Each local date has one fixed-format row, with the newest date first. Read this first for trend analysis.",
    "",
    "| local_date | age_days | feed_count | bottle_ml | pee | poop | sleep_min | max_temp_c | latest_weight_g | notes |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
  ];

  for (const day of rows) {
    lines.push(markdownRow([
        day.local_date,
        value(day.age_days),
        value(day.feeding?.total_count),
        value(day.feeding?.bottle_ml_total),
        value(day.diaper?.pee_count),
        value(day.diaper?.poop_count),
        value(day.sleep?.minutes_total),
        value(day.temperature?.max_c),
        value(day.growth?.latest_weight_g),
        ""
      ]));
  }

  lines.push("");
  return lines.join("\n");
}

export function formatEventsDocument({ title, generatedAt, timezone, rangeLabel, events, includeReadHint, hasMore = false }) {
  const sorted = events.slice().sort((a, b) => {
    const byDate = b.local_date.localeCompare(a.local_date);
    return byDate || a.occurred_at.localeCompare(b.occurred_at);
  });
  const lines = [
    `# ${title}`,
    "",
    `updated_at: ${generatedAt}`,
    `timezone: ${timezone}`,
    `range: ${rangeLabel}`,
    `event_count: ${sorted.length}`,
    ""
  ];

  if (includeReadHint) {
    lines.push("Read this recent window by default. Only read `events_archive/` when the user asks about an older date or week.", "");
  }
  if (hasMore) {
    lines.push("Warning: this time window exceeded the single-export event limit. Re-export a smaller window if exact completeness matters.", "");
  }

  let currentDate = "";
  for (const event of sorted) {
    if (event.local_date !== currentDate) {
      currentDate = event.local_date;
      lines.push(`## ${currentDate}`, "");
    }
    lines.push(formatEventLine(event, timezone));
  }

  if (!sorted.length) {
    lines.push("No records in this time window.");
  }
  lines.push("");
  return lines.join("\n");
}

export function isoWeekKey(localDate) {
  const date = new Date(`${localDate}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weeklyRanges(from, to) {
  if (!from || !to || from > to) return [];
  const ranges = [];
  let cursor = from;
  while (cursor <= to) {
    const weekKey = isoWeekKey(cursor);
    const weekEnd = minDate(to, endOfIsoWeek(cursor));
    ranges.push({ weekKey, from: cursor, to: weekEnd });
    cursor = addDays(weekEnd, 1);
  }
  return ranges;
}

export async function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv, env);
  const localEnv = options.token ? {} : parseEnvFile(await readOptional(join(process.cwd(), ".dev.vars")));
  options.token = options.token ?? localEnv.BABY_LOG_MACHINE_TOKEN ?? null;
  if (!env.BABY_LOG_MACHINE_BASE_URL && !options.explicitBaseUrl && localEnv.BABY_LOG_MACHINE_BASE_URL) options.baseUrl = localEnv.BABY_LOG_MACHINE_BASE_URL.replace(/\/+$/, "");
  if (!env.BABY_LOG_CHATGPT_SOURCE_DIR && !options.explicitOutputDir && localEnv.BABY_LOG_CHATGPT_SOURCE_DIR) options.outputDir = localEnv.BABY_LOG_CHATGPT_SOURCE_DIR;
  if (!options.baseUrl) {
    throw new Error("Missing machine base URL. Set BABY_LOG_MACHINE_BASE_URL in .dev.vars or pass --base-url; do not commit the real URL.");
  }
  if (!options.outputDir) {
    throw new Error("Missing output directory. Set BABY_LOG_CHATGPT_SOURCE_DIR in .dev.vars or pass --output; generated source packs may contain private data.");
  }
  const token = options.token;
  if (!token) {
    throw new Error("Missing machine token. Set BABY_LOG_MACHINE_TOKEN or pass --token; the token is never written to the output files.");
  }
  const current = await fetchJson(machineUrl(options.baseUrl, token, "current.json"));
  const timezone = current.timezone ?? "Asia/Shanghai";
  const availableFrom = current.data_range?.available_from_local_date ?? localDateForTimezone(current.generated_at, timezone);
  const availableTo = current.data_range?.available_to_local_date ?? localDateForTimezone(current.generated_at, timezone);
  const daysFrom = dateDiffDays(availableFrom, availableTo) < 60 ? availableFrom : addDays(availableTo, -59);
  const daysPayload = await fetchJson(machineUrl(options.baseUrl, token, "days.json", { from: daysFrom, to: availableTo }));
  const recentFrom = maxDate(availableFrom, addDays(availableTo, -6));
  const recentEventsPayload = await fetchEventsForLocalRange(options.baseUrl, token, timezone, recentFrom, availableTo);
  const weeklyEventPayloads = [];

  for (const range of weeklyRanges(availableFrom, availableTo)) {
    weeklyEventPayloads.push({
      ...range,
      payload: await fetchEventsForLocalRange(options.baseUrl, token, timezone, range.from, range.to)
    });
  }

  let files = buildSourcePackFiles({ current, daysPayload, recentEventsPayload, weeklyEventPayloads });
  const existingDaily = await readOptional(join(options.outputDir, DAILY_BRIEF_PATH));
  files = files.map((file) =>
    file.path === DAILY_BRIEF_PATH
      ? { ...file, content: mergeDailyBrief(file.content, existingDaily) }
      : file
  );

  await writeSourcePack(options.outputDir, files);
  return files;
}

export function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let item = line.slice(separator + 1).trim();
    if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
      item = item.slice(1, -1);
    }
    values[key] = item;
  }
  return values;
}

function formatReadme({ current, generatedAt, timezone }) {
  return [
    "# Baby Log Source Pack",
    "",
    "This folder is a README-led source pack for ChatGPT or similar tools. It is not the database and it is not a live monitoring page.",
    "",
    "## Read Order",
    "",
    "1. Read `baby_log_daily_brief.md` first for long-term daily trends.",
    "2. Read `baby_log_7days_events.md` when recent event details matter.",
    "3. Read `baby_log_data_dictionary.md` when a field or event type is unclear.",
    "4. Read `events_archive/events_YYYY-Www.md` only when the user asks about an older date or week.",
    "5. Do not infer from files that are not included in this source pack.",
    "",
    "## Recommended Entry Points",
    "",
    "- Trend analysis: `baby_log_daily_brief.md`",
    "- Recent events: `baby_log_7days_events.md`",
    "- Field explanations: `baby_log_data_dictionary.md`",
    "- Sync status: `sync_status.txt`",
    "",
    "## Data Boundary",
    "",
    `- updated_at: ${generatedAt}`,
    `- timezone: ${timezone}`,
    `- child_name: ${current.profile?.child_name ?? ""}`,
    `- nickname: ${current.stable_child_facts?.nickname ?? ""}`,
    `- data_range: ${current.data_range?.available_from_local_date ?? "unknown"} to ${current.data_range?.available_to_local_date ?? "unknown"}`,
    `- event_count: ${current.data_range?.event_count ?? "unknown"}`,
    "",
    "## Time Rules",
    "",
    "- `occurred_at`, `ended_at`, and `updated_at` are UTC timestamps.",
    "- `local_date` is derived by the app from the family timezone.",
    "- Automation usually updates these files on a schedule, so use them for review and trend analysis, not live state.",
    "",
    "## Medical Boundary",
    "",
    "ChatGPT may summarize records, identify data-quality questions, and help prepare questions for a pediatrician. Do not use this source pack to diagnose, prescribe medication, decide vaccines, or replace clinician advice.",
    ""
  ].join("\n");
}

function formatDataDictionary({ generatedAt, timezone }) {
  const lines = [
    "# Baby Log Data Dictionary",
    "",
    `updated_at: ${generatedAt}`,
    `timezone: ${timezone}`,
    "",
    "## Files",
    "",
    "- `baby_log_daily_brief.md`: daily summary, one row per local date.",
    "- `baby_log_7days_events.md`: complete events from the last 7 days.",
    "- `events_archive/events_YYYY-Www.md`: archived historical events, one file per ISO week.",
    "",
    "## Event Types",
    "",
    "| event_type | meaning |",
    "| --- | --- |"
  ];
  for (const [eventType, label] of Object.entries(EVENT_LABELS)) {
    lines.push(`| ${eventType} | ${label} |`);
  }
  lines.push(
    "",
    "## Common Fields",
    "",
    "- `local_date`: family-local date for daily summaries and grouping.",
    "- `occurred_at`: UTC event start timestamp.",
    "- `ended_at`: UTC end timestamp for session-style events; empty means open or not applicable.",
    "- `amount_value` / `amount_unit`: measurement value and unit, such as milk ml or temperature C.",
    "- `details`: extra fields rendered as `key=value`.",
    "- `created_by`: recorder identity for family-internal provenance.",
    "",
    "## Analysis Principles",
    "",
    "- Use daily summaries for trends; do not let one event stand in for an entire day.",
    "- Read event details when explaining a specific date.",
    "- Medical-adjacent output should be framed as observations and questions, not diagnosis or treatment advice.",
    ""
  );
  return lines.join("\n");
}

function formatSyncStatus({ current, daysPayload, recentEventsPayload, weeklyEventPayloads, generatedAt, timezone }) {
  return [
    "Baby Log ChatGPT source pack sync status",
    `updated_at=${generatedAt}`,
    `timezone=${timezone}`,
    `data_range=${current.data_range?.available_from_local_date ?? "unknown"}..${current.data_range?.available_to_local_date ?? "unknown"}`,
    `event_count=${current.data_range?.event_count ?? "unknown"}`,
    `daily_brief_rows=${daysPayload.days?.length ?? 0}`,
    `recent_7days_events=${recentEventsPayload.events?.length ?? 0}`,
    `weekly_archive_files=${weeklyEventPayloads.length}`,
    "source_file_types=md,txt",
    ""
  ].join("\n");
}

function formatEventLine(event, timezone) {
  const parts = [
    `- ${formatLocalTime(event.occurred_at, timezone)}`,
    event.event_type
  ].filter(Boolean);
  if (event.amount_value != null) parts.push(`${event.amount_value}${event.amount_unit ? ` ${event.amount_unit}` : ""}`);
  if (EVENT_LABELS[event.event_type]) parts.push(`(${EVENT_LABELS[event.event_type]})`);
  const trailing = [];
  if (event.ended_at) trailing.push(`ended_at=${event.ended_at}`);
  if (event.note) trailing.push(`note=${sanitizeInline(event.note)}`);
  const details = formatDetails(event.details_json);
  if (details) trailing.push(details);
  trailing.push(`id=${event.id}`);
  return `${parts.join(" ")} | ${trailing.join(" | ")}`;
}

function formatDetails(details) {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details)
    .filter(([, item]) => item != null && item !== "")
    .map(([key, item]) => `${key}=${sanitizeInline(formatScalar(item))}`)
    .join(", ");
}

function formatScalar(item) {
  if (typeof item === "object") return JSON.stringify(item);
  return String(item);
}

function sanitizeInline(text) {
  return String(text).replace(/\s+/g, " ").replace(/\|/g, "/").trim();
}

function value(item) {
  return item == null ? "" : String(item);
}

function markdownRow(cells) {
  return `| ${cells.map((cell) => String(cell).replace(/\|/g, "/")).join(" | ")} |`;
}

function eventRangeLabel(payload) {
  const since = payload.range?.since ?? "unknown";
  const until = payload.range?.until ?? "unknown";
  return `${since} to ${until}`;
}

function parseArgs(argv, env) {
  const options = {
    outputDir: env.BABY_LOG_CHATGPT_SOURCE_DIR || null,
    baseUrl: env.BABY_LOG_MACHINE_BASE_URL || null,
    token: env.BABY_LOG_MACHINE_TOKEN || null,
    explicitOutputDir: false,
    explicitBaseUrl: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      options.outputDir = argv[++index];
      options.explicitOutputDir = true;
    } else if (arg === "--base-url") {
      options.baseUrl = argv[++index];
      options.explicitBaseUrl = true;
    }
    else if (arg === "--token") options.token = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.baseUrl) options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  return options;
}

function machineUrl(baseUrl, token, endpoint, params = {}) {
  const url = new URL(`/machine/v1/${encodeURIComponent(token)}/${endpoint}`, baseUrl);
  for (const [key, item] of Object.entries(params)) {
    if (item != null) url.searchParams.set(key, String(item));
  }
  return url;
}

async function fetchEventsForLocalRange(baseUrl, token, timezone, from, to) {
  return fetchJson(
    machineUrl(baseUrl, token, "events.json", {
      since: utcForLocalDateStart(from, timezone),
      until: utcForLocalDateStart(addDays(to, 1), timezone),
      limit: 1000
    })
  );
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fetch failed ${response.status} ${url.pathname}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

async function writeSourcePack(outputDir, files) {
  await mkdir(outputDir, { recursive: true });
  await mkdir(join(outputDir, "events_archive"), { recursive: true });
  await removeGeneratedArchiveFiles(join(outputDir, "events_archive"));
  for (const file of files) {
    const target = join(outputDir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

async function removeGeneratedArchiveFiles(archiveDir) {
  let entries = [];
  try {
    entries = await readdir(archiveDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (GENERATED_ARCHIVE_PATTERN.test(basename(entry))) {
      await rm(join(archiveDir, entry));
    }
  }
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

function mergeDailyBrief(newContent, existingContent) {
  if (!existingContent) return newContent;
  const newRows = extractDailyRows(newContent);
  const existingRows = extractDailyRows(existingContent);
  const rowsByDate = new Map(existingRows.map((row) => [row.localDate, row.line]));
  for (const row of newRows) rowsByDate.set(row.localDate, row.line);
  const header = newContent.split("\n").slice(0, newContent.split("\n").findIndex((line) => line.startsWith("| 20"))).join("\n");
  const rows = Array.from(rowsByDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, line]) => line);
  return `${header}\n${rows.join("\n")}\n`;
}

function extractDailyRows(content) {
  return content
    .split("\n")
    .filter((line) => /^\| \d{4}-\d{2}-\d{2} \|/.test(line))
    .map((line) => ({ localDate: line.slice(2, 12), line }));
}

function localDateForTimezone(iso, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

function formatLocalTime(iso, timezone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function utcForLocalDateStart(localDate, timezone) {
  const [year, month, day] = localDate.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMinutes = timeZoneOffsetMinutes(new Date(utcGuess), timezone);
  return new Date(utcGuess - offsetMinutes * 60_000).toISOString().replace(".000Z", "Z");
}

function timeZoneOffsetMinutes(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function endOfIsoWeek(localDate) {
  const date = new Date(`${localDate}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + (7 - day));
  return formatDateOnly(date);
}

function addDays(localDate, days) {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function dateDiffDays(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function minDate(a, b) {
  return a < b ? a : b;
}

function maxDate(a, b) {
  return a > b ? a : b;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli()
    .then((files) => {
      for (const file of files) {
        console.log(`wrote ${file.path}`);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
