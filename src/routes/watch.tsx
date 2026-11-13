import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listWatch, removeWatch, type WatchItem } from "@/lib/access";
import { RequireAccess } from "@/components/require-access";
import { refreshWatch } from "@/components/watch-mark";
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
  if (points.length < 2) return <span className="block h-8 w-14" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const line = points
    .map((price, index) => {
      const x = (index / (points.length - 1)) * 56;
      const y = 28 - ((price - min) / span) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const color = up ? "#1d7a45" : "#d64545";
  return (
    <svg viewBox="0 0 56 32" className="h-9 w-full" aria-hidden="true">
      <path d={line} fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function WatchHeart({ ticker, onGone }: { ticker: string; onGone: () => void }) {
  const [white, setWhite] = useState(false);
  return (
    <button
      type="button"
      aria-label={`移出 ${ticker}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (white) return;
        setWhite(true);
        void removeWatch({ data: { ticker } }).then(() => onGone());
      }}
      className="grid size-8 shrink-0 place-items-center"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M12 20.4 4.4 13.1a4.8 4.8 0 0 1 6.8-6.8L12 7.1l.8-.8a4.8 4.8 0 0 1 6.8 6.8L12 20.4z"
          fill={white ? "#ffffff" : "#e7a0a0"}
          stroke={white ? "#ffffff" : "#e7a0a0"}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function WatchGlass({ color = false }: { color?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={color ? "search-glass-color absolute inset-0 size-7" : "size-7"}>
      <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke={color ? "url(#watch-glass)" : "currentColor"} strokeWidth="2.6" />
      <path d="M15.2 15.2 20 20" fill="none" stroke={color ? "url(#watch-glass)" : "currentColor"} strokeWidth="2.6" strokeLinecap="round" />
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
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="font-display text-5xl font-medium tracking-tight text-ink">我的自选</h1>
        <p className="mt-3 text-sm text-muted">最新加入的排在最前。点卡片进入详情。</p>
        <form onSubmit={find} className="relative mt-6 flex w-1/4 min-w-48 items-center gap-1" autoComplete="off">
          <label className="min-w-0 flex-1">
            <span className="sr-only">查找自选代码</span>
            <input
              value={draft}
              placeholder="查找代码"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                setDraft(event.target.value);
                setOpenHints(true);
              }}
              onFocus={() => setOpenHints(true)}
              className="h-10 w-full rounded-2xl border border-black/10 bg-white/80 px-3 text-sm text-ink outline-none"
            />
          </label>
          <button type="submit" aria-label="查找" className="grid h-9 w-9 shrink-0 place-items-center text-ink">
            <span className="relative grid size-7 place-items-center">
              {spark > 0 ? <WatchGlass key={spark} color /> : <WatchGlass />}
            </span>
          </button>
          {openHints && draft.trim() && hints.length > 0 ? (
            <ul className="absolute top-11 left-0 z-20 w-[calc(100%-2.5rem)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
              {hints.map((item) => (
                <li key={item.ticker}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm font-medium text-ink hover:bg-[#f4f3ef]"
                    onClick={() => {
                      setDraft(item.ticker);
                      setQuery(item.ticker);
                      setOpenHints(false);
                    }}
                  >
                    {item.ticker}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
        {rows === null ? <p className="mt-8 text-sm text-muted">正在读取</p> : null}
        {rows && shown.length === 0 ? (
          <p className="mt-8 text-sm text-muted">{query.trim() ? "自选里没有这只" : "暂无自选"}</p>
        ) : null}
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {shown.map((item) => {
            const move = moveOf(item);
            const tone = move.up ? "text-[#1d7a45]" : "text-[#d64545]";
            const badge = move.up ? "bg-[#1d7a45]" : "bg-[#d64545]";
            return (
              <li key={item.ticker}>
                <div className="flex h-full items-center gap-2 rounded-2xl bg-[#f4f3ef] px-2 py-3 shadow-sm transition-colors hover:bg-[#e4e1d8]">
                  <WatchHeart ticker={item.ticker} onGone={() => void load()} />
                  <a
                    href={`/?q=${encodeURIComponent(item.ticker)}&from=watch`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="w-14 shrink-0 text-lg font-bold tracking-wide text-ink">{item.ticker}</span>
                    <span className="min-w-0 flex-1">
                      <Spark ticker={item.ticker} up={move.up} />
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block text-base font-semibold tabular-nums ${tone}`}>{money(item.close)}</span>
                      {move.pct ? (
                        <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white ${badge}`}>
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
