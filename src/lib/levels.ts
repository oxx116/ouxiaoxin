import { createServerFn } from "@tanstack/react-start";
import { listedBoard, parseBrief, rightBreakZone, watchState, type WatchState } from "@/lib/brief";
import { closeIsCurrent, officialCloseDue, refreshCandleCache, yahooQuote } from "@/lib/yahoo";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireActive } from "@/lib/access";

export type Level = {
  id: number;
  name: string;
  ticker: string;
  brief: string;
  lastClose: string;
  rightSide: string;
  breakoutClose: string;
  value2026: string;
  value2027: string;
  comment: string;
  commentAt: string;
  supportAt: string;
  resistanceAt: string;
  updatedOn: string;
  updatedAt: string;
  closeAt: string;
  openAt: string;
  lastOpen: string;
  rightPhase: "" | "watch" | "in";
  rightCost: string;
  rightEnteredOn: string;
};

export type WatchMove = {
  id: number;
  ticker: string;
  name: string;
  action: "加入" | "移出";
  board: string;
  movedAt: string;
};

type LevelRow = {
  id: number;
  name: string;
  ticker: string;
  brief: string;
  last_close: string;
  right_side: string;
  breakout_close: string;
  value_2026: string;
  value_2027: string;
  comment: string | null;
  comment_at: string | null;
  support_at: string | null;
  resistance_at: string | null;
  updated_on: string;
  updated_at: string;
  close_at: string | null;
  open_at: string | null;
  last_open: string | null;
};

type Sql = Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>;

const pricePattern = /^[0-9]+(\.[0-9]{1,4})?$/;

function cleanPrice(value: unknown) {
  const text = String(value ?? "")
    .trim()
    .replace(/[¥$,\s]/g, "");
  if (!text) return "";
  if (!pricePattern.test(text)) throw new Error("价位只填数字");
  return text;
}

function parseLevel(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("无效内容");
  const raw = input as Record<string, unknown>;
  const brief = String(raw.brief ?? "").trim();
  if (brief.length > 8000) throw new Error("正文太长了");
  const parsed = parseBrief(brief);
  const ticker = (String(raw.ticker ?? "").trim() || parsed.ticker).slice(0, 20);
  const name = String(raw.name ?? "").trim().slice(0, 40);
  if (!ticker) throw new Error("请填写代码，或把代码写在正文第一行");
  if (parsed.support.length + parsed.resistance.length === 0) {
    throw new Error("没有切出支撑或压力。一行一个区间，例如 320-350（强）长线");
  }
  const idValue = raw.id;
  const id = idValue == null || idValue === "" ? null : Number(idValue);
  if (id != null && (!Number.isInteger(id) || id <= 0)) throw new Error("无效编号");
  return {
    id,
    name,
    ticker,
    brief,
    lastClose: cleanPrice(raw.lastClose),
    rightSide: cleanPrice(raw.rightSide),
    breakoutClose: cleanPrice(raw.breakoutClose),
    value2026: String(raw.value2026 ?? "").trim().slice(0, 4000),
    value2027: String(raw.value2027 ?? "").trim().slice(0, 4000),
    comment: String(raw.comment ?? "").trim().slice(0, 4000),
  };
}

function sideText(brief: string, side: "support" | "resistance") {
  return parseBrief(brief)
    [side].map((zone) => `${zone.low}|${zone.high}|${zone.strength}|${zone.note}`)
    .join("\n");
}

function parsedSide(brief: string, side: "support" | "resistance") {
  return parseBrief(brief)[side].length > 0;
}

function sideChanged(before: string, after: string, side: "support" | "resistance") {
  return sideText(before, side) !== sideText(after, side);
}

function toLevel(row: LevelRow): Level {
  return {
    id: Number(row.id),
    name: row.name,
    ticker: row.ticker,
    brief: row.brief,
    lastClose: row.last_close,
    rightSide: row.right_side,
    breakoutClose: row.breakout_close,
    value2026: row.value_2026 ?? "",
    value2027: row.value_2027 ?? "",
    comment: row.comment ?? "",
    commentAt: row.comment_at ?? "",
    supportAt: row.support_at ?? "",
    resistanceAt: row.resistance_at ?? "",
    updatedOn: String(row.updated_on).slice(0, 10),
    updatedAt: row.updated_at,
    closeAt: row.close_at ?? "",
    openAt: row.open_at ?? "",
    lastOpen: row.last_open ?? "",
    rightPhase: "",
    rightCost: "",
    rightEnteredOn: "",
  };
}

