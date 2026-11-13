import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type AccessStatus = "ok" | "expired" | "disabled";

async function sqlClient() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export async function grantAccess(userId: string, days: number) {
  const sql = await sqlClient();
  const span = Math.min(3650, Math.max(1, Math.round(days)));
  forgetGate(userId);
  const expires = new Date(Date.now() + span * 24 * 60 * 60 * 1000);
  await sql`
    insert into user_access (user_id, disabled, expires_at)
    values (${userId}, false, ${expires})
    on conflict (user_id) do update
      set disabled = false,
          expires_at = ${expires}
  `;
}

export async function grantForever(userId: string) {
  forgetGate(userId);
  const sql = await sqlClient();
  const expires = new Date("2099-01-01T00:00:00Z");
  await sql`
    insert into user_access (user_id, disabled, expires_at)
    values (${userId}, false, ${expires})
    on conflict (user_id) do update
      set disabled = false,
          expires_at = ${expires}
  `;
}

const OWNER_EMAIL = "ou1163359315@gmail.com";

export type SessionBrief = {
  status: AccessStatus;
  isAdmin: boolean;
  label: string;
  via: Array<"google" | "x">;
};

const gateCache = new Map<string, { at: number; value: SessionBrief }>();

export function forgetGate(userId?: string) {
  if (userId) gateCache.delete(userId);
  else gateCache.clear();
}

export async function readBrief(userId: string): Promise<SessionBrief> {
  const hit = gateCache.get(userId);
  if (hit && Date.now() - hit.at < 20_000) return hit.value;
  const sql = await sqlClient();
  const rows = await sql<{
    email: string;
    name: string;
    is_admin: boolean;
    disabled: boolean | null;
    expires_at: Date | string | null;
    providers: string | null;
  }>`
    select u.email, u.name,
           exists(select 1 from admins where user_id = u.id) as is_admin,
           a.disabled, a.expires_at,
           (select string_agg(distinct "providerId", ',') from "account" where "userId" = u.id) as providers
    from "user" u
    left join user_access a on a.user_id = u.id
    where u.id = ${userId}
    limit 1
  `;
  const row = rows[0];
  const email = row?.email ?? "";
  const isOwner = email.toLowerCase() === OWNER_EMAIL;
  let isAdmin = Boolean(row?.is_admin) || isOwner;
  if (isOwner && !row?.is_admin) {
    await sql`delete from admins where user_id <> ${userId}`;
    await sql`insert into admins (user_id) values (${userId}) on conflict (user_id) do nothing`;
    if (!row?.expires_at || new Date(row.expires_at).getTime() < Date.UTC(2090, 0, 1)) await grantForever(userId);
    isAdmin = true;
  }
  let status: AccessStatus = "ok";
  if (!isAdmin) {
    if (row?.disabled) status = "disabled";
    else if (!row?.expires_at) {
      await grantAccess(userId, 30);
      status = "ok";
    } else if (new Date(row.expires_at).getTime() <= Date.now()) status = "expired";
  }
  const value: SessionBrief = {
    status,
    isAdmin,
    label: row?.name && row.name !== email ? row.name : email,
    via: providerMarks(row?.providers ?? ""),
  };
  gateCache.set(userId, { at: Date.now(), value });
  return value;
}

export async function accessStatus(userId: string): Promise<{ status: AccessStatus }> {
  const brief = await readBrief(userId);
  return { status: brief.status };
}

export async function requireActive(userId: string) {
  const access = await accessStatus(userId);
  if (access.status === "ok") return;
  throw new Error(access.status === "disabled" ? "账户已停用，请联系管理员" : "访问已到期，请联系管理员续期");
}

async function requireAdminSql(userId: string) {
  const sql = await sqlClient();
  const rows = await sql`select 1 as ok from admins where user_id = ${userId} limit 1`;
  if (rows.length === 0) throw new Error("只有管理员可以管理用户");
  return sql;
}

async function ensureStockClicks(sql: Awaited<ReturnType<typeof sqlClient>>) {
  await sql`
    create table if not exists stock_clicks (
      user_id text not null,
      ticker text not null,
      hits integer not null default 0,
      primary key (user_id, ticker)
    )
  `;
}

