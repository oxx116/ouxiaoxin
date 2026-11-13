import { createServerFn } from "@tanstack/react-start";
import type { Sql } from "@/lib/db";
import { requireActive } from "@/lib/access";
import { authMiddleware } from "@/lib/auth/middleware";

type EtParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
};

function etParts(date: Date): EtParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function previousDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function beforeClock(parts: EtParts, hour: number, minute: number) {
  return parts.hour < hour || (parts.hour === hour && parts.minute < minute);
}

function atEt(year: number, month: number, day: number, hour: number, minute: number) {
  const daylight = new Date(Date.UTC(year, month - 1, day, hour + 4, minute, 0));
  const seen = etParts(daylight);
  if (seen.hour === hour && seen.minute === minute && seen.day === day) return daylight;
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute, 0));
}

/** Latest Yahoo pull that should already have happened: 16:01, then again at 17:01. */
export function lastCloseInstant(now = new Date()) {
  const parts = etParts(now);
  let cursor = { year: parts.year, month: parts.month, day: parts.day };
  let hour = 17;
  if (beforeClock(parts, 16, 1)) {
    cursor = previousDay(cursor.year, cursor.month, cursor.day);
  } else if (beforeClock(parts, 17, 1)) {
    hour = 16;
  }
  for (let i = 0; i < 4; i += 1) {
    const instant = atEt(cursor.year, cursor.month, cursor.day, hour, 1);
    const weekday = etParts(instant).weekday;
    if (weekday !== "Sat" && weekday !== "Sun") return instant;
    cursor = previousDay(cursor.year, cursor.month, cursor.day);
    hour = 17;
  }
  return atEt(cursor.year, cursor.month, cursor.day, hour, 1);
}

export function officialCloseDue(now = new Date()) {
  const parts = etParts(now);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return true;
  return !beforeClock(parts, 16, 1);
}

export function closeIsCurrent(storedIso: string | null, now = new Date()) {
  if (!storedIso) return false;
  const stored = new Date(storedIso).getTime();
  if (Number.isNaN(stored)) return false;
  return stored >= lastCloseInstant(now).getTime();
}