let levelSchemaReady = false;

async function ensureLevelColumns(sql: Sql) {
  if (levelSchemaReady) return;
  await sql`alter table levels add column if not exists comment text not null default ''`;
  await sql`alter table levels add column if not exists comment_at timestamptz`;
  await sql`alter table levels add column if not exists support_at timestamptz`;
  await sql`alter table levels add column if not exists resistance_at timestamptz`;
  await sql`update levels set comment_at = updated_at where comment <> '' and comment_at is null`;
  await sql`update levels set support_at = updated_at where brief <> '' and support_at is null`;
  await sql`update levels set resistance_at = updated_at where brief <> '' and resistance_at is null`;
  await sql`alter table levels add column if not exists last_open text not null default ''`;
  await sql`alter table levels add column if not exists open_at timestamptz`;
  await sql`
    create table if not exists app_meta (
      key text primary key,
      value text not null
    )
  `;
  await sql`
    create table if not exists candle_cache (
      ticker text primary key,
      bars jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  levelSchemaReady = true;
}

async function ensureWatchMoves(sql: Sql) {
  await sql`
    create table if not exists watch_seen (
      ticker text primary key,
      board text not null default '',
      entered_at timestamptz not null default now()
    )
  `;
  await sql`alter table watch_seen add column if not exists entered_at timestamptz not null default now()`;
  await sql`
    create table if not exists watch_moves (
      id bigserial primary key,
      ticker text not null,
      name text not null default '',
      action text not null,
      board text not null,
      moved_at timestamptz not null default now()
    )
  `;
}

function sessionDay(iso: string) {
  const instant = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(instant.getTime()) ? new Date() : instant;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const RETURN_BOARD = "右侧突破后的累计投资收益";

async function ensureExits(sql: Sql) {
  await sql`
    create table if not exists breakout_exits (
      id bigserial primary key,
      ticker text not null,
      name text not null default '',
      cost text not null,
      exit_price text not null,
      entered_on text not null default '',
      exited_on text not null default '',
      kind text not null
    )
  `;
}

function leavingQuote(
  row: { take_profit: string; stop_loss: string },
  openPrice: number,
  close: number,
  lastOpen: string,
  lastClose: string,
) {
  const stop = Number(row.stop_loss);
  const goal = Number(row.take_profit);
  const kind = bookExit(row, openPrice, close);
  if (kind === "止盈") return Number.isFinite(close) && close >= goal ? lastClose : lastOpen;
  if (kind === "止损") return Number.isFinite(close) && close <= stop ? lastClose : lastOpen;
  if (Number.isFinite(close) && close > 0) return lastClose;
  if (Number.isFinite(openPrice) && openPrice > 0) return lastOpen;
  return "";
}

async function archiveExit(
  sql: Sql,
  row: { phase: string; cost: string; entered_on: string; ticker: string },
  name: string,
  exitPrice: string,
  exitedOn: string,
) {
  if (row.phase !== "in") return;
  const cost = Number(row.cost);
  const exit = Number(exitPrice);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(exit) || exit <= 0 || exit === cost) return;
  await ensureExits(sql);
  await sql`
    insert into breakout_exits (ticker, name, cost, exit_price, entered_on, exited_on, kind)
    values (
      ${row.ticker},
      ${name},
      ${row.cost},
      ${exitPrice},
      ${row.entered_on},
      ${exitedOn},
      ${exit > cost ? "止盈" : "止损"}
    )
  `;
}

async function logBoardMove(sql: Sql, ticker: string, name: string, action: "加入" | "移出", board: string) {
  await ensureWatchMoves(sql);
  await sql`
    insert into watch_moves (ticker, name, action, board)
    values (${ticker}, ${name}, ${action}, ${board})
  `;
}

async function ensureBreakoutBook(sql: Sql) {
  await sql`
    create table if not exists breakout_book (
      ticker text primary key,
      phase text not null,
      breakout_on text not null,
      cost text not null default '',
      entered_on text not null default ''
    )
  `;
  await sql`alter table breakout_book add column if not exists entered_on text not null default ''`;
  await sql`alter table breakout_book add column if not exists take_profit text not null default ''`;
  await sql`alter table breakout_book add column if not exists stop_loss text not null default ''`;
  await sql`alter table breakout_book add column if not exists managed boolean not null default false`;
}

function bookExit(
  row: { take_profit: string; stop_loss: string },
  openPrice: number,
  close: number,
) {
  const marks = [openPrice, close].filter((price) => Number.isFinite(price) && price > 0);
  if (marks.length === 0) return null;
  const stop = Number(row.stop_loss);
  const goal = Number(row.take_profit);
  if (row.stop_loss.trim() && Number.isFinite(stop) && stop > 0 && marks.some((price) => price <= stop)) return "止损";
  if (row.take_profit.trim() && Number.isFinite(goal) && goal > 0 && marks.some((price) => price >= goal)) return "止盈";
  return null;
}

async function syncBreakoutBook(sql: Sql, levels: Level[]) {
  await ensureBreakoutBook(sql);
  const stored = await sql<{
    ticker: string;
    phase: string;
    breakout_on: string;
    cost: string;
    entered_on: string;
    take_profit: string;
    stop_loss: string;
    managed: boolean;
  }>`
    select ticker, phase, breakout_on, cost, entered_on, take_profit, stop_loss, managed from breakout_book
  `;
  const book = new Map(stored.map((row) => [row.ticker.toUpperCase(), row]));
  const live = new Set<string>();
  for (const level of levels) {
    const ticker = level.ticker.trim().toUpperCase();
    if (!ticker) continue;
    live.add(ticker);
    const zone = rightBreakZone(level.brief);
    const close = Number(level.lastClose);
    const openPrice = Number(level.lastOpen);
    const raw = watchState(level.brief, level.lastClose, level.lastOpen);
    const row = book.get(ticker);
    const floor = zone ? Number(zone.low) : NaN;
    const pierced =
      Number.isFinite(floor) &&
      ((Number.isFinite(close) && close < floor) || (Number.isFinite(openPrice) && openPrice < floor));
    const lost = !zone || pierced || raw === "破位走空" || raw === "破位走弱";
    const exit = row ? bookExit(row, openPrice, close) : null;
    if (exit || (lost && !row?.managed)) {
      if (row?.phase === "in") {
        const price = leavingQuote(row, openPrice, close, level.lastOpen, level.lastClose);
        await archiveExit(sql, row, level.name, price, sessionDay(level.closeAt));
        await logBoardMove(sql, ticker, level.name, "移出", RETURN_BOARD);
      }
      if (row) await sql`delete from breakout_book where ticker = ${ticker}`;
      continue;
    }
    if (lost && row?.managed) {
      level.rightPhase = row.phase === "in" ? "in" : "watch";
      level.rightCost = row.cost ?? "";
      level.rightEnteredOn = row.entered_on ?? "";
      continue;
    }
    const day = sessionDay(level.closeAt);
    if (!row) {
      if (raw === "右侧突破") {
        await sql`
          insert into breakout_book (ticker, phase, breakout_on, cost)
          values (${ticker}, 'watch', ${day}, '')
        `;
        level.rightPhase = "watch";
      }
      continue;
    }
    const pullback = day > row.breakout_on && close > Number(zone.low) && close <= Number(zone.high);
    if (row.phase !== "in" && pullback) {
      await sql`
        update breakout_book
        set phase = 'in', cost = ${level.lastClose}, entered_on = ${day}
        where ticker = ${ticker}
      `;
      level.rightPhase = "in";
      level.rightCost = level.lastClose;
      level.rightEnteredOn = day;
      await logBoardMove(sql, ticker, level.name, "加入", RETURN_BOARD);
      continue;
    }
    level.rightPhase = row.phase === "in" ? "in" : "watch";
    level.rightCost = row.cost ?? "";
    level.rightEnteredOn = row.entered_on ?? "";
  }
  for (const [ticker, row] of book) {
    if (live.has(ticker)) continue;
    if (row.phase === "in") await logBoardMove(sql, ticker, "", "移出", RETURN_BOARD);
    await sql`delete from breakout_book where ticker = ${ticker}`;
  }
}

async function syncWatchMoves(sql: Sql, levels: Level[]): Promise<WatchMove[]> {
  await ensureWatchMoves(sql);
  await backfillBoardEntered(sql);
  await sql`delete from watch_moves where moved_at < now() - interval '72 hours'`;
  const seenRows = await sql<{ ticker: string; board: string }>`select ticker, board from watch_seen`;
  const seen = new Map(
    seenRows.map((row) => [row.ticker === "__epoch__" ? row.ticker : row.ticker.toUpperCase(), row.board]),
  );
  const current = new Map<string, { board: string; name: string }>();
  for (const level of levels) {
    const ticker = level.ticker.trim().toUpperCase();
    if (!ticker) continue;
    current.set(ticker, {
      board: listedBoard(level.brief, level.lastClose, level.lastOpen, level.rightPhase === "watch" || level.rightPhase === "in") ?? "",
      name: level.name,
    });
  }
  if (seen.get("__epoch__") !== "1") {
    await sql`delete from watch_moves`;
    await sql`delete from watch_seen`;
    for (const [ticker, info] of current) {
      await sql`
        insert into watch_seen (ticker, board)
        values (${ticker}, ${info.board})
        on conflict (ticker) do update set board = excluded.board
      `;
    }
    await sql`
      insert into watch_seen (ticker, board)
      values ('__epoch__', '1')
      on conflict (ticker) do update set board = '1'
    `;
  } else {
    for (const [ticker, info] of current) {
      const previous = seen.get(ticker);
      if (previous === undefined) {
        if (info.board) {
          await sql`
            insert into watch_moves (ticker, name, action, board)
            values (${ticker}, ${info.name}, '加入', ${info.board})
          `;
        }
      } else if (previous !== info.board) {
        if (previous) {
          await sql`
            insert into watch_moves (ticker, name, action, board)
            values (${ticker}, ${info.name}, '移出', ${previous})
          `;
        }
        if (info.board) {
          await sql`
            insert into watch_moves (ticker, name, action, board)
            values (${ticker}, ${info.name}, '加入', ${info.board})
          `;
        }
      } else {
        continue;
      }
      await sql`
        insert into watch_seen (ticker, board, entered_at)
        values (${ticker}, ${info.board}, now())
        on conflict (ticker) do update set board = excluded.board, entered_at = now()
      `;
    }
    for (const [ticker, previous] of seen) {
      if (ticker === "__epoch__" || current.has(ticker)) continue;
      if (previous) {
        await sql`
          insert into watch_moves (ticker, name, action, board)
          values (${ticker}, '', '移出', ${previous})
        `;
      }
      await sql`delete from watch_seen where ticker = ${ticker}`;
    }
  }
  const rows = await sql<{
    id: number;
    ticker: string;
    name: string;
    action: "加入" | "移出";
    board: string;
    moved_at: string;
  }>`
    select id, ticker, name, action, board,
           to_char(moved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as moved_at
    from watch_moves
    order by moved_at desc, id desc
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    ticker: row.ticker,
    name: row.name,
    action: row.action,
    board: row.board,
    movedAt: row.moved_at,
  }));
}

