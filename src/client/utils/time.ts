import type { AppProfile } from "../types";
import { getCurrentLanguage, localizedText } from "../i18n";

export function nowIso(): string {
  return new Date().toISOString().replace(".000Z", "Z");
}

export function localDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function todayDateInputValueInTimezone(timezone: string): string {
  return localDateInTimezone(new Date(), timezone);
}

export function localInputValueInTimezone(iso: string | undefined, timezone: string): string {
  const date = iso ? new Date(iso) : new Date();
  const parts = localParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toIsoFromLocalInputInTimezone(value: string, timezone: string): string {
  const parts = parseDateTimeLocal(value);
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  let guess = target;
  for (let index = 0; index < 4; index += 1) {
    const representedParts = localParts(new Date(guess), timezone);
    const represented = Date.UTC(
      Number(representedParts.year),
      Number(representedParts.month) - 1,
      Number(representedParts.day),
      Number(representedParts.hour),
      Number(representedParts.minute),
      0
    );
    guess += target - represented;
  }
  return new Date(guess).toISOString().replace(".000Z", "Z");
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat(locale(), {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

export function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale(), {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function formatRelativeTime(iso: string | null | undefined, timezone: string, now = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  const minutes = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 60000));
  if (minutes < 1) return localizedText({ en: "just now", zh: "刚刚" });
  if (minutes < 60) return localizedText({ en: "{minutes} min ago", zh: "{minutes} 分钟前" }, { minutes });
  if (minutes < 6 * 60) return localizedText({ en: "{hours} hr ago", zh: "{hours} 小时前" }, { hours: Math.floor(minutes / 60) });
  const today = localDateInTimezone(now, timezone);
  const date = localDateInTimezone(then, timezone);
  if (date === today) return localizedText({ en: "Today {time}", zh: "今天 {time}" }, { time: formatTime(iso, timezone) });
  if (date === addDateDays(today, -1)) return localizedText({ en: "Yesterday {time}", zh: "昨天 {time}" }, { time: formatTime(iso, timezone) });
  return `${date} ${formatTime(iso, timezone)}`;
}

export function minutesSince(iso: string): number {
  const elapsed = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(elapsed / 60000));
}

export function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return localizedText({ en: "{minutes} min", zh: "{minutes} 分钟" }, { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? localizedText({ en: "{hours} hr {minutes} min", zh: "{hours} 小时 {minutes} 分钟" }, { hours, minutes: rest })
    : localizedText({ en: "{hours} hr", zh: "{hours} 小时" }, { hours });
}

export function formatElapsedTime(minutes: number): string {
  if (minutes < 60) return localizedText({ en: "{minutes} min", zh: "{minutes} 分钟" }, { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? localizedText({ en: "{hours} hr {minutes} min", zh: "{hours} 小时 {minutes} 分钟" }, { hours, minutes: rest })
    : localizedText({ en: "{hours} hr", zh: "{hours} 小时" }, { hours });
}

export function stageText(profile: Pick<AppProfile, "phase" | "due_date" | "child_birth_date" | "timezone">): string {
  const today = localDateInTimezone(new Date(), profile.timezone);
  if (profile.phase === "pregnancy_prebirth" || !profile.child_birth_date) {
    if (!profile.due_date) return localizedText({ en: "Before birth · due date not set", zh: "出生前 · 未设置预产期" });
    const days = diffLocalDates(today, profile.due_date);
    if (days >= 0) return localizedText({ en: "Before birth · {days} days to due date", zh: "出生前 · 距预产期 {days} 天" }, { days });
    return localizedText({ en: "Before birth · {days} days past due date", zh: "出生前 · 预产期已过 {days} 天" }, { days: Math.abs(days) });
  }

  const ageDays = Math.max(1, diffLocalDates(profile.child_birth_date, today) + 1);
  const monthAge = Math.max(0, fullMonthDiff(profile.child_birth_date, today));
  return localizedText({ en: "Day {days} / {months} months old", zh: "出生第 {days} 天 / {months} 月龄" }, { days: ageDays, months: monthAge });
}

function locale(): string {
  return getCurrentLanguage() === "zh" ? "zh-CN" : "en-US";
}

function diffLocalDates(fromDate: string, toDate: string): number {
  return Math.round((dateOnlyUtc(toDate) - dateOnlyUtc(fromDate)) / 86400000);
}

function addDateDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateOnlyUtc(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function parseDateTimeLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("datetime-local value must be YYYY-MM-DDTHH:mm");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5])
  };
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute")
  };
}

function fullMonthDiff(fromDate: string, toDate: string): number {
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  let months = (toYear - fromYear) * 12 + (toMonth - fromMonth);
  if (toDay < fromDay) months -= 1;
  return months;
}