function formatPrice(value: number) {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function formatFact(value: number) {
  return value.toFixed(2);
}

export type YahooFacts = {
  pe: string;
  dayHigh: string;
  dayLow: string;
  open: string;
  prevClose: string;
};

const headers = { "user-agent": "Mozilla/5.0" };

async function chartSession(ticker: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=10d`,
    { headers },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: Array<number>;
        meta?: {
          regularMarketPrice?: number;
          regularMarketTime?: number;
          regularMarketDayHigh?: number;
          regularMarketDayLow?: number;
          shortName?: string;
          longName?: string;
        };
        indicators?: { quote?: Array<{ open?: Array<number | null>; close?: Array<number | null> }> };
      }>;
    };
  };
  const result = body.chart?.result?.[0];
  if (!result?.meta) return null;
  const opens = result.indicators?.quote?.[0]?.open ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const stamps = result.timestamp ?? [];
  const filled: number[] = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (opens[i] != null && closes[i] != null) filled.push(i);
  }
  if (filled.length === 0) return { meta: result.meta, open: null, close: null, prevClose: null };
  let ref = filled.length - 1;
  const lastStamp = stamps[filled[ref]];
  if (lastStamp) {
    const bar = etParts(new Date(lastStamp * 1000));
    const now = etParts(new Date());
    const sameDay = bar.year === now.year && bar.month === now.month && bar.day === now.day;
    if (sameDay && beforeClock(now, 16, 1) && ref > 0) ref -= 1;
  }
  const index = filled[ref];
  const previous = ref > 0 ? closes[filled[ref - 1]] : null;
  return {
    meta: result.meta,
    open: opens[index],
    close: closes[index],
    prevClose: previous,
  };
}

async function trailingPe(ticker: string) {
  const { execFile } = await import("node:child_process");
  const html = await new Promise<string>((resolve, reject) => {
    execFile(
      "curl",
      ["-fsSL", "-A", "Mozilla/5.0", "--max-time", "15", `https://finance.yahoo.com/quote/${ticker}`],
      { maxBuffer: 3_000_000 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
  const match =
    html.match(/trailingPE\\":\{\\"raw\\":([0-9.]+)/) ?? html.match(/trailingPE":\{"raw":([0-9.]+)/);
  if (!match) return "";
  const value = Number(match[1]);
  return Number.isFinite(value) ? formatFact(value) : "";
}

export async function yahooQuote(symbol: string) {
  const ticker = symbol.trim().toUpperCase();
  if (!ticker) return null;
  const session = await chartSession(ticker);
  const price = session?.close ?? session?.meta.regularMarketPrice;
  const time = session?.meta.regularMarketTime;
  if (price == null || !Number.isFinite(price) || !time) return null;
  return {
    price: formatPrice(price),
    at: new Date(time * 1000).toISOString(),
    name: (session.meta.longName || session.meta.shortName || "").trim(),
    open: session.open != null && Number.isFinite(session.open) ? formatPrice(session.open) : "",
  };
}

export async function yahooFacts(symbol: string): Promise<YahooFacts> {
  const ticker = symbol.trim().toUpperCase();
  const empty = { pe: "", dayHigh: "", dayLow: "", open: "", prevClose: "" };
  if (!ticker) return empty;
  const session = await chartSession(ticker).catch(() => null);
  const meta = session?.meta;
  const pe = await trailingPe(ticker).catch(() => "");
  return {
    pe,
    dayHigh: meta?.regularMarketDayHigh != null ? formatFact(meta.regularMarketDayHigh) : "",
    dayLow: meta?.regularMarketDayLow != null ? formatFact(meta.regularMarketDayLow) : "",
    open: session?.open != null ? formatFact(session.open) : "",
    prevClose: session?.prevClose != null ? formatFact(session.prevClose) : "",
  };
}

export type YahooCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export async function yahooCandles(symbol: string): Promise<YahooCandle[]> {
  const ticker = symbol.trim().toUpperCase();
  if (!ticker) return [];
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`,
    { headers },
  );
  if (!response.ok) return [];
  const body = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
    };
  };
  const result = body.chart?.result?.[0];
  const times = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];
  const bars: YahooCandle[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    if (![o, h, l, c].every(Number.isFinite)) continue;
    bars.push({ t: times[i] * 1000, o, h, l, c, v: v != null && Number.isFinite(v) ? v : 0 });
  }
  return bars;
}

export async function refreshCandleCache(sql: Sql, ticker: string) {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return;
  const bars = await yahooCandles(symbol);
  if (bars.length === 0) return;
  await sql`
    create table if not exists candle_cache (
      ticker text primary key,
      bars jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    insert into candle_cache (ticker, bars, updated_at)
    values (${symbol}, ${JSON.stringify(bars)}::jsonb, now())
    on conflict (ticker) do update
    set bars = excluded.bars, updated_at = now()
  `;
}

export const getYahooCandles = createServerFn({ method: "GET" })
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
    const cached = await sql<{ bars: YahooCandle[] | string; updated_at: string }>`
      select bars,
             to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
      from candle_cache
      where ticker = ${data.ticker}
    `;
    const stored = cached[0];
    if (stored && closeIsCurrent(stored.updated_at)) {
      const bars = typeof stored.bars === "string" ? (JSON.parse(stored.bars) as YahooCandle[]) : stored.bars;
      if (Array.isArray(bars) && bars.length > 0) return bars;
    }
    const bars = await yahooCandles(data.ticker);
    if (bars.length > 0) {
      await sql`
        insert into candle_cache (ticker, bars, updated_at)
        values (${data.ticker}, ${JSON.stringify(bars)}::jsonb, now())
        on conflict (ticker) do update
        set bars = excluded.bars, updated_at = now()
      `;
    }
    return bars;
  });

export const getYahooFacts = createServerFn({ method: "GET" })
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
    return yahooFacts(data.ticker);
  });