async function refreshCloses(sql: Sql, force = false) {
  if (!force) {
    const epochRows = await sql<{ value: string }>`select value from app_meta where key = 'quote_epoch'`;
    force = epochRows[0]?.value !== "2026-11-10-split";
  }
  const rows = await sql<{
    id: number;
    ticker: string;
    name: string;
    last_close: string;
    close_at: string | null;
    open_at: string | null;
    last_open: string | null;
  }>`
    select id, ticker, name, last_close, last_open,
           to_char(close_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as close_at,
           to_char(open_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as open_at
    from levels
  `;
  let pulled = 0;
  for (const row of rows) {
    try {
      if (!force && row.close_at && !officialCloseDue()) continue;
      if (!force && closeIsCurrent(row.close_at) && row.last_open && row.open_at) continue;
      const quote = await yahooQuote(row.ticker);
      if (!quote) continue;
      const fetchedAt = new Date().toISOString();
      const openAt = !row.last_open || row.last_open !== quote.open ? fetchedAt : row.open_at;
      await sql`
        update levels
        set last_close = ${quote.price},
            last_open = ${quote.open},
            close_at = ${fetchedAt},
            open_at = ${openAt ?? fetchedAt},
            name = case when ${quote.name} <> '' then ${quote.name} else name end
        where id = ${row.id}
      `;
      await refreshCandleCache(sql, row.ticker).catch(() => undefined);
      pulled += 1;
    } catch {
      /* one quote failing should not hide the admin form */
    }
  }
  if (pulled > 0 || rows.length === 0) {
    await sql`
      insert into app_meta (key, value)
      values ('quote_epoch', '2026-11-10-split')
      on conflict (key) do update set value = '2026-11-10-split'
    `;
  }
  return pulled;
}

