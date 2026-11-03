export type ScheduleKind = "timer" | "interval" | "daily";
export interface Schedule {
  id: string;
  name: string;
  kind: ScheduleKind;
  enabled: boolean;
  timeZone: string;
  updatedAt: string;
  noteId?: string;
  todoId?: string;
  nextAt?: number;
  lastFiredAt?: number;
  durationSeconds?: number;
  remainingMs?: number;
  intervalMinutes?: number;
  startTime?: string;
  endTime?: string;
  times?: string[];
  weekdays?: number[];
}
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function validateSchedule(value: unknown): Schedule {
  const s = value as Schedule;
  const bad = () => {
    throw Error("通知設定の形式を確認してください。");
  };
  if (
    !s ||
    typeof s !== "object" ||
    typeof s.id !== "string" ||
    !s.id ||
    s.id.length > 200 ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 200 ||
    !["timer", "interval", "daily"].includes(s.kind) ||
    typeof s.enabled !== "boolean" ||
    typeof s.timeZone !== "string" ||
    typeof s.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(s.updatedAt))
  )
    bad();
  try {
    new Intl.DateTimeFormat("en", { timeZone: s.timeZone }).format();
  } catch {
    bad();
  }
  for (const key of ["noteId", "todoId"] as const)
    if (
      s[key] !== undefined &&
      (typeof s[key] !== "string" || !s[key] || s[key]!.length > 200)
    )
      bad();
  if (s.todoId && !s.noteId) bad();
  for (const v of [s.nextAt, s.lastFiredAt])
    if (
      v !== undefined &&
      (!Number.isFinite(v) || v < 0 || v > 8640000000000000)
    )
      bad();
  if (s.enabled && s.nextAt === undefined) bad();
  if (!s.enabled && s.nextAt !== undefined) bad();
  if (
    s.nextAt !== undefined &&
    s.lastFiredAt !== undefined &&
    s.nextAt <= s.lastFiredAt
  )
    bad();
  if (s.kind === "timer") {
    if (
      !Number.isInteger(s.durationSeconds) ||
      s.durationSeconds! < 1 ||
      s.durationSeconds! > 86399
    )
      bad();
    if (
      s.remainingMs !== undefined &&
      (!Number.isFinite(s.remainingMs) ||
        s.remainingMs < 0 ||
        s.remainingMs > 86399000)
    )
      bad();
  }
  if (s.kind === "interval") {
    if (
      !Number.isInteger(s.intervalMinutes) ||
      s.intervalMinutes! < 1 ||
      s.intervalMinutes! > 1440 ||
      !timePattern.test(s.startTime || "") ||
      !timePattern.test(s.endTime || "") ||
      s.startTime === s.endTime
    )
      bad();
  }
  if (s.kind === "daily") {
    if (
      !Array.isArray(s.times) ||
      !s.times.length ||
      s.times.length > 24 ||
      !s.times.every((t) => typeof t === "string" && timePattern.test(t)) ||
      new Set(s.times).size !== s.times.length ||
      !Array.isArray(s.weekdays) ||
      !s.weekdays.length ||
      !s.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ||
      new Set(s.weekdays).size !== s.weekdays.length
    )
      bad();
  }
  // Explicit fields only: never trust extra imported properties.
  return {
    id: s.id,
    name: s.name.trim(),
    kind: s.kind,
    enabled: s.enabled,
    timeZone: s.timeZone,
    updatedAt: s.updatedAt,
    noteId: s.noteId,
    todoId: s.todoId,
    nextAt: s.nextAt,
    lastFiredAt: s.lastFiredAt,
    ...(s.kind === "timer"
      ? { durationSeconds: s.durationSeconds, remainingMs: s.remainingMs }
      : s.kind === "interval"
        ? {
            intervalMinutes: s.intervalMinutes,
            startTime: s.startTime,
            endTime: s.endTime,
          }
        : { times: s.times, weekdays: s.weekdays }),
  };
}
const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(at: number, zone: string) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    if (formatters.size > 32) formatters.clear();
    formatters.set(zone, f);
  }
  const p = Object.fromEntries(
    f.formatToParts(at).map((v) => [v.type, v.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}
function civilInstant(
  y: number,
  m: number,
  d: number,
  time: string,
  zone: string,
) {
  const [h, min] = time.split(":").map(Number),
    target = Date.UTC(y, m - 1, d, h, min);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = parts(guess, zone),
      delta = target - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    if (!delta) break;
    guess += delta;
  }
  const matches = (at: number) => {
    const p = parts(at, zone);
    return p.y === y && p.m === m && p.d === d && p.h === h && p.min === min;
  };
  // A nonexistent spring-forward time is skipped. A repeated fall-back time fires once, at the first occurrence.
  const candidates = [
    guess - 7200000,
    guess - 3600000,
    guess - 1800000,
    guess,
    guess + 1800000,
    guess + 3600000,
    guess + 7200000,
  ].filter(matches);
  return candidates.length ? Math.min(...candidates) : undefined;
}
export function nextOccurrence(s: Schedule, after: number): number | undefined {
  if (s.kind === "timer") return undefined;
  const p = parts(after, s.timeZone);
  let best = Infinity;
  for (let day = -1; day <= 8; day++) {
    const date = new Date(Date.UTC(p.y, p.m - 1, p.d + day)),
      y = date.getUTCFullYear(),
      m = date.getUTCMonth() + 1,
      d = date.getUTCDate();
    if (s.kind === "daily") {
      if (!s.weekdays!.includes(date.getUTCDay())) continue;
      for (const time of s.times!) {
        const at = civilInstant(y, m, d, time, s.timeZone);
        if (at !== undefined && at > after) best = Math.min(best, at);
      }
    } else {
      const start = civilInstant(y, m, d, s.startTime!, s.timeZone);
      const endDate = new Date(
        Date.UTC(y, m - 1, d + (s.endTime! <= s.startTime! ? 1 : 0)),
      );
      const end = civilInstant(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth() + 1,
        endDate.getUTCDate(),
        s.endTime!,
        s.timeZone,
      );
      if (start === undefined || end === undefined) continue;
      const step = s.intervalMinutes! * 60000;
      const at =
        start + Math.max(0, Math.floor((after - start) / step) + 1) * step;
      if (at <= end && at > after) best = Math.min(best, at);
    }
  }
  return Number.isFinite(best) ? best : undefined;
}
export function startSchedule(s: Schedule, now = Date.now()): Schedule {
  const nextAt =
    s.kind === "timer"
      ? now + (s.remainingMs ?? s.durationSeconds! * 1000)
      : nextOccurrence(s, now);
  if (nextAt === undefined) throw Error("次の通知日時を計算できません。");
  return validateSchedule({
    ...s,
    enabled: true,
    nextAt,
    remainingMs: undefined,
    updatedAt: new Date(now).toISOString(),
  });
}
export function pauseSchedule(s: Schedule, now = Date.now()): Schedule {
  return {
    ...s,
    enabled: false,
    nextAt: undefined,
    remainingMs:
      s.kind === "timer" && s.nextAt !== undefined
        ? Math.max(0, s.nextAt - now)
        : s.remainingMs,
    updatedAt: new Date(now).toISOString(),
  };
}
export function remainingLabel(s: Schedule, now: number) {
  const seconds = Math.max(
    0,
    Math.ceil(
      (s.enabled ? (s.nextAt ?? now) - now : (s.remainingMs ?? 0)) / 1000,
    ),
  );
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
