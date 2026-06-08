import { D1Store } from "./db/d1-store";
import { clearCookieHeader, createSessionCookie, hashPassword, parseCookies, resolveLoginPasswordHash, verifyPassword, verifySessionCookie, type SessionRole } from "./auth/session";
import { httpError, jsonResponse, noContent, readJson } from "./http";
import { ChecklistService } from "./services/checklist-service";
import { EventService } from "./services/event-service";
import { createFullExportZip } from "./services/export-service";
import { buildMachineDaysPayload, buildMachineEventsPayload, buildMachinePayload, InvalidMachineTokenError, requireValidMachineToken } from "./services/machine-service";
import { MilestoneService } from "./services/milestone-service";
import { createReadQuickEvent } from "./services/read-event-service";
import { buildReadOnlySummaryPayload } from "./services/read-summary-service";
import { buildGrowthCurvePayload } from "./services/growth-reference-service";
import { buildTodaySummary } from "./services/summary-service";
import { getStableChildFacts, updateStableChildFacts } from "./services/stable-child-facts-service";
import { buildPediatricSummary, buildStatusDay, buildStatusOverview, buildStatusRangeAnalytics, buildStatusTimeline, buildStatusTrends, buildTodayReferenceTargets } from "./services/status-service";
import { normalizeLanguage } from "../shared/i18n";
import type { Actor, Store } from "./types";
import { isValidDateOnly, localDateForTimezone } from "./utils/time";