let quoteRefresh: Promise<unknown> | null = null;

function kickQuoteRefresh(sql: Sql) {
  if (quoteRefresh) return;
  quoteRefresh = refreshCloses(sql)
    .then(async () => {
      const { refreshTechIfDue } = await import("@/lib/patterns");
      await refreshTechIfDue(sql);
    })
    .catch(() => undefined)
    .finally(() => {
      quoteRefresh = null;
    });
}

export const refreshQuotes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureLevelColumns(sql);
    const count = await refreshCloses(sql, true);
    return { count };
  });

export type BreakoutExit = {
  id: number;
  ticker: string;
  name: string;
  cost: string;
  exitPrice: string;
  enteredOn: string;
  exitedOn: string;
  kind: "止盈" | "止损";
};

export type BreakoutHolding = {
  ticker: string;
  name: string;
  cost: string;
  takeProfit: string;
  stopLoss: string;
  enteredOn: string;
  close: string;
};

export const listBreakoutBook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureBreakoutBook(sql);
    const rows = await sql<{
      ticker: string;
      name: string;
      cost: string;
      take_profit: string;
      stop_loss: string;
      entered_on: string;
      last_close: string;
    }>`
      select b.ticker, coalesce(l.name, '') as name, b.cost, b.take_profit, b.stop_loss, b.entered_on,
             coalesce(l.last_close, '') as last_close
      from breakout_book b
      left join levels l on upper(l.ticker) = b.ticker
      where b.phase = 'in'
      order by b.ticker
    `;
    return rows.map((row) => ({
      ticker: row.ticker,
      name: row.name,
      cost: row.cost,
      takeProfit: row.take_profit,
      stopLoss: row.stop_loss,
      enteredOn: row.entered_on,
      close: row.last_close,
    })) satisfies BreakoutHolding[];
  });