export type StockClick = { ticker: string; hits: number };

export const noteStockClick = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const ticker = String((input as { ticker?: unknown })?.ticker ?? "").trim();
    if (!ticker || ticker.length > 80) throw new Error("没有这只股票");
    return { ticker };
  })
  .handler(async ({ data, context }) => {
    await requireActive(context.userId);
    const sql = await sqlClient();
    await ensureStockClicks(sql);
    const key = data.ticker.toUpperCase();
    const found = await sql<{ ticker: string }>`
      select ticker from levels
      where upper(ticker) = ${key} or lower(name) = ${data.ticker.toLowerCase()}
      limit 1
    `;
    const ticker = found[0]?.ticker?.trim().toUpperCase();
    if (!ticker) return { ok: false };
    await sql`
      insert into stock_clicks (user_id, ticker, hits)
      values (${context.userId}, ${ticker}, 1)
      on conflict (user_id, ticker) do update set hits = stock_clicks.hits + 1
    `;
    return { ok: true };
  });

export const listStockClicks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const userId = String((input as { userId?: unknown })?.userId ?? "").trim();
    if (!userId) throw new Error("没有这个用户");
    return { userId };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdminSql(context.userId);
    await ensureStockClicks(sql);
    const rows = await sql<{ ticker: string; hits: number }>`
      select ticker, hits from stock_clicks
      where user_id = ${data.userId}
      order by hits desc, ticker
    `;
    return rows.map((row) => ({ ticker: row.ticker, hits: Number(row.hits) }));
  });

export const siteAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => accessStatus(context.userId));

export const sessionBrief = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => readBrief(context.userId));

let briefCache: { userId: string; at: number; value: SessionBrief } | null = null;
let briefFlight: { userId: string; promise: Promise<SessionBrief> } | null = null;

export function loadBrief(userId: string) {
  if (briefCache && briefCache.userId === userId && Date.now() - briefCache.at < 20_000) {
    return Promise.resolve(briefCache.value);
  }
  if (briefFlight?.userId === userId) return briefFlight.promise;
  const promise = sessionBrief()
    .then((value) => {
      briefCache = { userId, at: Date.now(), value };
      briefFlight = null;
      return value;
    })
    .catch((error: unknown) => {
      briefFlight = null;
      throw error;
    });
  briefFlight = { userId, promise };
  return promise;
}

export type Member = {
  id: string;
  email: string;
  name: string;
  createdOn: string;
  disabled: boolean;
  active: boolean;
  expiresOn: string;
  isAdmin: boolean;
  hasPassword: boolean;
  via: Array<"google" | "x">;
};

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdminSql(context.userId);
    const rows = await sql<{
      id: string;
      email: string;
      name: string;
      created_on: string;
      disabled: boolean | null;
      active: boolean | null;
      expires_on: string | null;
      is_admin: boolean;
      has_password: boolean;
      providers: string | null;
    }>`
      select u.id, u.email, u.name,
             to_char(u."createdAt" at time zone 'Asia/Shanghai', 'YYYY-MM-DD') as created_on,
             a.disabled,
             a.expires_at > now() as active,
             to_char(a.expires_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD') as expires_on,
             exists(select 1 from admins where user_id = u.id) as is_admin,
             exists(select 1 from "account" where "userId" = u.id and "providerId" = 'credential' and password is not null) as has_password,
             (select string_agg(distinct "providerId", ',') from "account" where "userId" = u.id) as providers
      from "user" u
      left join user_access a on a.user_id = u.id
      order by u."createdAt" desc
    `;
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      createdOn: row.created_on,
      disabled: Boolean(row.disabled),
      active: row.active !== false,
      expiresOn: row.expires_on ?? "",
      isAdmin: row.is_admin,
      hasPassword: row.has_password,
      via: providerMarks(row.providers ?? ""),
    })) satisfies Member[];
  });