export async function handleApiRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const store = new D1Store(env.DB);
  const nowIso = new Date().toISOString().replace(".000Z", "Z");

  if (url.pathname === "/api/session/admin/login" && request.method === "POST") {
    return login(request, env, store, "admin", nowIso);
  }
  if (url.pathname === "/api/session/read/login" && request.method === "POST") {
    return login(request, env, store, "read", nowIso);
  }
  if (url.pathname === "/api/session/logout" && request.method === "POST") {
    return noContent([
      ["Set-Cookie", clearCookieHeader("yb_admin_session")],
      ["Set-Cookie", clearCookieHeader("yb_read_session")]
    ]);
  }

  const machineCurrentMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/current\.json$/);
  if (machineCurrentMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "current", machineCurrentMatch[1], url.searchParams, request.method, nowIso);
  }
  const machineCurrentHtmlMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/current\.html$/);
  if (machineCurrentHtmlMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "current-html", machineCurrentHtmlMatch[1], url.searchParams, request.method, nowIso);
  }
  const machineCurrentTextMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/current\.txt$/);
  if (machineCurrentTextMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "current-text", machineCurrentTextMatch[1], url.searchParams, request.method, nowIso);
  }
  const machineTestMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/test$/);
  if (machineTestMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "test", machineTestMatch[1], url.searchParams, request.method, nowIso);
  }
  const machineDaysMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/days\.json$/);
  if (machineDaysMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "days", machineDaysMatch[1], url.searchParams, request.method, nowIso);
  }
  const machineDaysHtmlMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/days\.html$/);
  if (machineDaysHtmlMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "days-html", machineDaysHtmlMatch[1], url.searchParams, request.method, nowIso);
  }
  const machineEventsMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/events\.json$/);
  if (machineEventsMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "events", machineEventsMatch[1], url.searchParams, request.method, nowIso);
  }
  const machineEventsHtmlMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\/events\.html$/);
  if (machineEventsHtmlMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "events-html", machineEventsHtmlMatch[1], url.searchParams, request.method, nowIso);
  }
  const legacyMachineMatch = url.pathname.match(/^\/machine\/v1\/([^/]+)\.json$/);
  if (legacyMachineMatch && (request.method === "GET" || request.method === "HEAD")) {
    return createMachineEndpointResponse(store, "legacy", legacyMachineMatch[1], url.searchParams, request.method, nowIso);
  }

  if (!url.pathname.startsWith("/api/")) return null;

  if (url.pathname === "/api/bootstrap" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const profile = await store.getProfile();
    const checklistSections = await new ChecklistService(store).listSections(nowIso);
    const todayEvents = await store.listEventsByLocalDate(localDateForTimezone(nowIso, profile.timezone));
    return jsonResponse({
      profile,
      stable_child_facts: await getStableChildFacts(store),
      growth_curve: await buildGrowthCurvePayload(store, nowIso),
      today_summary: await buildTodaySummary(store, nowIso),
      reference_targets: await buildTodayReferenceTargets(store, nowIso),
      recent_events: await store.listEvents({ days: 7, limit: recentEventsLimit(todayEvents.length) }),
      open_checklists: checklistSections.current.slice(0, 10),
      seed_milestones: new MilestoneService(store).listSeedItems()
    });
  }

  if (url.pathname === "/api/profile" && request.method === "PATCH") {
    await requireRole(request, env, store, "admin", nowIso);
    const body = await readJson<Record<string, unknown>>(request);
    const profile = await store.updateProfile(
      {
        family_label: nullableString(body.family_label),
        child_name: nullableString(body.child_name),
        child_birth_date: nullableDate(body.child_birth_date),
        due_date: nullableDate(body.due_date),
        timezone: timezoneOr(body.timezone, "Asia/Shanghai"),
        read_only_title: stringOr(body.read_only_title, "Baby Status")
      },
      nowIso
    );
    return jsonResponse(profile);
  }

  if (url.pathname === "/api/stable-child-facts" && request.method === "PATCH") {
    await requireRole(request, env, store, "admin", nowIso);
    return jsonResponse(await updateStableChildFacts(store, await readJson<Record<string, unknown>>(request), nowIso));
  }

  if (url.pathname === "/api/settings/passwords" && request.method === "POST") {
    await requireRole(request, env, store, "admin", nowIso);
    const body = await readJson<{ admin_password?: string; read_password?: string }>(request);
    if (body.admin_password) await store.setMeta("admin_password_hash", await hashPassword(body.admin_password), nowIso);
    if (body.read_password) await store.setMeta("read_password_hash", await hashPassword(body.read_password), nowIso);
    return noContent();
  }

  if (url.pathname === "/api/machine-token/rotate" && request.method === "POST") {
    await requireRole(request, env, store, "admin", nowIso);
    const token = crypto.randomUUID().replace(/-/g, "");
    return jsonResponse(await store.updateProfile({ machine_token: token }, nowIso));
  }

  if (url.pathname === "/api/events" && request.method === "POST") {
    await requireRole(request, env, store, "admin", nowIso);
    const body = await readJson<Record<string, unknown>>(request);
    const actor = body.created_by === "mom" ? "mom" : "dad";
    const event = await new EventService(store).create(body as never, actor, nowIso);
    return jsonResponse(event, { status: 201 });
  }

  if (url.pathname === "/api/events" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const days = clampNumber(Number(url.searchParams.get("days") ?? 7), 1, 30);
    const eventType = url.searchParams.get("event_type") ?? undefined;
    return jsonResponse({ items: await new EventService(store).list(days, eventType) });
  }

  const eventMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (eventMatch && request.method === "PATCH") {
    await requireRole(request, env, store, "admin", nowIso);
    const event = await new EventService(store).update(eventMatch[1], await readJson(request), nowIso);
    return jsonResponse(event);
  }
  if (eventMatch && request.method === "DELETE") {
    await requireRole(request, env, store, "admin", nowIso);
    await new EventService(store).delete(eventMatch[1], nowIso);
    return noContent();
  }

  if (url.pathname === "/api/today" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    return jsonResponse(await buildTodaySummary(store, nowIso));
  }

  if (url.pathname === "/api/status/overview" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const days = clampNumber(Number(url.searchParams.get("days") ?? 7), 1, 30);
    return jsonResponse(await buildStatusOverview(store, nowIso, days));
  }

  if (url.pathname === "/api/status/day" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const rawPreset = url.searchParams.get("preset");
    const preset = rawPreset === "yesterday" ? "yesterday" : "today";
    return jsonResponse(await buildStatusDay(store, nowIso, preset));
  }

  if (url.pathname === "/api/status/timeline" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const days = clampNumber(Number(url.searchParams.get("days") ?? 7), 1, 30);
    const limit = clampNumber(Number(url.searchParams.get("limit") ?? 100), 10, 300);
    const eventType = url.searchParams.get("event_type") ?? undefined;
    const eventTypes = url.searchParams.get("event_types")?.split(",").filter(Boolean);
    return jsonResponse(
      await buildStatusTimeline(store, nowIso, {
        days,
        limit,
        event_type: eventType,
        event_types: eventTypes,
        preset: url.searchParams.get("preset"),
        start_date: url.searchParams.get("start_date"),
        end_date: url.searchParams.get("end_date")
      })
    );
  }

  if (url.pathname === "/api/status/range-analytics" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    return jsonResponse(
      await buildStatusRangeAnalytics(store, nowIso, {
        preset: url.searchParams.get("preset"),
        start_date: url.searchParams.get("start_date"),
        end_date: url.searchParams.get("end_date"),
        event_types: url.searchParams.get("event_types")?.split(",").filter(Boolean),
        compare: url.searchParams.get("compare")
      })
    );
  }

  if (url.pathname === "/api/status/trends" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const rawDays = Number(url.searchParams.get("days") ?? 7);
    const days = [3, 7, 14, 30].includes(rawDays) ? rawDays : 7;
    return jsonResponse(await buildStatusTrends(store, nowIso, days));
  }

  if (url.pathname === "/api/status/pediatric-summary" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const rawRange = url.searchParams.get("range");
    const range = rawRange === "24h" || rawRange === "3d" || rawRange === "7d" ? rawRange : "24h";
    return jsonResponse(
      await buildPediatricSummary(
        store,
        {
          range,
          preset: url.searchParams.get("preset"),
          start_date: url.searchParams.get("start_date"),
          end_date: url.searchParams.get("end_date"),
          event_types: url.searchParams.get("event_types")?.split(",").filter(Boolean)
        },
        nowIso
      )
    );
  }

  if (url.pathname === "/api/checklists" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    return jsonResponse({ items: await store.listChecklistItems({ status: url.searchParams.get("status") as never }) });
  }

  if (url.pathname === "/api/checklists/sections" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    return jsonResponse(await new ChecklistService(store).listSections(nowIso, languageFromRequest(url)));
  }

  if (url.pathname === "/api/checklist-templates" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    return jsonResponse({ templates: await new ChecklistService(store).listTemplates(nowIso, languageFromRequest(url)) });
  }

  if (url.pathname === "/api/checklists/import-template" && request.method === "POST") {
    await requireRole(request, env, store, "admin", nowIso);
    return jsonResponse(await new ChecklistService(store).importTemplate(await readJson(request), nowIso), { status: 201 });
  }

  if (url.pathname === "/api/checklists" && request.method === "POST") {
    await requireRole(request, env, store, "admin", nowIso);
    const item = await new ChecklistService(store).createCustom(await readJson(request), nowIso);
    return jsonResponse(item, { status: 201 });
  }

  const checklistMatch = url.pathname.match(/^\/api\/checklists\/([^/]+)$/);
  if (checklistMatch && request.method === "PATCH") {
    await requireRole(request, env, store, "admin", nowIso);
    const item = await new ChecklistService(store).update(checklistMatch[1], await readJson(request), nowIso);
    if (!item) throw httpError(404, "Checklist item not found");
    return jsonResponse(item);
  }

  if (url.pathname === "/api/milestones" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const service = new MilestoneService(store);
    return jsonResponse({ items: await store.listMilestones(), seed_items: service.listSeedItems() });
  }

  if (url.pathname === "/api/milestones" && request.method === "POST") {
    await requireRole(request, env, store, "admin", nowIso);
    const item = await new MilestoneService(store).create(await readJson(request), nowIso);
    return jsonResponse(item, { status: 201 });
  }

  if (url.pathname === "/api/read/summary" && request.method === "GET") {
    await requireRole(request, env, store, "read", nowIso);
    return jsonResponse(await buildReadOnlySummaryPayload(store, nowIso));
  }

  if (url.pathname === "/api/read/events" && request.method === "POST") {
    await requireRole(request, env, store, "read", nowIso);
    const event = await createReadQuickEvent(store, await readJson(request), nowIso);
    return jsonResponse(event, { status: 201 });
  }

  if (url.pathname === "/api/export/full" && request.method === "GET") {
    await requireRole(request, env, store, "admin", nowIso);
    const zip = await createFullExportZip(store, nowIso);
    const body = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "content-type": "application/zip",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="baby-log-export-${nowIso.slice(0, 10)}.zip"`
      }
    });
  }

  throw httpError(404, "Not found");
}

type MachineEndpointKind = "current" | "current-html" | "current-text" | "test" | "days" | "days-html" | "events" | "events-html" | "legacy";

export async function createMachineEndpointResponse(
  store: Store,
  kind: MachineEndpointKind,
  token: string,
  searchParams: URLSearchParams,
  method: "GET" | "HEAD",
  nowIso: string
): Promise<Response> {
  const headers = {
    "content-type":
      isMachineHtmlKind(kind) ? "text/html; charset=utf-8" : kind === "current-text" || kind === "test" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex"
  };
  if (kind === "legacy") {
    if (method === "HEAD") return new Response(null, { status: 404, headers });
    return jsonResponse({ error: "Machine current endpoint moved to /machine/v1/{token}/current.json" }, { status: 404, headers });
  }
  try {
    if (kind === "test") {
      await requireValidMachineToken(store, token);
      if (method === "HEAD") {
        return new Response(null, { headers });
      }
      return new Response(["baby-log-machine-test: ok", `generated_at: ${nowIso}`, "endpoint: /machine/v1/{token}/test"].join("\n"), { headers });
    }
    const payload =
      kind === "current"
        ? await buildMachinePayload(store, token, nowIso)
        : kind === "current-html"
        ? await buildMachinePayload(store, token, nowIso)
        : kind === "current-text"
        ? await buildMachinePayload(store, token, nowIso)
        : kind === "days" || kind === "days-html"
          ? await buildMachineDaysPayload(store, token, nowIso, {
              from: searchParams.get("from"),
              to: searchParams.get("to")
            })
          : await buildMachineEventsPayload(store, token, nowIso, {
              since: searchParams.get("since"),
              until: searchParams.get("until"),
              limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
              event_type: searchParams.get("event_type")
            });
    if (method === "HEAD") {
      return new Response(null, { headers });
    }
    if (kind === "current-html") {
      return new Response(buildMachineCurrentHtml(payload as Awaited<ReturnType<typeof buildMachinePayload>>), { headers });
    }
    if (kind === "days-html") {
      return new Response(buildMachineDaysHtml(payload as Awaited<ReturnType<typeof buildMachineDaysPayload>>), { headers });
    }
    if (kind === "events-html") {
      return new Response(buildMachineEventsHtml(payload as Awaited<ReturnType<typeof buildMachineEventsPayload>>), { headers });
    }
    return new Response(JSON.stringify(payload, null, 2), { headers });
  } catch (error) {
    if (error instanceof InvalidMachineTokenError) {
      throw httpError(401, "Invalid machine token");
    }
    if (typeof error === "object" && error !== null && "status" in error) {
      throw error;
    }
    throw httpError(500, "Machine endpoint failed");
  }
}

function isMachineHtmlKind(kind: MachineEndpointKind): boolean {
  return kind === "current-html" || kind === "days-html" || kind === "events-html";
}

function buildMachineCurrentHtml(payload: Awaited<ReturnType<typeof buildMachinePayload>>): string {
  const today = payload.today_summary;
  const rolling = payload.rolling_24h;
  const latest = payload.latest_global;
  const rows = (items: Array<[string, unknown]>) => items.map(([key, value]) => `      <dt>${escapeHtml(key)}</dt>\n      <dd>${escapeHtml(formatMachineHtmlValue(value))}</dd>`).join("\n");
  const list = (items: string[]) => items.map((item) => `      <li>${escapeHtml(item)}</li>`).join("\n");
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8">',
    "    <title>Baby Log Machine Current</title>",
    '    <meta name="robots" content="noindex">',
    "  </head>",
    "  <body>",
    "    <h1>baby-log-current: ok</h1>",
    "    <section>",
    "      <h2>manifest</h2>",
    "      <dl>",
    rows([
      ["machine_payload_version", payload.machine_payload_version],
      ["generated_at", payload.generated_at],
      ["timezone", payload.timezone],
      ["child_name", payload.profile.child_name],
      ["local_date", payload.today_so_far.local_date],
      ["age_days", payload.age_context.age_days],
      ["birth_day_number", payload.age_context.birth_day_number]
    ]),
    "      </dl>",
    "    </section>",
    "    <section>",
    "      <h2>data_range</h2>",
    "      <dl>",
    rows([
      ["first_event_at", payload.data_range.first_event_at],
      ["latest_event_at", payload.data_range.latest_event_at],
      ["event_count", payload.data_range.event_count],
      ["available_from_local_date", payload.data_range.available_from_local_date],
      ["available_to_local_date", payload.data_range.available_to_local_date]
    ]),
    "      </dl>",
    "    </section>",
    "    <section>",
    "      <h2>capabilities</h2>",
    "      <dl>",
    rows(Object.entries(payload.capabilities)),
    "      </dl>",
    "    </section>",
    "    <section>",
    "      <h2>links</h2>",
    "      <dl>",
    rows(Object.entries(payload.links)),
    "      </dl>",
    "    </section>",
    "    <section>",
    "      <h2>today</h2>",
    "      <dl>",
    rows([
      ["bottle_count", today.feed_bottle_count],
      ["bottle_ml_total", today.bottle_ml_total],
      ["breast_count", today.feed_breast_count],
      ["breast_minutes_total", today.breast_minutes_total],
      ["pee_count", today.pee_count],
      ["poop_count", today.poop_count],
      ["sleep_minutes_total", today.sleep_minutes_total],
      ["temperature_latest_c", today.latest_temperature_c],
      ["growth_latest_weight_g", today.growth.latest_weight_g]
    ]),
    "      </dl>",
    "    </section>",
    "    <section>",
    "      <h2>rolling_24h</h2>",
    "      <dl>",
    rows([
      ["range_start_utc", rolling.range.start_utc],
      ["range_end_utc", rolling.range.end_utc],
      ["bottle_ml_total", rolling.feeding.bottle_ml_total],
      ["feeding_total_count", rolling.feeding.total_count],
      ["pee_count", rolling.diaper.pee_count],
      ["poop_count", rolling.diaper.poop_count],
      ["sleep_minutes_total", rolling.sleep.minutes_total],
      ["temperature_max_c", rolling.temperature.max_c]
    ]),
    "      </dl>",
    "    </section>",
    "    <section>",
    "      <h2>latest_global</h2>",
    "      <dl>",
    rows([
      ["feeding_at", latest.feeding?.occurred_at ?? null],
      ["feeding_amount", latest.feeding?.amount_value ?? null],
      ["pee_at", latest.pee?.occurred_at ?? null],
      ["poop_at", latest.poop?.occurred_at ?? null],
      ["temperature_at", latest.temperature.occurred_at],
      ["temperature_c", latest.temperature.value_c],
      ["weight_at", latest.weight.occurred_at],
      ["weight_value", latest.weight.value]
    ]),
    "      </dl>",
    "    </section>",
    "    <section>",
    "      <h2>open_sessions</h2>",
    "      <ul>",
    list(payload.open_sessions.flatMap((session) => (session ? [`${session.event_type} ${session.occurred_at}`] : []))),
    "      </ul>",
    "    </section>",
    "    <section>",
    "      <h2>data_quality</h2>",
    "      <ul>",
    list(payload.data_quality.map((flag) => `${flag.code}: ${flag.message}`)),
    "      </ul>",
    "    </section>",
    "    <section>",
    "      <h2>mechanical_flags</h2>",
    "      <ul>",
    list(payload.mechanical_flags.map((flag) => `${flag.code}: ${flag.message}`)),
    "      </ul>",
    "    </section>",
    "    <section>",
    "      <h2>complete_current_payload</h2>",
    '      <pre id="current-payload-json">',
    escapeHtml(JSON.stringify(payload, null, 2)),
    "      </pre>",
    "    </section>",
    "  </body>",
    "</html>"
  ];
  return `${html.join("\n")}\n`;
}

function buildMachineDaysHtml(payload: Awaited<ReturnType<typeof buildMachineDaysPayload>>): string {
  return buildMachinePayloadHtml(
    "baby-log-days",
    "days-payload-json",
    "Baby Log Machine Days",
    [
      [
        "range",
        [
          ["from", payload.range.from],
          ["to", payload.range.to],
          ["day_count", payload.range.day_count],
          ["timezone", payload.timezone],
          ["generated_at", payload.generated_at],
          ["machine_payload_version", payload.machine_payload_version]
        ]
      ],
      [
        "summary",
        [
          ["child_name", payload.profile.child_name],
          ["days_count", payload.days.length],
          ["series_dates", payload.series.local_dates.join(", ")],
          ["events_for_range", payload.links.events_for_range]
        ]
      ]
    ],
    payload
  );
}

function buildMachineEventsHtml(payload: Awaited<ReturnType<typeof buildMachineEventsPayload>>): string {
  return buildMachinePayloadHtml(
    "baby-log-events",
    "events-payload-json",
    "Baby Log Machine Events",
    [
      [
        "range",
        [
          ["since", payload.range.since],
          ["until", payload.range.until],
          ["timezone", payload.timezone],
          ["generated_at", payload.generated_at],
          ["machine_payload_version", payload.machine_payload_version]
        ]
      ],
      [
        "filters",
        [
          ["event_type", payload.filters.event_type],
          ["limit", payload.filters.limit],
          ["returned_event_count", payload.events.length],
          ["has_more", payload.pagination.has_more],
          ["next_cursor", payload.pagination.next_cursor]
        ]
      ],
      [
        "links",
        [
          ["current", payload.links.current],
          ["days_for_range", payload.links.days_for_range]
        ]
      ]
    ],
    payload
  );
}

function buildMachinePayloadHtml(title: string, preId: string, documentTitle: string, sections: Array<[string, Array<[string, unknown]>]>, payload: unknown): string {
  const html = [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "  <head>",
    '    <meta charset="utf-8">',
    `    <title>${escapeHtml(documentTitle)}</title>`,
    '    <meta name="robots" content="noindex">',
    "  </head>",
    "  <body>",
    `    <h1>${escapeHtml(title)}: ok</h1>`,
    ...sections.flatMap(([sectionTitle, items]) => ["    <section>", `      <h2>${escapeHtml(sectionTitle)}</h2>`, "      <dl>", htmlRows(items), "      </dl>", "    </section>"]),
    "    <section>",
    "      <h2>complete_payload</h2>",
    `      <pre id="${escapeHtml(preId)}">`,
    escapeHtml(JSON.stringify(payload, null, 2)),
    "      </pre>",
    "    </section>",
    "  </body>",
    "</html>"
  ];
  return `${html.join("\n")}\n`;
}

function htmlRows(items: Array<[string, unknown]>): string {
  return items.map(([key, value]) => `      <dt>${escapeHtml(key)}</dt>\n      <dd>${escapeHtml(formatMachineHtmlValue(value))}</dd>`).join("\n");
}

function formatMachineHtmlValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function languageFromRequest(url: URL) {
  return normalizeLanguage(url.searchParams.get("lang"), "zh");
}

async function login(request: Request, env: Env, store: Store, role: SessionRole, nowIso: string) {
  const { password } = await readJson<{ password?: string }>(request);
  if (!password) throw httpError(401, "Invalid password");
  const configuredHash = await getPasswordHash(env, store, role, nowIso);
  if (!(await verifyPassword(password, configuredHash))) {
    throw httpError(401, "Invalid password");
  }
  const cookie = await createSessionCookie(role, await getSessionSecret(env, store, nowIso), nowIso);
  return noContent({ "Set-Cookie": cookie.header });
}

async function requireRole(request: Request, env: Env, store: Store, role: SessionRole, nowIso: string) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const name = role === "admin" ? "yb_admin_session" : "yb_read_session";
  const valid = await verifySessionCookie(cookies[name], role, await getSessionSecret(env, store, nowIso), nowIso);
  if (!valid) throw httpError(401, "Unauthorized");
}

async function getSessionSecret(env: Env, store: Store, nowIso: string): Promise<string> {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const existing = await store.getMeta("session_secret");
  if (existing) return existing;
  if (isReadOnlyRemoteD1Probe(env)) throw httpError(500, "Session secret is not configured for read-only verification");
  const generated = crypto.randomUUID();
  await store.setMeta("session_secret", generated, nowIso);
  return generated;
}

async function getPasswordHash(env: Env, store: Store, role: SessionRole, nowIso: string): Promise<string> {
  const key = `${role}_password_hash`;
  const existing = await store.getMeta(key);
  const configuredPassword = role === "admin" ? env.ADMIN_PASSWORD : env.READ_PASSWORD;
  const hashed = await resolveLoginPasswordHash(role, existing, configuredPassword, env.ALLOW_DEV_DEFAULT_PASSWORDS === "true");
  if (configuredPassword && hashed !== existing && !isReadOnlyRemoteD1Probe(env)) {
    await store.setMeta(key, hashed, nowIso);
  }
  return hashed;
}

function isReadOnlyRemoteD1Probe(env: Env): boolean {
  return env.READ_ONLY_REMOTE_D1_PROBE === "true";
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  return String(value).trim();
}

export function nullableDate(value: unknown): string | null | undefined {
  const text = nullableString(value);
  if (!text) return text;
  if (!isValidDateOnly(text)) throw httpError(400, "Date must be YYYY-MM-DD");
  return text;
}

function stringOr(value: unknown, fallback: string): string | undefined {
  if (value === undefined) return undefined;
  const text = String(value).trim();
  return text || fallback;
}

export function timezoneOr(value: unknown, fallback: string): string | undefined {
  if (value === undefined) return undefined;
  const timezone = String(value).trim() || fallback;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date("2026-01-01T00:00:00Z"));
  } catch {
    throw httpError(400, "Invalid timezone");
  }
  return timezone;
}

export function recentEventsLimit(todayEventCount: number): number {
  return Math.max(10, todayEventCount);
}
