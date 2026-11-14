import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listWatch, removeWatch, type WatchItem } from "@/lib/access";
import { RequireAccess } from "@/components/require-access";
import { refreshWatch } from "@/components/watch-mark";
import { TickerLogo } from "@/components/ticker-logo";
import { getYahooCandles } from "@/lib/yahoo";

export const Route = createFileRoute("/watch")({ component: WatchPage });

function money(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function moveOf(item: WatchItem) {
  const close = Number(item.close);
  const open = Number(item.open);
  if (!Number.isFinite(close) || !Number.isFinite(open) || open <= 0) return { up: true, pct: "" };
  const pct = ((close - open) / open) * 100;
  const up = close >= open;
  const text = `${up ? "+" : ""}${pct.toFixed(2)}%`;
  return { up, pct: text };
}

function Spark({ ticker, up }: { ticker: string; up: boolean }) {
  const [points, setPoints] = useState<number[]>([]);
  useEffect(() => {
    let alive = true;
    void getYahooCandles({ data: { ticker } })
      .then((bars) => {
        if (!alive) return;
        setPoints(bars.slice(-22).map((bar) => bar.c));
      })
      .catch(() => {
        if (alive) setPoints([]);
      });
    return () => {
      alive = false;
    };
  }, [ticker]);
  if (points.length < 2) return <span className="block h-9 w-16" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const line = points
    .map((price, index) => {
      const x = (index / (points.length - 1)) * 64;
      const y = 30 - ((price - min) / span) * 26;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const color = up ? "#00a650" : "#e11d2e";
  return (
    <svg viewBox="0 0 64 34" className="h-9 w-full" aria-hidden="true">
      <path d={line} fill="none" stroke={color} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function WatchHeart({ ticker, onGone }: { ticker: string; onGone: () => void }) {
  const [white, setWhite] = useState(false);
  return (
    <button
      type="button"
      aria-label={`移出 ${ticker}`}
      title="移出自选"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (white) return;
        setWhite(true);
        void removeWatch({ data: { ticker } }).then(() => onGone());
      }}
      className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-black/5"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M12 20.4 4.4 13.1a4.8 4.8 0 0 1 6.8-6.8L12 7.1l.8-.8a4.8 4.8 0 0 1 6.8 6.8L12 20.4z"
          fill={white ? "#d1d5db" : "#e11d2e"}
          stroke={white ? "#d1d5db" : "#e11d2e"}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function WatchGlass({ color = false }: { color?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={color ? "search-glass-color absolute inset-0 size-6" : "size-6"}>
      <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke={color ? "url(#watch-glass)" : "currentColor"} strokeWidth="2.4" />
      <path d="M15.2 15.2 20 20" fill="none" stroke={color ? "url(#watch-glass)" : "currentColor"} strokeWidth="2.4" strokeLinecap="round" />
      {color ? (
        <defs>
          <linearGradient id="watch-glass" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="38%" stopColor="#9B72CB" />
            <stop offset="68%" stopColor="#D96570" />
            <stop offset="100%" stopColor="#F4B400" />
          </linearGradient>
        </defs>
      ) : null}
    </svg>
  );
}

function WatchPage() {
  const [rows, setRows] = useState<WatchItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [spark, setSpark] = useState(0);
  const [openHints, setOpenHints] = useState(false);
  const glassWave = useRef(0);

  function load() {
    return listWatch()
      .then((next) => {
        setRows(next);
        refreshWatch();
      })
      .catch(() => setRows([]));
  }

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows ?? [];
    if (!needle) return list;
    return list.filter((item) => item.ticker.toLowerCase().includes(needle));
  }, [rows, query]);

  const hints = useMemo(() => {
    const needle = draft.trim().toLowerCase();
    if (!needle) return [];
    return (rows ?? []).filter((item) => item.ticker.toLowerCase().includes(needle)).slice(0, 6);
  }, [rows, draft]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const upCount = list.filter((item) => moveOf(item).up).length;
    return { total: list.length, upCount };
  }, [rows]);

  function find(event: FormEvent) {
    event.preventDefault();
    const wave = glassWave.current + 1;
    glassWave.current = wave;
    setSpark(wave);
    window.setTimeout(() => {
      if (glassWave.current === wave) setSpark(0);
    }, 1600);
    setQuery(draft.trim());
    setOpenHints(false);
  }

  return (
    <RequireAccess>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-6">
          <div>
            <span className="text-xs font-semibold tracking-wider text-[#006747] uppercase">Watchlist</span>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">我的自选</h1>
            <p className="mt-2 text-sm text-muted">最新加入的排在最前，点击卡片进入支撑压力详情。</p>
          </div>
          {rows && stats.total > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-surface px-4 py-2.5 shadow-2xs">
              <div>
                <p className="text-[11px] text-faint">自选总数</p>
                <p className="text-lg font-bold tabular-nums text-ink">{stats.total}</p>
              </div>
              <div className="h-7 w-px bg-line" />
              <div>
                <p className="text-[11px] text-faint">今日收涨</p>
                <p className="text-lg font-bold tabular-nums text-[#00a650]">
                  {stats.upCount} <span className="text-xs font-normal text-muted">/ {stats.total}</span>
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={find} className="relative mt-6 flex w-full max-w-md items-center gap-2" autoComplete="off">
          <label className="min-w-0 flex-1">
            <span className="sr-only">查找自选代码</span>
            <input
              value={draft}
              placeholder="筛选自选股代码，例如 NVDA..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                const val = event.target.value;
                setDraft(val);
                setQuery(val);
                setOpenHints(true);
              }}
              onFocus={() => setOpenHints(true)}
              className="h-12 w-full rounded-full border border-black/10 bg-white px-5 text-sm text-ink shadow-2xs outline-none focus:border-[#006747]/40"
            />
          </label>
          <button
            type="submit"
            aria-label="查找"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-ink shadow-2xs"
          >
            <span className="relative grid size-6 place-items-center">
              {spark > 0 ? <WatchGlass key={spark} color /> : <WatchGlass />}
            </span>
          </button>
          {openHints && draft.trim() && hints.length > 0 ? (
            <ul className="absolute top-14 left-0 z-20 w-[calc(100%-3.5rem)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md">
              {hints.map((item) => (
                <li key={item.ticker}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-[#f4f3ef]"
                    onClick={() => {
                      setDraft(item.ticker);
                      setQuery(item.ticker);
                      setOpenHints(false);
                    }}
                  >
                    <TickerLogo ticker={item.ticker} />
                    {item.ticker}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>

        {rows === null ? <p className="mt-8 text-sm text-muted">正在读取自选列表...</p> : null}
        {rows && shown.length === 0 ? (
          <p className="mt-8 text-sm text-muted">{query.trim() ? "自选里没有找到该股票" : "暂无自选股票"}</p>
        ) : null}

        <ul className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => {
            const move = moveOf(item);
            const tone = move.up ? "text-[#00a650]" : "text-[#e11d2e]";
            const badge = move.up ? "bg-[#00a650]" : "bg-[#e11d2e]";
            return (
              <li key={item.ticker}>
                <div className="flex h-full items-center gap-2 rounded-2xl border border-black/5 bg-surface px-3 py-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#006747]/20 hover:bg-[#f6faf7]">
                  <WatchHeart ticker={item.ticker} onGone={() => void load()} />
                  <a
                    href={`/?q=${encodeURIComponent(item.ticker)}&from=watch`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <TickerLogo ticker={item.ticker} />
                      <span className="truncate text-lg font-bold tracking-tight text-ink">{item.ticker}</span>
                    </div>
                    <span className="min-w-0 flex-1 px-1">
                      <Spark ticker={item.ticker} up={move.up} />
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block text-base font-bold tabular-nums ${tone}`}>${money(item.close)}</span>
                      {move.pct ? (
                        <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white ${badge}`}>
                          {move.pct}
                        </span>
                      ) : null}
                    </span>
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </RequireAccess>
  );
}