export const deleteBreakoutEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const ticker = String((input as { ticker?: unknown })?.ticker ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9.]{1,16}$/.test(ticker)) throw new Error("请填写股票代码");
    return { ticker };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureBreakoutBook(sql);
    const existing = await sql<{
      phase: string;
      name: string;
      cost: string;
      entered_on: string;
      last_close: string;
      close_at: string;
    }>`
      select b.phase, b.cost, b.entered_on, coalesce(l.name, '') as name,
             coalesce(l.last_close, '') as last_close,
             coalesce(to_char(l.close_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') as close_at
      from breakout_book b
      left join levels l on upper(l.ticker) = b.ticker
      where b.ticker = ${data.ticker}
    `;
    if (!existing[0]) return { ticker: data.ticker };
    if (existing[0].phase === "in") {
      await archiveExit(
        sql,
        { ticker: data.ticker, phase: "in", cost: existing[0].cost, entered_on: existing[0].entered_on },
        existing[0].name,
        existing[0].last_close,
        sessionDay(existing[0].close_at),
      );
      await logBoardMove(sql, data.ticker, existing[0].name, "移出", RETURN_BOARD);
    }
    await sql`delete from breakout_book where ticker = ${data.ticker}`;
    return { ticker: data.ticker };
  });

export const saveBreakoutEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as { ticker?: unknown; cost?: unknown; takeProfit?: unknown; stopLoss?: unknown };
    const ticker = String(body?.ticker ?? "").trim().toUpperCase();
    const cost = String(body?.cost ?? "").trim();
    const takeProfit = String(body?.takeProfit ?? "").trim();
    const stopLoss = String(body?.stopLoss ?? "").trim();
    if (!/^[A-Z0-9.]{1,16}$/.test(ticker)) throw new Error("请填写股票代码");
    const price = Number(cost);
    if (!Number.isFinite(price) || price <= 0) throw new Error("请填写建仓价格");
    if (takeProfit && !(Number(takeProfit) > 0)) throw new Error("止盈价格不对");
    if (stopLoss && !(Number(stopLoss) > 0)) throw new Error("止损价格不对");
    if (takeProfit && stopLoss && Number(stopLoss) >= Number(takeProfit)) throw new Error("止损要低于止盈");
    return { ticker, cost, takeProfit, stopLoss };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureBreakoutBook(sql);
    const found = await sql<{ name: string }>`
      select name from levels where upper(ticker) = ${data.ticker} limit 1
    `;
    if (!found[0]) throw new Error("没有这只股票，请先在更新位置里添加");
    const day = sessionDay(new Date().toISOString());
    const existing = await sql<{ phase: string }>`
      select phase from breakout_book where ticker = ${data.ticker}
    `;
    await sql`
      insert into breakout_book (ticker, phase, breakout_on, cost, entered_on, take_profit, stop_loss, managed)
      values (${data.ticker}, 'in', ${day}, ${data.cost}, ${day}, ${data.takeProfit}, ${data.stopLoss}, true)
      on conflict (ticker) do update
      set phase = 'in',
          cost = excluded.cost,
          take_profit = excluded.take_profit,
          stop_loss = excluded.stop_loss,
          managed = true,
          entered_on = case
            when breakout_book.phase = 'in' and breakout_book.entered_on <> '' then breakout_book.entered_on
            else excluded.entered_on
          end
    `;
    if (existing[0]?.phase !== "in") await logBoardMove(sql, data.ticker, found[0].name, "加入", RETURN_BOARD);
    return data;
  });

