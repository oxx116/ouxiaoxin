import { createServerFn } from "@tanstack/react-start";
import { requireActive } from "@/lib/access";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { scanPatterns } from "@/lib/three-read";
import { refreshCandleCache, type YahooCandle } from "@/lib/yahoo";

export type PatternMark = {
  id: number;
  name: string;
  kind: "止跌" | "见顶";
  signalOn: string;
  score: number;
  grade: string;
  explain: string;
  placeNote: string;
  status: "live" | "broken";
  brokenOn: string;
  updatedAt: string;
};

function etDay(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function etClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    weekday: part("weekday"),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

function atEt(year: number, month: number, day: number) {
  const daylight = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
  const seen = etClock(daylight);
  if (seen.hour === 17 && seen.day.endsWith(String(day).padStart(2, "0"))) return daylight;
  return new Date(Date.UTC(year, month - 1, day, 22, 0, 0));
}

function previousDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** The 17:00 ET print this module should already be using. */
export function techInstant(now = new Date()) {
  const clock = etClock(now);
  const [year, month, day] = clock.day.split("-").map(Number);
  let cursor = { year, month, day };
  if (clock.hour < 17 || clock.weekday === "Sat" || clock.weekday === "Sun") {
    cursor = previousDay(year, month, day);
  }
  for (let i = 0; i < 4; i += 1) {
    const instant = atEt(cursor.year, cursor.month, cursor.day);
    const weekday = etClock(instant).weekday;
    if (weekday !== "Sat" && weekday !== "Sun") return instant;
    cursor = previousDay(cursor.year, cursor.month, cursor.day);
  }
  return atEt(cursor.year, cursor.month, cursor.day);
}

export function settledBars(bars: YahooCandle[], now = new Date()) {
  const clock = etClock(now);
  const sessionOpen = clock.weekday !== "Sat" && clock.weekday !== "Sun" && clock.hour < 17;
  if (!sessionOpen) return bars;
  return bars.filter((bar) => etDay(bar.t) < clock.day);
}

function num(value: unknown) {
  if (value == null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export const syncPatternMarks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { ticker?: unknown; bars?: unknown };
    const ticker = String(raw.ticker ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9.]{1,16}$/.test(ticker)) throw new Error("无效代码");
    const bars = Array.isArray(raw.bars) ? (raw.bars as YahooCandle[]) : [];
    const clean = bars
      .map((bar) => ({
        t: Number(bar.t),
        o: Number(bar.o),
        h: Number(bar.h),
        l: Number(bar.l),
        c: Number(bar.c),
        v: Number(bar.v) || 0,
      }))
      .filter((bar) => [bar.t, bar.o, bar.h, bar.l, bar.c].every(Number.isFinite));
    return { ticker, bars: clean };
  })
  .handler(async ({ data, context }): Promise<PatternMark[]> => {
    await requireActive(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    return persistMarks(sql, data.ticker, settledBars(data.bars));
  });

function dataBars(bars: YahooCandle[], signalMs: number) {
  return bars.filter((bar) => bar.t > signalMs);
}

function breaks(bar: YahooCandle, how: string, above: number | null, below: number | null) {
  if (how === "strict") {
    if (above != null && bar.h > above) return true;
    if (below != null && bar.l < below) return true;
    return false;
  }
  if (how === "touch") {
    if (above != null && bar.h >= above) return true;
    if (below != null && bar.l <= below) return true;
    return false;
  }
  if (how === "close-below") return below != null && bar.c < below;
  if (above != null && bar.c >= bar.o && bar.h > above) return true;
  if (below != null && bar.c < bar.o && bar.l < below) return true;
  return false;
}

function invertedBreak(later: YahooCandle[], above: number | null, below: number | null) {
  let confirmedAt = -1;
  for (let index = 0; index < later.length; index += 1) {
    const bar = later[index];
    if (confirmedAt < 0) {
      if (above != null && bar.c > above) confirmedAt = index;
      continue;
    }
    if (index - confirmedAt > 5) return undefined;
    if (below != null && bar.c < below) return bar;
  }
  return undefined;
}

async function persistMarks(sql: Sql, ticker: string, bars: YahooCandle[]): Promise<PatternMark[]> {
    await sql`
      create table if not exists pattern_marks (
        id bigserial primary key,
        ticker text not null,
        name text not null,
        kind text not null,
        signal_on text not null,
        signal_ms double precision not null,
        score int not null,
        grade text not null,
        explain text not null,
        break_above double precision,
        break_below double precision,
        break_how text not null default 'color',
        place_note text not null default '',
        status text not null default 'live',
        broken_on text not null default '',
        updated_at timestamptz not null default now(),
        unique (ticker, name, signal_on)
      )
    `;
    await sql`alter table pattern_marks add column if not exists break_how text not null default 'color'`;
    await sql`alter table pattern_marks add column if not exists place_note text not null default ''`;
    await sql`delete from pattern_marks where signal_on < '2026-11-01' or name like '%抱线%' or name like '%孕线%' or name like '%启明星%' or name like '%黄昏%' or name like '%倒锤子%'`;
    const seeds = scanPatterns(bars);
    for (const seed of seeds) {
      const misplaced = /抱线|孕线/.test(seed.name) && Boolean(seed.placeNote);
      if (misplaced && Date.now() - seed.signalMs > 96 * 60 * 60 * 1000) continue;
      const signalOn = etDay(seed.signalMs);
      await sql`
        insert into pattern_marks (
          ticker, name, kind, signal_on, signal_ms, score, grade, explain, break_above, break_below, break_how, place_note, updated_at
        )
        values (
          ${ticker},
          ${seed.name},
          ${seed.kind},
          ${signalOn},
          ${seed.signalMs},
          ${seed.score},
          ${seed.grade},
          ${seed.explain},
          ${seed.breakAbove},
          ${seed.breakBelow},
          ${seed.breakHow},
          ${seed.placeNote},
          to_timestamp(${seed.signalMs / 1000})
        )
        on conflict (ticker, name, signal_on) do nothing
      `;
    }
    await sql`
      update pattern_marks
      set status = 'live', broken_on = '', updated_at = to_timestamp(signal_ms / 1000)
      where ticker = ${ticker} and status = 'broken'
    `;
    const open = await sql<{
      id: number;
      signal_ms: number;
      break_above: number | null;
      break_below: number | null;
      break_how: string | null;
      status: string;
    }>`
      select id, signal_ms, break_above, break_below, break_how, status
      from pattern_marks
      where ticker = ${ticker} and status = 'live'
    `;
    for (const row of open) {
      const above = num(row.break_above);
      const below = num(row.break_below);
      const how = row.break_how || "color";
      const signalMs = Number(row.signal_ms);
      const later = dataBars(bars, signalMs);
      const hit =
        how === "invert"
          ? invertedBreak(later, above, below)
          : later.find((bar) => breaks(bar, how, above, below));
      if (!hit) continue;
      await sql`
        update pattern_marks
        set status = 'broken',
            broken_on = ${etDay(hit.t)},
            updated_at = to_timestamp(${hit.t / 1000})
        where id = ${row.id} and status = 'live'
      `;
    }
    await sql`
      delete from pattern_marks
      where (name like '%抱线%' or name like '%孕线%')
        and place_note <> ''
        and signal_ms < ${Date.now() - 96 * 60 * 60 * 1000}
    `;
    const rows = await sql<{
      id: number;
      name: string;
      kind: string;
      signal_on: string;
      score: number;
      grade: string;
      explain: string;
      place_note: string;
      status: string;
      broken_on: string;
      updated_at: string;
    }>`
      select id, name, kind, signal_on, score, grade, explain, place_note, status, broken_on,
             to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
      from pattern_marks
      where ticker = ${ticker}
      order by updated_at desc, signal_ms desc
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      kind: row.kind === "见顶" ? "见顶" : "止跌",
      signalOn: row.signal_on,
      score: Number(row.score),
      grade: row.grade,
      explain: row.explain,
      placeNote: row.place_note ?? "",
      status: row.status === "broken" ? "broken" : "live",
      brokenOn: row.broken_on ?? "",
      updatedAt: row.updated_at,
    }));
}

async function cachedBars(sql: Sql, ticker: string) {
  await sql`
    create table if not exists candle_cache (
      ticker text primary key,
      bars jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  const due = techInstant();
  const stored = await sql<{ bars: YahooCandle[] | string; updated_at: string }>`
    select bars,
           to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
    from candle_cache
    where ticker = ${ticker}
  `;
  const row = stored[0];
  const fresh = row ? new Date(row.updated_at).getTime() >= due.getTime() : false;
  if (!fresh) await refreshCandleCache(sql, ticker);
  const next = fresh
    ? stored
    : await sql<{ bars: YahooCandle[] | string }>`
        select bars from candle_cache where ticker = ${ticker}
      `;
  const raw = next[0]?.bars;
  const bars = typeof raw === "string" ? (JSON.parse(raw) as YahooCandle[]) : raw;
  return settledBars(Array.isArray(bars) ? bars : []);
}

export const getTechCandles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const ticker = String((input as { ticker?: unknown })?.ticker ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9.]{1,16}$/.test(ticker)) throw new Error("无效代码");
    return { ticker };
  })
  .handler(async ({ data, context }) => {
    await requireActive(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      create table if not exists candle_cache (
        ticker text primary key,
        bars jsonb not null,
        updated_at timestamptz not null default now()
      )
    `;
    return cachedBars(sql, data.ticker);
  });

export async function refreshTechIfDue(sql: Sql) {
  const dueDay = etDay(techInstant().getTime());
  await sql`
    create table if not exists app_meta (
      key text primary key,
      value text not null
    )
  `;
  const meta = await sql<{ value: string }>`select value from app_meta where key = 'tech_day'`;
  if (meta[0]?.value === dueDay) return;
  const tickers = await sql<{ ticker: string }>`select ticker from levels`;
  for (const row of tickers) {
    try {
      const bars = await cachedBars(sql, row.ticker.trim().toUpperCase());
      if (bars.length >= 3) await persistMarks(sql, row.ticker.trim().toUpperCase(), bars);
    } catch {
      /* one ticker should not stop the daily pass */
    }
  }
  await sql`
    insert into app_meta (key, value)
    values ('tech_day', ${dueDay})
    on conflict (key) do update set value = ${dueDay}
  `;
}
