import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  batchMembers,
  createMember,
  listMembers,
  listStockClicks,
  resetMemberPassword,
  setMemberAccess,
  type Member,
  type StockClick,
} from "@/lib/access";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAdminStatus } from "@/lib/levels";
import { RequireAccess } from "@/components/require-access";
import { ProviderMark } from "@/components/provider-mark";
import { TickerLogo } from "@/components/ticker-logo";

export const Route = createFileRoute("/users")({ component: UsersPage });

function UsersPage() {
  const { user, isPending } = useCurrentUserState();
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Member[]>([]);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [days, setDays] = useState("30");
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [batchDays, setBatchDays] = useState("30");
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);

  async function load() {
    setRows(await listMembers());
  }

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getAdminStatus()
      .then(async (status) => {
        if (!alive) return;
        setAdmin(status.isAdmin);
        setReady(true);
        if (status.isAdmin) await load();
        else window.location.replace("/");
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!focusId) return;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId, rows]);

  useEffect(() => {
    if (focusId || message !== "没有这个用户名，已返回用户管理。") return;
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId, message]);

  function findUser(event: FormEvent) {
    event.preventDefault();
    const needle = query.trim().toLowerCase();
    if (!needle) {
      setFocusId(null);
      setMessage("");
      return;
    }
    const people = rows;
    const exact = people.find((member) => member.name.toLowerCase() === needle || member.email.toLowerCase() === needle);
    const fuzzy = people.filter(
      (member) => member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle),
    );
    const hit = exact ?? (fuzzy.length === 1 ? fuzzy[0] : null);
    if (!hit) {
      setFocusId(null);
      setMessage(fuzzy.length > 1 ? "有多个用户名匹配，请输入更完整的用户名。" : "没有这个用户名，已返回用户管理。");
      return;
    }
    setMessage("");
    setFocusId(hit.id);
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await createMember({ data: { email, password, days } });
      setEmail("");
      setPassword("");
      setDays("30");
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "没有添加");
    }
  }

  async function run(task: () => Promise<unknown>) {
    setMessage("");
    try {
      await task();
      setPicked([]);
      setConfirmIds(null);
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "没有完成");
    }
  }

  if (isPending || (user && !ready)) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="h-10 w-40 rounded-full bg-surface" />
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const shown = rows;
  const selectable = rows.filter((member) => !member.isAdmin);
  const focus = rows.find((member) => member.id === focusId) ?? null;

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function batch(action: "disable" | "enable" | "renew" | "delete", ids = picked) {
    await run(() => batchMembers({ data: { userIds: ids, action, days: action === "renew" ? batchDays : undefined } }));
    if (action === "delete") setFocusId(null);
  }

  return (
    <RequireAccess>
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">用户。</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          用 Google 或 X 注册的，名字旁边会有对应标记。本站注册的不标记。密码已加密，不能查看，只能重设。
        </p>
        {!admin ? <p className="mt-8 text-sm text-muted">只有管理员可以管理用户。</p> : null}
        {admin ? (
          <>
            <form onSubmit={add} className="card-shadow mt-8 grid gap-3 rounded-3xl bg-surface p-6 md:grid-cols-4">
              <input
                type="email"
                required
                value={email}
                placeholder="邮箱"
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-2xl bg-bg px-4 text-sm outline-none"
              />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                placeholder="初始密码"
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-2xl bg-bg px-4 text-sm outline-none"
              />
              <input
                inputMode="numeric"
                value={days}
                placeholder="天数"
                onChange={(event) => setDays(event.target.value)}
                className="h-12 rounded-2xl bg-bg px-4 text-sm outline-none"
              />
              <button type="submit" className="h-12 rounded-full bg-ink text-sm font-medium text-surface">
                添加用户
              </button>
            </form>
            {message ? <p className="mt-4 text-sm text-bad">{message}</p> : null}
            <form onSubmit={findUser} className="mt-6 flex gap-3">
              <input
                value={query}
                placeholder="输入用户名查找"
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-full bg-surface px-5 text-sm outline-none card-shadow"
              />
              <button type="submit" className="h-12 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-surface">
                查找
              </button>
            </form>
            {focus ? (
              <div ref={detailRef} className="mt-4 scroll-mt-24">
                <button type="button" className="mb-3 text-sm text-muted" onClick={() => setFocusId(null)}>
                  返回全部用户
                </button>
                <MemberCard
                  member={focus}
                  picked={false}
                  onToggle={() => undefined}
                  onRun={run}
                  onDelete={() => setConfirmIds([focus.id])}
                />
              </div>
            ) : (
              <div ref={listRef} className="scroll-mt-24">
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                className="text-muted"
                onClick={() => setPicked(picked.length === selectable.length ? [] : selectable.map((member) => member.id))}
              >
                {picked.length === selectable.length && selectable.length > 0 ? "取消全选" : "全选"}
              </button>
              {picked.length > 0 ? <span className="text-faint">已选 {picked.length}</span> : null}
            </div>
            {picked.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="h-10 rounded-full bg-surface px-3 text-sm card-shadow" onClick={() => void batch("disable")}>
                  批量停用
                </button>
                <button type="button" className="h-10 rounded-full bg-surface px-3 text-sm card-shadow" onClick={() => void batch("enable")}>
                  批量恢复
                </button>
                <input
                  value={batchDays}
                  inputMode="numeric"
                  aria-label="批量续期天数"
                  onChange={(event) => setBatchDays(event.target.value)}
                  className="h-10 w-16 rounded-full bg-surface px-3 text-sm outline-none card-shadow"
                />
                <span className="text-sm text-muted">天后到期</span>
                <button type="button" className="h-10 rounded-full bg-ink px-4 text-sm text-surface" onClick={() => void batch("renew")}>
                  保存
                </button>
                <button type="button" className="h-10 rounded-full px-3 text-sm text-bad" onClick={() => setConfirmIds(picked)}>
                  批量删除
                </button>
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {shown.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  picked={picked.includes(member.id)}
                  onToggle={() => toggle(member.id)}
                  onRun={run}
                  onDelete={() => setConfirmIds([member.id])}
                />
              ))}
            </div>
              </div>
            )}
            {confirmIds ? (
              <div className="mt-3 rounded-3xl bg-surface px-5 py-4 card-shadow">
                <p className="text-sm text-ink">确认删除这 {confirmIds.length} 个账户？删除后不能恢复。</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="h-10 rounded-full bg-ink px-4 text-sm text-surface" onClick={() => void batch("delete", confirmIds)}>
                    确认删除
                  </button>
                  <button type="button" className="h-10 rounded-full px-4 text-sm text-muted" onClick={() => setConfirmIds(null)}>
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </RequireAccess>
  );
}

function MemberCard({
  member,
  picked,
  onToggle,
  onRun,
  onDelete,
}: {
  member: Member;
  picked: boolean;
  onToggle: () => void;
  onRun: (task: () => Promise<unknown>) => Promise<void>;
  onDelete: () => void;
}) {
  const [days, setDays] = useState("30");
  const [password, setPassword] = useState("");
  const [clicksOpen, setClicksOpen] = useState(false);
  const [clicks, setClicks] = useState<StockClick[] | null>(null);
  const state = member.isAdmin ? "管理员" : member.disabled ? "已停用" : member.active ? "可访问" : "已到期";
  const label = member.name && member.name !== member.email ? member.name : member.email;
  return (
    <div>
    <article className="rounded-3xl bg-surface px-5 py-4 card-shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          {member.isAdmin ? null : (
            <input type="checkbox" checked={picked} onChange={onToggle} aria-label={`选择 ${member.email}`} className="h-4 w-4" />
          )}
          <span>{label}</span>
          {member.via.map((via) => (
            <ProviderMark key={via} via={via} />
          ))}
        </p>
        <p className="text-sm text-muted">{state}</p>
      </div>
      {label !== member.email ? <p className="mt-1 text-sm text-muted">{member.email}</p> : null}
      <p className="mt-1 text-xs text-faint">
        注册 {member.createdOn}
        {member.isAdmin ? " · 永久访问" : member.expiresOn ? ` · 到 ${member.expiresOn}` : " · 暂无期限"}
        {member.hasPassword ? " · 密码已加密" : ""}
      </p>
      <button
        type="button"
        className="mt-3 h-10 rounded-full bg-bg px-4 text-sm text-ink"
        onClick={() => {
          if (clicksOpen) {
            setClicksOpen(false);
            return;
          }
          setClicks(null);
          setClicksOpen(true);
          void listStockClicks({ data: { userId: member.id } })
            .then(setClicks)
            .catch(() => setClicks([]));
        }}
      >
        关注的股票
      </button>
      {member.isAdmin ? null : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-10 rounded-full bg-bg px-3 text-sm"
              onClick={() => void onRun(() => setMemberAccess({ data: { userId: member.id, disabled: !member.disabled } }))}
            >
              {member.disabled ? "恢复访问" : "停用"}
            </button>
            <input
              value={days}
              inputMode="numeric"
              aria-label="访问天数"
              onChange={(event) => setDays(event.target.value)}
              className="h-10 w-16 rounded-full bg-bg px-3 text-sm outline-none"
            />
            <span className="text-sm text-muted">天后到期</span>
            <button
              type="button"
              className="h-10 rounded-full bg-ink px-4 text-sm text-surface"
              onClick={() => void onRun(() => setMemberAccess({ data: { userId: member.id, days } }))}
            >
              保存
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={password}
              placeholder="新密码"
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-40 rounded-full bg-bg px-3 text-sm outline-none"
            />
            <button
              type="button"
              className="h-10 rounded-full bg-ink px-4 text-sm text-surface"
              onClick={() => void onRun(() => resetMemberPassword({ data: { userId: member.id, password } }))}
            >
              修改密码
            </button>
            <button type="button" className="h-10 rounded-full px-3 text-sm text-bad" onClick={onDelete}>
              删除
            </button>
          </div>
        </div>
      )}
    </article>
    {clicksOpen ? (
      <article className="card-shadow mt-3 max-h-80 overflow-y-auto rounded-3xl bg-surface px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-ink">关注的股票</h3>
          <button type="button" className="text-sm text-muted" onClick={() => setClicksOpen(false)}>
            收起
          </button>
        </div>
        {clicks == null ? <p className="mt-3 text-sm text-muted">读取中</p> : null}
        {clicks?.length === 0 ? <p className="mt-3 text-sm text-muted">还没有点开过股票</p> : null}
        <div className="mt-3 space-y-2">
          {clicks?.map((item) => (
            <p key={item.ticker} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-base font-bold text-ink">
                <TickerLogo ticker={item.ticker} />
                {item.ticker}
              </span>
              <span className="text-base font-bold tabular-nums text-bad">{item.hits}</span>
            </p>
          ))}
        </div>
      </article>
    ) : null}
    </div>
  );
}