export const listBreakoutExits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureExits(sql);
    const rows = await sql<{
      id: number;
      ticker: string;
      name: string;
      cost: string;
      exit_price: string;
      entered_on: string;
      exited_on: string;
      kind: string;
    }>`
      select id, ticker, name, cost, exit_price, entered_on, exited_on, kind
      from breakout_exits
      order by id desc
    `;
    return rows.flatMap((row) =>
      row.kind === "止盈" || row.kind === "止损"
        ? [
            {
              id: row.id,
              ticker: row.ticker,
              name: row.name,
              cost: row.cost,
              exitPrice: row.exit_price,
              enteredOn: row.entered_on,
              exitedOn: row.exited_on,
              kind: row.kind,
            } satisfies BreakoutExit,
          ]
        : [],
    );
  });

export const saveBreakoutExit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = input as {
      id?: unknown;
      ticker?: unknown;
      cost?: unknown;
      exitPrice?: unknown;
      enteredOn?: unknown;
      exitedOn?: unknown;
    };
    const id = body?.id == null || body.id === "" ? null : Number(body.id);
    const ticker = String(body?.ticker ?? "").trim().toUpperCase();
    const cost = String(body?.cost ?? "").trim();
    const exitPrice = String(body?.exitPrice ?? "").trim();
    const enteredOn = String(body?.enteredOn ?? "").trim();
    const exitedOn = String(body?.exitedOn ?? "").trim();
    if (id != null && !Number.isInteger(id)) throw new Error("记录不对");
    if (!/^[A-Z0-9.]{1,16}$/.test(ticker)) throw new Error("请填写股票代码");
    const costPrice = Number(cost);
    const leave = Number(exitPrice);
    if (!Number.isFinite(costPrice) || costPrice <= 0) throw new Error("请填写建仓价格");
    if (!Number.isFinite(leave) || leave <= 0) throw new Error("请填写离场价格");
    if (leave === costPrice) throw new Error("离场价和建仓价一样，不算止盈或止损");
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (enteredOn && !day.test(enteredOn)) throw new Error("建仓日期写成 2026-11-10");
    if (exitedOn && !day.test(exitedOn)) throw new Error("离场日期写成 2026-11-10");
    return {
      id,
      ticker,
      cost,
      exitPrice,
      enteredOn,
      exitedOn,
      kind: (leave > costPrice ? "止盈" : "止损") as "止盈" | "止损",
    };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureExits(sql);
    const found = await sql<{ name: string }>`
      select name from levels where upper(ticker) = ${data.ticker} limit 1
    `;
    if (!found[0]) throw new Error("没有这只股票，请先在更新位置里添加");
    if (data.id == null) {
      await sql`
        insert into breakout_exits (ticker, name, cost, exit_price, entered_on, exited_on, kind)
        values (${data.ticker}, ${found[0].name}, ${data.cost}, ${data.exitPrice}, ${data.enteredOn}, ${data.exitedOn}, ${data.kind})
      `;
    } else {
      const updated = await sql<{ id: number }>`
        update breakout_exits
        set ticker = ${data.ticker},
            name = ${found[0].name},
            cost = ${data.cost},
            exit_price = ${data.exitPrice},
            entered_on = ${data.enteredOn},
            exited_on = ${data.exitedOn},
            kind = ${data.kind}
        where id = ${data.id}
        returning id
      `;
      if (!updated[0]) throw new Error("没有这条记录");
    }
    return data;
  });

