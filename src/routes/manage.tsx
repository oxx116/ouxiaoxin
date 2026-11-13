import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ZoneChain } from "@/components/zones";
import { TickerLogo } from "@/components/ticker-logo";
import { loadBrief } from "@/lib/access";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { parseBrief, parseValueBand } from "@/lib/brief";
import {
  claimAdmin,
  deleteBreakoutEntry,
  deleteBreakoutExit,
  deleteLevel,
  listBreakoutBook,
  listBreakoutExits,
  listLevels,
  refreshQuotes,
  saveBreakoutEntry,
  saveBreakoutExit,
  saveLevel,
  type BreakoutExit,
  type BreakoutHolding,
  type Level,
} from "@/lib/levels";

export const Route = createFileRoute("/manage")({ component: ManagePage });

const empty = {
  ticker: "",
  brief: "",
  value2026: "",
  value2027: "",
  comment: "",
};

function ManagePage() {
  const { user, isPending } = useCurrentUserState();
  const [access, setAccess] = useState<"loading" | "admin" | "locked" | "open">("loading");
  const [rows, setRows] = useState<Level[]>([]);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [holdings, setHoldings] = useState<BreakoutHolding[]>([]);
  const [bookTicker, setBookTicker] = useState("");
  const [bookCost, setBookCost] = useState("");
  const [bookTake, setBookTake] = useState("");
  const [bookStop, setBookStop] = useState("");
  const [bookEditing, setBookEditing] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [dropTicker, setDropTicker] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [exits, setExits] = useState<BreakoutExit[]>([]);
  const [exitId, setExitId] = useState<number | null>(null);
  const [exitTicker, setExitTicker] = useState("");
  const [exitCost, setExitCost] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [exitEntered, setExitEntered] = useState("");
  const [exitLeft, setExitLeft] = useState("");
  const [exitQuery, setExitQuery] = useState("");
  const [exitKind, setExitKind] = useState<"全部" | "止盈" | "止损">("全部");
  const [dropExit, setDropExit] = useState<number | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [listNeedle, setListNeedle] = useState("");
  const parsed = parseBrief(draft.brief);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    loadBrief(user.id)
      .then(async (brief) => {
        if (!alive) return;
        if (!brief.isAdmin) {
          setAccess("locked");
          return;
        }
        setAccess("admin");
        try {
          setRows(await listLevels());
          setHoldings(await listBreakoutBook());
          setExits(await listBreakoutExits());
        } catch (cause) {
          if (alive) setMessage(cause instanceof Error ? cause.message : "列表没有读出来");
        }
      })
      .catch(() => {
        if (alive) setAccess("locked");
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (isPending || (user && access === "loading")) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="h-10 w-40 rounded-full bg-surface" />
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function claim() {
    setBusy(true);
    setMessage("");
    try {
      const result = await claimAdmin();
      if (!result.isAdmin) {
        setAccess("locked");
        setMessage("管理员已经确定，不能再有第二个。");
        return;
      }
      setAccess("admin");
      setRows(await listLevels());
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "没有设成管理员");
    } finally {
      setBusy(false);
    }
  }

  async function pullQuotes() {
    setBusy(true);
    setMessage("");
    try {
      const result = await refreshQuotes();
      setRows(await listLevels());
      setHoldings(await listBreakoutBook());
      setNote(`已从雅虎更新 ${result.count} 只股票的开盘价和收盘价。`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "股价没有拉下来");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await saveLevel({ data: editing == null ? draft : { ...draft, id: editing } });
      setRows(await listLevels());
      setDraft(empty);
      setEditing(null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "没有保存");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setMessage("");
    try {
      await deleteLevel({ data: { id } });
      setRows(await listLevels());
      if (editing === id) {
        setEditing(null);
        setDraft(empty);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "没有删除");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 md:py-20">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">更新位置。</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        支撑和压力贴一整段。第一行写代码，然后写「支撑」「压力」，一行一个区间。右侧突破写在对应压力那一行，例如 120-130（强）右侧突破。收盘价高于 130 算右侧突破；收盘价跌破 120 会改到破位走弱。破位走空写在对应支撑那一行，例如 320-350（强）破位走空，或 320-350（强）破位做头。名称和收盘价从 Yahoo 读取。
      </p>

      {access === "open" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void claim()}
          className="mt-8 h-12 rounded-full bg-ink px-6 text-sm font-medium text-surface disabled:opacity-60"
        >
          把这个账户设为管理员
        </button>
      ) : null}

      {access === "locked" ? <p className="mt-8 text-sm text-muted">这个账户不是管理员，不能改位置。</p> : null}

      {access === "admin" ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pullQuotes()}
            className="mt-8 h-12 rounded-full bg-ink px-6 text-sm font-medium text-surface disabled:opacity-60"
          >
            重新拉取全部股价
          </button>
          {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => setBookOpen((open) => !open)}
            className="mt-3 h-12 rounded-full bg-surface px-6 text-sm font-medium text-ink card-shadow disabled:opacity-60"
          >
            右侧突破后的累计投资收益
          </button>
          {bookOpen ? (
            <section className="card-shadow mt-4 space-y-4 rounded-3xl bg-surface p-6">
              <p className="text-sm leading-6 text-muted">
                这里只管理已经计入累计投资收益的股票。开盘价或收盘价触及止盈、止损后，会自动移出这个板块。止损必须低于止盈。
              </p>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setBusy(true);
                  setNote("");
                  void saveBreakoutEntry({
                    data: { ticker: bookTicker, cost: bookCost, takeProfit: bookTake, stopLoss: bookStop },
                  })
                    .then(async () => {
                      setRows(await listLevels());
                      setHoldings(await listBreakoutBook());
                      setNote(bookEditing ? `已修改 ${bookTicker.trim().toUpperCase()}` : `已加入 ${bookTicker.trim().toUpperCase()}`);
                      setBookTicker("");
                      setBookCost("");
                      setBookTake("");
                      setBookStop("");
                      setBookEditing(false);
                    })
                    .catch((cause) => {
                      setNote(cause instanceof Error ? cause.message : "没有写入");
                    })
                    .finally(() => setBusy(false));
                }}
              >
                <Field
                  label="股票代码"
                  value={bookTicker}
                  placeholder="例如 TSM"
                  onChange={bookEditing ? () => undefined : setBookTicker}
                />
                <Field label="建仓价格" value={bookCost} placeholder="回踩当天的收盘价" onChange={setBookCost} />
                <Field label="止盈价格" value={bookTake} placeholder="可以留空" onChange={setBookTake} />
                <Field label="止损价格" value={bookStop} placeholder="可以留空" onChange={setBookStop} />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-12 rounded-full bg-ink px-6 text-sm font-medium text-surface disabled:opacity-60"
                  >
                    {bookEditing ? "保存修改" : "添加"}
                  </button>
                  {bookEditing ? (
                    <button
                      type="button"
                      className="h-12 rounded-full px-5 text-sm text-muted"
                      onClick={() => {
                        setBookEditing(false);
                        setBookTicker("");
                        setBookCost("");
                        setBookTake("");
                        setBookStop("");
                      }}
                    >
                      取消
                    </button>
                  ) : null}
                </div>
              </form>
              <input
                value={bookQuery}
                placeholder="查找代码"
                onChange={(event) => setBookQuery(event.target.value)}
                className="h-12 w-full rounded-full bg-bg px-5 text-base text-ink outline-none placeholder:text-faint"
              />
              <div className="space-y-3">
                {holdings
                  .filter((item) => item.ticker.includes(bookQuery.trim().toUpperCase()))
                  .map((item) => {
                    const cost = Number(item.cost);
                    const close = Number(item.close);
                    const ret = Number.isFinite(cost) && cost > 0 && Number.isFinite(close) ? (close - cost) / cost : null;
                    return (
                      <article key={item.ticker} className="rounded-2xl bg-bg px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            <TickerLogo ticker={item.ticker} />
                            {item.ticker}
                          </p>
                          <p className={`text-sm font-semibold tabular-nums ${ret == null ? "text-muted" : ret > 0 ? "text-[#00a650]" : ret < 0 ? "text-bad" : "text-muted"}`}>
                            {ret == null ? "—" : `${ret > 0 ? "+" : ret < 0 ? "-" : ""}${Math.abs(ret * 100).toFixed(2)}%`}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-muted">
                          建仓 {item.cost}
                          {item.enteredOn ? ` · ${item.enteredOn}` : ""}
                          {item.close ? ` · 现价 ${item.close}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          止盈 {item.takeProfit || "未设"} · 止损 {item.stopLoss || "未设"}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="h-9 rounded-full bg-surface px-4 text-sm text-ink"
                            onClick={() => {
                              setBookEditing(true);
                              setBookTicker(item.ticker);
                              setBookCost(item.cost);
                              setBookTake(item.takeProfit);
                              setBookStop(item.stopLoss);
                              setDropTicker("");
                            }}
                          >
                            修改
                          </button>
                          {dropTicker === item.ticker ? (
                            <button
                              type="button"
                              className="h-9 rounded-full bg-bad px-4 text-sm text-white"
                              onClick={() => {
                                setBusy(true);
                                void deleteBreakoutEntry({ data: { ticker: item.ticker } })
                                  .then(async () => {
                                    setRows(await listLevels());
                                    setHoldings(await listBreakoutBook());
                                    setDropTicker("");
                                    setNote(`已移出 ${item.ticker}`);
                                  })
                                  .catch((cause) => setNote(cause instanceof Error ? cause.message : "没有删除"))
                                  .finally(() => setBusy(false));
                              }}
                            >
                              确认删除
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="h-9 rounded-full px-4 text-sm text-bad"
                              onClick={() => setDropTicker(item.ticker)}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                {holdings.filter((item) => item.ticker.includes(bookQuery.trim().toUpperCase())).length === 0 ? (
                  <p className="text-sm text-muted">暂无</p>
                ) : null}
              </div>
            </section>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => setExitOpen((open) => !open)}
            className="mt-3 h-12 rounded-full bg-surface px-6 text-sm font-medium text-ink card-shadow disabled:opacity-60"
          >
            历史止盈和历史止损
          </button>
          {exitOpen ? (
            <section className="card-shadow mt-4 space-y-4 rounded-3xl bg-surface p-6">
              <p className="text-sm leading-6 text-muted">
                离场价高于建仓价记为止盈，低于建仓价记为止损。改完会重新算进累计收益。
              </p>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setBusy(true);
                  setNote("");
                  void saveBreakoutExit({
                    data: {
                      id: exitId,
                      ticker: exitTicker,
                      cost: exitCost,
                      exitPrice,
                      enteredOn: exitEntered,
                      exitedOn: exitLeft,
                    },
                  })
                    .then(async (saved) => {
                      setExits(await listBreakoutExits());
                      setNote(exitId == null ? `已加入${saved.kind} ${saved.ticker}` : `已修改 ${saved.ticker}`);
                      setExitId(null);
                      setExitTicker("");
                      setExitCost("");
                      setExitPrice("");
                      setExitEntered("");
                      setExitLeft("");
                    })
                    .catch((cause) => setNote(cause instanceof Error ? cause.message : "没有写入"))
                    .finally(() => setBusy(false));
                }}
              >
                <Field label="股票代码" value={exitTicker} placeholder="例如 TSM" onChange={setExitTicker} />
                <Field label="建仓价格" value={exitCost} placeholder="成本" onChange={setExitCost} />
                <Field label="离场价格" value={exitPrice} placeholder="止盈或止损时的价格" onChange={setExitPrice} />
                <Field label="建仓日期" value={exitEntered} placeholder="2026-11-10，可留空" onChange={setExitEntered} />
                <Field label="离场日期" value={exitLeft} placeholder="2026-11-10，可留空" onChange={setExitLeft} />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-12 rounded-full bg-ink px-6 text-sm font-medium text-surface disabled:opacity-60"
                  >
                    {exitId == null ? "添加" : "保存修改"}
                  </button>
                  {exitId != null ? (
                    <button
                      type="button"
                      className="h-12 rounded-full px-5 text-sm text-muted"
                      onClick={() => {
                        setExitId(null);
                        setExitTicker("");
                        setExitCost("");
                        setExitPrice("");
                        setExitEntered("");
                        setExitLeft("");
                      }}
                    >
                      取消
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="flex gap-2">
                {(["全部", "止盈", "止损"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`h-9 rounded-full px-4 text-sm ${exitKind === kind ? "bg-ink text-surface" : "bg-bg text-muted"}`}
                    onClick={() => setExitKind(kind)}
                  >
                    {kind}
                  </button>
                ))}
              </div>
              <input
                value={exitQuery}
                placeholder="查找代码"
                onChange={(event) => setExitQuery(event.target.value)}
                className="h-12 w-full rounded-full bg-bg px-5 text-base text-ink outline-none placeholder:text-faint"
              />
              <div className="space-y-3">
                {exits
                  .filter((item) => (exitKind === "全部" ? true : item.kind === exitKind))
                  .filter((item) => item.ticker.includes(exitQuery.trim().toUpperCase()))
                  .map((item) => (
                    <article key={item.id} className="rounded-2xl bg-bg px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 font-semibold text-ink">
                          <TickerLogo ticker={item.ticker} />
                          {item.ticker}
                        </p>
                        <p className={`text-sm font-semibold ${item.kind === "止盈" ? "text-[#00a650]" : "text-bad"}`}>
                          {item.kind}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        建仓 {item.cost}
                        {item.enteredOn ? ` · ${item.enteredOn}` : ""}
                        {" · "}离场 {item.exitPrice}
                        {item.exitedOn ? ` · ${item.exitedOn}` : ""}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="h-9 rounded-full bg-surface px-4 text-sm text-ink"
                          onClick={() => {
                            setExitId(item.id);
                            setExitTicker(item.ticker);
                            setExitCost(item.cost);
                            setExitPrice(item.exitPrice);
                            setExitEntered(item.enteredOn);
                            setExitLeft(item.exitedOn);
                            setDropExit(null);
                          }}
                        >
                          修改
                        </button>
                        {dropExit === item.id ? (
                          <button
                            type="button"
                            className="h-9 rounded-full bg-bad px-4 text-sm text-white"
                            onClick={() => {
                              setBusy(true);
                              void deleteBreakoutExit({ data: { id: item.id } })
                                .then(async () => {
                                  setExits(await listBreakoutExits());
                                  setDropExit(null);
                                  if (exitId === item.id) {
                                    setExitId(null);
                                    setExitTicker("");
                                    setExitCost("");
                                    setExitPrice("");
                                    setExitEntered("");
                                    setExitLeft("");
                                  }
                                  setNote(`已删除 ${item.ticker}`);
                                })
                                .catch((cause) => setNote(cause instanceof Error ? cause.message : "没有删除"))
                                .finally(() => setBusy(false));
                            }}
                          >
                            确认删除
                          </button>
                        ) : (
                          <button type="button" className="h-9 rounded-full px-4 text-sm text-bad" onClick={() => setDropExit(item.id)}>
                            删除
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                {exits.filter((item) => (exitKind === "全部" ? true : item.kind === exitKind) && item.ticker.includes(exitQuery.trim().toUpperCase())).length === 0 ? (
                  <p className="text-sm text-muted">暂无</p>
                ) : null}
              </div>
            </section>
          ) : null}
          <form onSubmit={save} className="card-shadow mt-6 space-y-3 rounded-3xl bg-surface p-6">
            <div className="grid gap-3">
              <Field
                label="代码"
                value={draft.ticker}
                placeholder="不填则用正文第一行"
                onChange={(ticker) => setDraft({ ...draft, ticker })}
              />
              <label className="block text-sm text-muted">
                快评
                <textarea
                  value={draft.comment}
                  rows={8}
                  placeholder="对这只股票的看法。用户搜索后会显示在代码下方。"
                  onChange={(event) => setDraft({ ...draft, comment: event.target.value })}
                  className="mt-1 w-full rounded-2xl bg-bg px-4 py-3 text-base leading-6 text-ink outline-none"
                />
              </label>
            </div>
            <label className="block text-sm text-muted">
              支撑和压力
              <textarea
                value={draft.brief}
                rows={14}
                placeholder={"TSM\n支撑\n320-350（强）长线\n\n压力\n360-378（强）长线\n410-424（强）右侧突破"}
                onChange={(event) => {
                  const brief = event.target.value;
                  const next = parseBrief(brief);
                  setDraft((current) => ({
                    ...current,
                    brief,
                    ticker: current.ticker || next.ticker,
                  }));
                }}
                className="mt-1 w-full rounded-2xl bg-bg px-4 py-3 text-base leading-6 text-ink outline-none"
              />
            </label>
            <ValueField
              label="2026 价值交易区间"
              value={draft.value2026}
              placeholder={"258-476\n也可以贴一整段，我会切出区间"}
              onChange={(value2026) => setDraft({ ...draft, value2026 })}
            />
            <ValueField
              label="2027 价值交易区间"
              value={draft.value2027}
              placeholder={"333-614"}
              onChange={(value2027) => setDraft({ ...draft, value2027 })}
            />
            {draft.brief.trim() ? (
              <div>
                <p className="text-xs text-faint">
                  切出支撑 {parsed.support.length} 档，压力 {parsed.resistance.length} 档
                  {parsed.ticker ? `，代码 ${parsed.ticker}` : ""}
                </p>
                <ZoneChain support={parsed.support} resistance={parsed.resistance} close="" />
                {parsed.skipped.length > 0 ? (
                  <p className="mt-3 text-sm text-bad">没切开：{parsed.skipped.join("、")}</p>
                ) : null}
              </div>
            ) : null}
            {message ? <p className="text-sm text-bad">{message}</p> : null}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="h-11 rounded-full bg-ink px-5 text-sm font-medium text-surface disabled:opacity-60"
              >
                {editing == null ? "添加" : "保存"}
              </button>
              {editing != null ? (
                <button
                  type="button"
                  className="h-11 rounded-full px-4 text-sm text-muted"
                  onClick={() => {
                    setEditing(null);
                    setDraft(empty);
                  }}
                >
                  取消
                </button>
              ) : null}
            </div>
          </form>

          <form
            className="relative mt-6 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setListNeedle(listQuery.trim().toUpperCase());
            }}
          >
            <div className="relative min-w-0 flex-1">
              <input
                value={listQuery}
                placeholder="搜索已添加的代码，例如 TSM"
                autoComplete="off"
                onChange={(event) => {
                  const next = event.target.value;
                  setListQuery(next);
                  setListNeedle(next.trim().toUpperCase());
                }}
                className="card-shadow h-12 w-full rounded-full bg-surface px-5 text-base text-ink outline-none placeholder:text-faint"
              />
              {listQuery.trim() ? (
                <ul className="card-shadow absolute top-14 z-10 w-full overflow-hidden rounded-3xl bg-surface">
                  {rows
                    .filter((level) => {
                      const needle = listQuery.trim().toUpperCase();
                      return (
                        level.ticker.toUpperCase().includes(needle) || level.name.toUpperCase().includes(needle)
                      );
                    })
                    .slice(0, 8)
                    .map((level) => (
                      <li key={level.id} className="border-b border-line last:border-0">
                        <button
                          type="button"
                          className="flex h-12 w-full items-center justify-between px-5 text-left"
                          onClick={() => {
                            setListQuery(level.ticker);
                            setListNeedle(level.ticker.toUpperCase());
                          }}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <TickerLogo ticker={level.ticker || level.name} />
                            {level.ticker || level.name}
                          </span>
                          {level.name && level.ticker ? (
                            <span className="truncate pl-3 text-sm text-faint">{level.name}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  {rows.every((level) => {
                    const needle = listQuery.trim().toUpperCase();
                    return !level.ticker.toUpperCase().includes(needle) && !level.name.toUpperCase().includes(needle);
                  }) ? (
                    <li className="px-5 py-3 text-sm text-muted">没有这只股票</li>
                  ) : null}
                </ul>
              ) : null}
            </div>
            <button type="submit" className="h-12 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-surface">
              搜索
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {rows
              .filter((level) => {
                if (!listNeedle) return true;
                return level.ticker.toUpperCase().includes(listNeedle) || level.name.toUpperCase().includes(listNeedle);
              })
              .map((level) => {
              const brief = parseBrief(level.brief);
              return (
                <div key={level.id} className="flex items-center justify-between gap-3 rounded-3xl bg-surface px-5 py-4 card-shadow">
                  <div>
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <TickerLogo ticker={level.ticker || level.name} />
                        {level.ticker || level.name}
                      </span>
                      <span className="text-xs text-faint">修改日期 {level.updatedOn}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {level.name && level.name !== level.ticker ? `${level.name} · ` : ""}
                      支撑 {brief.support.length} 档 · 压力 {brief.resistance.length} 档
                      {level.lastClose ? ` · 收盘 ${level.lastClose}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      2026 {valueText(level.value2026)} · 2027 {valueText(level.value2027)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="h-10 rounded-full px-3 text-sm text-ink"
                      onClick={() => {
                        setEditing(level.id);
                        setDraft({
                          ticker: level.ticker,
                          brief: level.brief,
                          value2026: level.value2026,
                          value2027: level.value2027,
                          comment: level.comment,
                        });
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-full px-3 text-sm text-bad"
                      onClick={() => void remove(level.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
            {listNeedle &&
            rows.every(
              (level) =>
                !level.ticker.toUpperCase().includes(listNeedle) && !level.name.toUpperCase().includes(listNeedle),
            ) ? (
              <p className="text-sm text-muted">没有这只股票</p>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}

function valueText(raw: string) {
  const band = parseValueBand(raw);
  return band ? `${band.low}–${band.high}` : "暂无数据";
}

function ValueField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const band = parseValueBand(value);
  return (
    <label className="block text-sm text-muted">
      {label}
      <textarea
        value={value}
        rows={4}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl bg-bg px-4 py-3 text-base leading-6 text-ink outline-none placeholder:text-faint"
      />
      {value.trim() ? (
        <span className={`mt-1 block text-xs ${band ? "text-faint" : "text-bad"}`}>
          {band ? `切出 ${band.low}–${band.high}，中位数 ${Math.round((band.low + band.high) / 2)}` : "没切开区间"}
        </span>
      ) : (
        <span className="mt-1 block text-xs text-faint">暂无数据</span>
      )}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-2xl bg-bg px-4 text-base text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}