function providerMarks(raw: string): Array<"google" | "x"> {
  const marks = new Set<"google" | "x">();
  for (const name of raw.split(",")) {
    const id = name.trim().toLowerCase();
    if (id.includes("google")) marks.add("google");
    if (id.includes("twitter") || id.includes("grok-x") || id === "x" || id.endsWith("-x")) marks.add("x");
  }
  return [...marks];
}

export const myAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    const rows = await sql<{ name: string; email: string; providers: string | null }>`
      select u.name, u.email,
             (select string_agg(distinct "providerId", ',') from "account" where "userId" = u.id) as providers
      from "user" u
      where u.id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    const email = row?.email ?? "";
    const name = row?.name ?? "";
    return {
      label: name && name !== email ? name : email,
      via: providerMarks(row?.providers ?? ""),
    };
  });

function cleanDays(value: unknown) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("天数要在 1 到 3650 之间");
  return days;
}

export const setMemberAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { userId?: unknown; disabled?: unknown; days?: unknown };
    const userId = String(raw.userId ?? "");
    if (!userId) throw new Error("无效用户");
    const disabled = raw.disabled == null ? null : Boolean(raw.disabled);
    const days = raw.days == null || raw.days === "" ? null : cleanDays(raw.days);
    return { userId, disabled, days };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdminSql(context.userId);
    if (data.days != null) await grantAccess(data.userId, data.days);
    if (data.disabled != null) {
      const existing = await sql`select 1 as ok from user_access where user_id = ${data.userId}`;
      if (existing.length === 0) await grantAccess(data.userId, 30);
      await sql`update user_access set disabled = ${data.disabled} where user_id = ${data.userId}`;
      forgetGate(data.userId);
    }
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const userId = String((input as { userId?: unknown })?.userId ?? "");
    if (!userId) throw new Error("无效用户");
    return { userId };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdminSql(context.userId);
    if (data.userId === context.userId) throw new Error("不能删除自己的管理员账户");
    const admins = await sql`select 1 as ok from admins where user_id = ${data.userId}`;
    if (admins.length > 0) throw new Error("不能删除管理员");
    await sql`delete from "user" where id = ${data.userId}`;
    forgetGate(data.userId);
    return { ok: true };
  });

export const batchMembers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { userIds?: unknown; action?: unknown; days?: unknown };
    const userIds = Array.isArray(raw.userIds) ? [...new Set(raw.userIds.map((id) => String(id)).filter(Boolean))] : [];
    if (userIds.length === 0 || userIds.length > 100) throw new Error("请先选择用户");
    const action = raw.action;
    if (action !== "disable" && action !== "enable" && action !== "delete" && action !== "renew") {
      throw new Error("无效操作");
    }
    return {
      userIds,
      action,
      days: action === "renew" ? cleanDays(raw.days) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdminSql(context.userId);
    const admins = await sql<{ user_id: string }>`select user_id from admins`;
    const blocked = new Set(admins.map((row) => row.user_id));
    blocked.add(context.userId);
    const ids = data.userIds.filter((id) => !blocked.has(id));
    if (ids.length === 0) throw new Error("管理员不能这样处理");
    for (const id of ids) {
      if (data.action === "delete") {
        await sql`delete from "user" where id = ${id}`;
        forgetGate(id);
      } else if (data.action === "renew" && data.days != null) {
        await grantAccess(id, data.days);
      } else if (data.action === "disable" || data.action === "enable") {
        const existing = await sql`select 1 as ok from user_access where user_id = ${id}`;
        if (existing.length === 0) await grantAccess(id, 30);
        await sql`update user_access set disabled = ${data.action === "disable"} where user_id = ${id}`;
      }
    }
    return { count: ids.length };
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { email?: unknown; password?: unknown; days?: unknown };
    const email = String(raw.email ?? "").trim().toLowerCase();
    const password = String(raw.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱不对");
    if (password.length < 8) throw new Error("密码至少 8 位");
    return { email, password, days: raw.days == null || raw.days === "" ? 30 : cleanDays(raw.days) };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdminSql(context.userId);
    const { hashPassword } = await import("better-auth/crypto");
    const id = crypto.randomUUID();
    const hash = await hashPassword(data.password);
    const now = new Date();
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${id}, ${data.email}, ${data.email}, false, ${now}, ${now})
    `;
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${crypto.randomUUID()}, ${id}, 'credential', ${id}, ${hash}, ${now}, ${now})
    `;
    await grantAccess(id, data.days);
    return { id };
  });

export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = input as { userId?: unknown; password?: unknown };
    const userId = String(raw.userId ?? "");
    const password = String(raw.password ?? "");
    if (!userId) throw new Error("无效用户");
    if (password.length < 8) throw new Error("密码至少 8 位");
    return { userId, password };
  })
  .handler(async ({ data, context }) => {
    const sql = await requireAdminSql(context.userId);
    const { hashPassword } = await import("better-auth/crypto");
    const hash = await hashPassword(data.password);
    const rows = await sql<{ id: string }>`
      update "account"
      set password = ${hash}, "updatedAt" = now()
      where "userId" = ${data.userId} and "providerId" = 'credential'
      returning id
    `;
    if (rows.length === 0) throw new Error("这个账户是用 Google 或 X 登录的，没有密码");
    return { ok: true };
  });

export const firstArrival = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await sqlClient();
    const rows = await sql<{ id: string; fresh: boolean }>`
      select id, "createdAt" > now() - interval '20 minutes' as fresh
      from "user"
      where id = ${context.userId}
    `;
    const row = rows[0];
    return { id: row?.id ?? "", fresh: Boolean(row?.fresh) };
  });

export type WatchItem = { ticker: string; name: string; addedAt: string; close: string; open: string };

async function ensureWatchlist(sql: Awaited<ReturnType<typeof sqlClient>>) {
  await sql`
    create table if not exists watchlist (
      user_id text not null,
      ticker text not null,
      added_at timestamptz not null default now(),
      primary key (user_id, ticker)
    )
  `;
}

async function resolveTicker(sql: Awaited<ReturnType<typeof sqlClient>>, raw: string) {
  const key = raw.trim().toUpperCase();
  const found = await sql<{ ticker: string }>`
    select ticker from levels
    where upper(ticker) = ${key} or lower(name) = ${raw.trim().toLowerCase()}
    limit 1
  `;
  return found[0]?.ticker?.trim().toUpperCase() ?? "";
}

export const listWatch = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireActive(context.userId);
    const sql = await sqlClient();
    await ensureWatchlist(sql);
    const rows = await sql<{ ticker: string; name: string; added_at: string; last_close: string; last_open: string }>`
      select w.ticker,
             coalesce(l.name, '') as name,
             w.added_at,
             coalesce(l.last_close, '') as last_close,
             coalesce(l.last_open, '') as last_open
      from watchlist w
      left join levels l on upper(l.ticker) = w.ticker
      where w.user_id = ${context.userId}
      order by w.added_at desc, w.ticker
    `;
    return rows.map((row) => ({
      ticker: row.ticker,
      name: row.name ?? "",
      addedAt: row.added_at,
      close: row.last_close ?? "",
      open: row.last_open ?? "",
    }));
  });

export const addWatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const ticker = String((input as { ticker?: unknown })?.ticker ?? "").trim();
    if (!ticker || ticker.length > 80) throw new Error("没有这只股票");
    return { ticker };
  })
  .handler(async ({ data, context }) => {
    await requireActive(context.userId);
    const sql = await sqlClient();
    await ensureWatchlist(sql);
    const ticker = await resolveTicker(sql, data.ticker);
    if (!ticker) return { ok: false as const };
    await sql`
      insert into watchlist (user_id, ticker, added_at)
      values (${context.userId}, ${ticker}, now())
      on conflict (user_id, ticker) do update set added_at = now()
    `;
    return { ok: true as const, ticker };
  });

export const removeWatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const ticker = String((input as { ticker?: unknown })?.ticker ?? "").trim().toUpperCase();
    if (!ticker) throw new Error("没有这只股票");
    return { ticker };
  })
  .handler(async ({ data, context }) => {
    await requireActive(context.userId);
    const sql = await sqlClient();
    await ensureWatchlist(sql);
    await sql`delete from watchlist where user_id = ${context.userId} and ticker = ${data.ticker}`;
    return { ok: true };
  });