export const deleteBreakoutExit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = Number((input as { id?: unknown })?.id);
    if (!Number.isInteger(id)) throw new Error("记录不对");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureExits(sql);
    await sql`delete from breakout_exits where id = ${data.id}`;
    return { id: data.id };
  });

export const listLevels = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireActive(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await ensureLevelColumns(sql);
    await refreshCloses(sql);
    const rows = await sql<LevelRow>`
      select id, name, ticker, brief, last_close, right_side, breakout_close,
             value_2026, value_2027, comment,
             to_char(comment_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as comment_at,
             to_char(support_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as support_at,
             to_char(resistance_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as resistance_at,
             to_char(updated_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD') as updated_on,
             to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
             to_char(close_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as close_at,
             to_char(open_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as open_at,
             last_open
      from levels
      order by id desc
    `;
    const levels = rows.map((row) => toLevel(row));
    await syncBreakoutBook(sql, levels);
    await syncWatchMoves(sql, levels);
    return levels;
  });

export const listHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireActive(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await ensureLevelColumns(sql);
    void kickQuoteRefresh(sql);
    const rows = await sql<LevelRow>`
      select id, name, ticker, brief, last_close, right_side, breakout_close,
             value_2026, value_2027, comment,
             to_char(comment_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as comment_at,
             to_char(support_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as support_at,
             to_char(resistance_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as resistance_at,
             to_char(updated_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD') as updated_on,
             to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
             to_char(close_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as close_at,
             to_char(open_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as open_at,
             last_open
      from levels
      order by id desc
    `;
    const levels = rows.map((row) => toLevel(row));
    await syncBreakoutBook(sql, levels);
    const moves = await syncWatchMoves(sql, levels);
    await ensureExits(sql);
    const exitRows = await sql<{
      id: number;
      ticker: string;
      name: string;
      cost: string;
      exit_price: string;
      entered_on: string;
      exited_on: string;
      kind: string;
    }>`
      select id, ticker, name, cost, exit_price, entered_on, exited_on, kind
      from breakout_exits
      order by id desc
    `;
    const exits: BreakoutExit[] = exitRows.flatMap((row) =>
      row.kind === "止盈" || row.kind === "止损"
        ? [{
            id: row.id,
            ticker: row.ticker,
            name: row.name,
            cost: row.cost,
            exitPrice: row.exit_price,
            enteredOn: row.entered_on,
            exitedOn: row.exited_on,
            kind: row.kind,
          }]
        : [],
    );
    return { levels, moves, exits, boardEntered: await boardEnteredAt(sql) };
  });

async function backfillBoardEntered(sql: Sql) {
  const flag = await sql<{ value: string }>`select value from app_meta where key = 'board_entered_v1'`;
  if (flag[0]?.value === "1") return;
  await sql`update watch_seen set entered_at = '2000-01-01T00:00:00Z' where ticker <> '__epoch__'`;
  await sql`
    update watch_seen s
    set entered_at = m.moved_at
    from (
      select ticker, board, max(moved_at) as moved_at
      from watch_moves
      where action = '加入'
      group by ticker, board
    ) m
    where s.ticker = m.ticker and s.board = m.board
  `;
  await sql`
    insert into app_meta (key, value)
    values ('board_entered_v1', '1')
    on conflict (key) do update set value = '1'
  `;
}

async function boardEnteredAt(sql: Sql) {
  await ensureWatchMoves(sql);
  const rows = await sql<{ ticker: string; entered_at: string }>`
    select ticker,
           to_char(entered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as entered_at
    from watch_seen
    where ticker <> '__epoch__'
  `;
  const entered: Record<string, string> = {};
  for (const row of rows) entered[row.ticker.toUpperCase()] = row.entered_at;
  return entered;
}

async function requireAdmin(userId: string) {
  const { getSql } = await import("@/lib/db");
  const { readBrief } = await import("@/lib/access");
  const sql = await getSql();
  const brief = await readBrief(userId);
  if (!brief.isAdmin) throw new Error("只有管理员可以修改位置");
  return sql;
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const { readBrief } = await import("@/lib/access");
    const sql = await getSql();
    const brief = await readBrief(context.userId);
    const rows = await sql<{ user_id: string }>`select user_id from admins`;
    return {
      isAdmin: brief.isAdmin,
      adminCount: rows.length,
    };
  });

export const registrationOpen = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql`select 1 as ok from admins limit 1`;
  return { open: rows.length === 0 };
});

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const inserted = await sql<{ user_id: string }>`
      insert into admins (user_id)
      select ${context.userId}
      where not exists (select 1 from admins)
      returning user_id
    `;
    if (inserted.length > 0) {
      const { grantForever } = await import("@/lib/access");
      await grantForever(context.userId);
      return { isAdmin: true, claimed: true };
    }
    const rows = await sql<{ user_id: string }>`select user_id from admins where user_id = ${context.userId}`;
    if (rows.length > 0) {
      const { grantForever } = await import("@/lib/access");
      await grantForever(context.userId);
    }
    return { isAdmin: rows.length > 0, claimed: false };
  });

export const saveLevel = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseLevel)
  .handler(async ({ data, context }) => {
    const sql = await requireAdmin(context.userId);
    await ensureLevelColumns(sql);
    const quote = await yahooQuote(data.ticker).catch(() => null);
    const name = quote?.name || data.name;
    const lastClose = quote?.price || data.lastClose;
    if (data.id == null) {
      const now = new Date();
      const rows = await sql<{ id: number }>`
        insert into levels (
          name, ticker, brief, last_close, right_side, breakout_close,
          value_2026, value_2027, comment, comment_at, support_at, resistance_at
        )
        values (
          ${name}, ${data.ticker}, ${data.brief}, ${lastClose}, '', '',
          ${data.value2026}, ${data.value2027}, ${data.comment},
          ${data.comment ? now : null},
          ${parsedSide(data.brief, "support") ? now : null},
          ${parsedSide(data.brief, "resistance") ? now : null}
        )
        returning id
      `;
      return { id: Number(rows[0]?.id) };
    }
    const current = await sql<{
      comment: string;
      brief: string;
      comment_at: Date | string | null;
      support_at: Date | string | null;
      resistance_at: Date | string | null;
    }>`
      select comment, brief, comment_at, support_at, resistance_at from levels where id = ${data.id}
    `;
    const previous = current[0];
    const now = new Date();
    const commentAt = (previous?.comment ?? "") !== data.comment ? now : (previous?.comment_at ?? null);
    const supportAt = sideChanged(previous?.brief ?? "", data.brief, "support") ? now : (previous?.support_at ?? null);
    const resistanceAt = sideChanged(previous?.brief ?? "", data.brief, "resistance")
      ? now
      : (previous?.resistance_at ?? null);
    const updated = await sql<{ id: number }>`
      update levels
      set name = ${name},
          ticker = ${data.ticker},
          brief = ${data.brief},
          last_close = ${lastClose},
          right_side = '',
          breakout_close = '',
          value_2026 = ${data.value2026},
          value_2027 = ${data.value2027},
          comment = ${data.comment},
          comment_at = ${commentAt},
          support_at = ${supportAt},
          resistance_at = ${resistanceAt},
          updated_at = now()
      where id = ${data.id}
      returning id
    `;
    if (updated.length === 0) throw new Error("这条位置已经不在了");
    return { id: data.id };
  });

export const deleteLevel = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = Number((input as { id?: unknown })?.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("无效编号");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdmin(context.userId);
    await sql`delete from levels where id = ${data.id}`;
    return { ok: true };
  });
