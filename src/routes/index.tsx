import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { RequireAccess } from "@/components/require-access";
import { createFileRoute } from "@tanstack/react-router";
import { TickerLogo } from "@/components/ticker-logo";
import { ZoneChain } from "@/components/zones";
import { etDateLabel, isRightBreak, listedBoard, parseBrief, parseValueBand, rightBreakZone, usCashCloseLabel, usEasternStamp, watchMatch, type WatchState } from "@/lib/brief";
import { noteStockClick, firstArrival } from "@/lib/access";
import { useShortcutLabel } from "@/components/command-search";
import { WelcomeSplash } from "@/components/welcome-splash";
import { WatchMark } from "@/components/watch-mark";
import { listHome, type BreakoutExit, type Level, type WatchMove } from "@/lib/levels";
import { getYahooCandles, getYahooFacts, type YahooCandle, type YahooFacts } from "@/lib/yahoo";
import { ThreeCandleCard } from "@/components/three-candle";

export const Route = createFileRoute("/")({ component: Home });

function showPrice(raw: string) {
  if (!raw) return "—";
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

function matchesQuery(level: Level, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return level.ticker.toLowerCase().includes(needle) || level.name.toLowerCase().includes(needle);
}

const nasdaq100 = [
  "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "WMT", "COST",
  "MU", "AMD", "NFLX", "INTC", "CSCO", "PLTR", "AMAT", "LRCX", "TXN", "QCOM",
  "AMGN", "PEP", "SBUX", "PYPL", "ADBE", "INTU", "PANW", "CRWD", "SHOP", "BKNG",
  "ISRG", "ARM", "ASML", "APP", "LIN", "GILD", "ADI", "TMUS", "KLAC", "MRVL",
  "SNPS", "CDNS", "MELI", "PDD", "ABNB", "DASH", "DDOG", "WDAY", "ADSK", "FTNT",
  "AXON", "MAR", "CTAS", "ORLY", "ROST", "MDLZ", "KDP", "HON", "CSX", "PCAR",
  "ODFL", "FAST", "PAYX", "ADP", "CPRT", "CEG", "AEP", "EXC", "XEL", "VRTX",
  "REGN", "MRNA", "ALNY", "IDXX", "DXCM", "GEHC", "BKR", "FANG", "CCEP", "CMCSA",
  "TTWO", "MSTR", "CRWV", "RKLB", "SPCX", "SNDK", "STX", "WDC", "LITE", "MPWR",
  "MCHP", "NXPI", "ALAB", "TER", "NBIS", "FER", "TRI", "ROP",
];

function SearchGlass({ color = false }: { color?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={color ? "search-glass-color absolute inset-0 size-8" : "size-8"}>
      <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke={color ? "url(#gemini-glass)" : "currentColor"} strokeWidth="2.4" />
      <path d="M15.2 15.2 20 20" fill="none" stroke={color ? "url(#gemini-glass)" : "currentColor"} strokeWidth="2.4" strokeLinecap="round" />
      {color ? (
        <defs>
          <linearGradient id="gemini-glass" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
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

function LogoMarquee({ className = "" }: { className?: string }) {
  const row = [...nasdaq100, ...nasdaq100];
  return (
    <div className={`overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] ${className}`} aria-label="纳指100成分股标志">
      <div className="logo-marquee-track flex w-max items-center gap-3 pr-3">
        {row.map((ticker, index) => (
          <img
            key={`${ticker}-${index}`}
            src={`https://assets.parqet.com/logos/symbol/${ticker}`}
            alt=""
            title={ticker}
            width={36}
            height={36}
            className="ticker-mark h-9 w-9 shrink-0 rounded-xl border border-black/5 bg-white/90 object-contain p-1 shadow-2xs"
            loading="lazy"
            decoding="async"
            onError={(event) => event.currentTarget.remove()}
          />
        ))}
      </div>
    </div>
  );
}

function Home() {
  const [rows, setRows] = useState<Level[] | null>(null);
  const [moves, setMoves] = useState<WatchMove[]>([]);
  const [boardEntered, setBoardEntered] = useState<Record<string, string>>({});
  const [exits, setExits] = useState<BreakoutExit[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [focus, setFocus] = useState<WatchState | "变动" | null>(null);
  const [spark, setSpark] = useState(0);
  const [openTick, setOpenTick] = useState(0);
  const [hello, setHello] = useState<"" | "new" | "back">("");
  const [fromWatch, setFromWatch] = useState(false);
  const notedTick = useRef(0);
  const glassWave = useRef(0);
  const keys = useShortcutLabel();

  useEffect(() => {
    const oauth = sessionStorage.getItem("mt-oauth-hello") === "1";
    const back = sessionStorage.getItem("mt-welcome-back") === "1";
    if (!oauth && !back) return;
    sessionStorage.removeItem("mt-oauth-hello");
    sessionStorage.removeItem("mt-welcome-back");
    void firstArrival()
      .then((row) => {
        const key = row?.id ? `mt-welcomed:${row.id}` : "";
        const seen = key ? localStorage.getItem(key) === "1" : false;
        if (row?.fresh && row.id && !seen) {
          localStorage.setItem(key, "1");
          setHello("new");
          return;
        }
        setHello("back");
      })
      .catch(() => setHello("back"));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "watch") setFromWatch(true);
    const q = params.get("q")?.trim();
    if (!q) return;
    setQuery(q);
    setSubmitted(q);
  }, []);

  useEffect(() => {
    let alive = true;
    listHome()
      .then((next) => {
        if (!alive) return;
        setRows(next.levels);
        setMoves(next.moves);
        setBoardEntered(next.boardEntered ?? {});
        setExits(next.exits ?? []);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const reset = () => {
      setQuery("");
      setSubmitted("");
      setFocus(null);
    };
    window.addEventListener("app-home", reset);
    const find = (event: Event) => {
      const ticker = String((event as CustomEvent<string>).detail ?? "").trim();
      if (!ticker) return;
      setFocus(null);
      setQuery(ticker);
      setSubmitted(ticker);
      setOpenTick((tick) => tick + 1);
    };
    window.addEventListener("app-find", find);
    return () => {
      window.removeEventListener("app-home", reset);
      window.removeEventListener("app-find", find);
    };
  }, []);

  useEffect(() => {
    if (!submitted.trim()) return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, [submitted]);

  const needle = submitted.trim().toLowerCase();
  const matches = needle ? (rows?.filter((level) => matchesQuery(level, submitted)) ?? []) : [];
  const exact = matches.find(
    (level) => level.ticker.toLowerCase() === needle || level.name.toLowerCase() === needle,
  );
  const shown = !needle ? null : matches.length === 1 ? matches[0] : (exact ?? null);
  const choices = shown || !needle ? [] : matches;

  function openStock(value: string) {
    setQuery(value);
    setSubmitted(value);
    setOpenTick((tick) => tick + 1);
  }

  function search(event: FormEvent) {
    event.preventDefault();
    const wave = glassWave.current + 1;
    glassWave.current = wave;
    setSpark(wave);
    window.setTimeout(() => {
      if (glassWave.current === wave) setSpark(0);
    }, 1600);
    openStock(query.trim());
  }

  useEffect(() => {
    if (!openTick || notedTick.current === openTick) return;
    const ticker = shown?.ticker?.trim();
    if (!ticker) return;
    notedTick.current = openTick;
    void noteStockClick({ data: { ticker } }).catch(() => undefined);
  }, [openTick, shown?.ticker]);

  useEffect(() => {
    if (!shown) return;
    const previous = document.body.style.background;
    document.body.style.background = "#f4f3ef";
    return () => {
      document.body.style.background = previous;
    };
  }, [shown]);

  return (
    <RequireAccess>
      {hello ? (
        <WelcomeSplash line={hello === "back" ? "歡迎回來" : "歡迎"} onDone={() => setHello("")} />
      ) : null}
      <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 md:pb-16">
        <div className={focus || shown ? "hidden" : undefined}>
          <section className="mx-auto w-full max-w-2xl px-2 pb-2 pt-8 text-center md:pt-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#006747]/15 bg-[#006747]/5 px-3.5 py-1 text-xs font-medium text-[#006747]">
              <span className="size-1.5 rounded-full bg-[#00a650]" />
              MetricTrader · 美股右侧量化监测终端
            </div>
            <h1 className="mt-4 font-latin text-4xl font-semibold tracking-[0.03em] text-[#006747] md:text-5xl">
              <span className="text-ink">F</span>ind <span className="text-ink">a</span> <span className="text-ink">S</span>tock
            </h1>
            <form onSubmit={search} className="mx-auto mt-6 flex items-center gap-2.5 text-left">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search ticker or name</span>
                <input
                  id="stock-search"
                  value={query}
                  placeholder="输入美股代码或名称，例如 TSM、NVDA..."
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-14 w-full rounded-full border border-black/10 bg-white px-6 pr-20 text-base text-ink shadow-sm transition-shadow outline-none placeholder:text-faint focus:border-[#006747]/40 focus:ring-4 focus:ring-[#006747]/10 md:text-lg"
                />
                <kbd className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded-lg border border-black/10 bg-[#f8f8f6] px-2 py-0.5 text-[11px] font-medium tracking-wide text-faint">
                  {keys}
                </kbd>
              </label>
              <button
                type="submit"
                aria-label="Search"
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-ink shadow-sm transition-transform hover:scale-105 active:scale-95"
              >
                <span className="relative grid size-8 place-items-center">
                  {spark > 0 ? <SearchGlass key={spark} color /> : <SearchGlass />}
                </span>
              </button>
            </form>

            {failed ? <p className="mt-6 text-sm font-medium text-bad">位置数据暂时无法读取，请刷新重试。</p> : null}

            {choices.length > 0 ? (
              <ul className="card-shadow mt-3 overflow-hidden rounded-3xl border border-black/5 bg-surface">
                {choices.map((level) => (
                  <li key={level.id} className="flex items-center border-b border-line last:border-0">
                    <button
                      type="button"
                      className="flex h-14 min-w-0 flex-1 items-center justify-between px-6 text-left transition-colors hover:bg-[#f4f7f5]"
                      onClick={() => openStock(level.ticker || level.name)}
                    >
                      <span className="flex items-center gap-2.5 font-bold text-ink">
                        <TickerLogo ticker={level.ticker || level.name} />
                        {level.ticker || level.name}
                      </span>
                      {level.name && level.ticker ? <span className="truncate pl-4 text-sm text-faint">{level.name}</span> : null}
                    </button>
                    <span className="pr-4">
                      <WatchMark ticker={level.ticker || level.name} quiet />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {needle && rows && matches.length === 0 ? (
              <p className="mt-6 text-sm text-muted">无观察结果，敬请期待</p>
            ) : null}
          </section>
          {needle ? null : <LogoMarquee className="mt-5 pb-2" />}
        </div>

        {needle ? null : (
          <WatchCards
            rows={rows ?? []}
            moves={moves}
            entered={boardEntered}
            focus={focus}
            onFocus={setFocus}
            onOpen={(level) => {
              setQuery(level.ticker || level.name);
              openStock(level.ticker || level.name);
            }}
          />
        )}

        {needle || focus ? null : (
          <BreakoutReturnCard
            rows={rows ?? []}
            exits={exits}
            onOpen={(ticker) => {
              openStock(ticker);
            }}
          />
        )}

        {shown ? (
          <StockPanel
            level={shown}
            backHref={fromWatch ? "/watch" : ""}
            onBack={() => {
              setQuery("");
              setSubmitted("");
              window.scrollTo(0, 0);
            }}
          />
        ) : null}
      </main>
    </RequireAccess>
  );
}

function easternDay(day: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function signedMoney(value: number) {
  const text = Math.abs(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

function signedReturn(value: number) {
  const text = `${Math.abs(value * 100).toFixed(2)}%`;
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

function sessionMove(open: string, close: string) {
  const start = Number(open);
  const end = Number(close);
  if (!open || !close || !Number.isFinite(start) || !Number.isFinite(end)) return { mark: "", tone: "text-ink" };
  if (end > start) return { mark: "▲", tone: "text-[#00a650]" };
  if (end < start) return { mark: "▼", tone: "text-bad" };
  return { mark: "―", tone: "text-ink" };
}

function sessionTone(open: string, close: string) {
  return sessionMove(open, close).tone;
}

function pnlTone(value: number) {
  if (value > 0) return "text-[#00a650]";
  if (value < 0) return "text-bad";
  return "text-[#8e8e93]";
}

function pnlPill(value: number) {
  if (value > 0) return "bg-[#00a650]";
  if (value < 0) return "bg-[#e11d2e]";
  return "bg-[#8e8e93]";
}

function Stamp({ word, color }: { word: "WIN" | "LOSS"; color: string }) {
  return (
    <svg viewBox="0 0 88 88" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-16 w-16 -translate-y-1/2 -rotate-12 opacity-85">
      <circle cx="44" cy="44" r="36" fill="none" stroke={color} strokeWidth="2.4" />
      <circle cx="44" cy="44" r="30" fill="none" stroke={color} strokeWidth="1" />
      <text
        x="44"
        y="49"
        textAnchor="middle"
        fill={color}
        fontSize={word === "WIN" ? "18" : "13"}
        fontWeight="700"
        letterSpacing="1.5"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        {word}
      </text>
    </svg>
  );
}

function BreakoutReturnCard({
  rows,
  exits,
  onOpen,
}: {
  rows: Level[];
  exits: BreakoutExit[];
  onOpen: (ticker: string) => void;
}) {
  const [page, setPage] = useState<"止盈" | "止损" | null>(null);
  const items = rows.flatMap((level) => {
    if (level.rightPhase !== "in") return [];
    const cost = Number(level.rightCost);
    const close = Number(level.lastClose);
    if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(close)) return [];
    const pnl = close - cost;
    return [
      {
        ticker: level.ticker || level.name,
        cost,
        close,
        pnl,
        ret: pnl / cost,
        costDate: easternDay(level.rightEnteredOn),
        closeDate: etDateLabel(level.closeAt),
        open: level.lastOpen,
      },
    ];
  });
  const closed = exits.flatMap((exit) => {
    const cost = Number(exit.cost);
    const price = Number(exit.exitPrice);
    if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(price)) return [];
    const pnl = price - cost;
    return [{ ...exit, cost, price, pnl, ret: pnl / cost }];
  });
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0) + closed.reduce((sum, item) => sum + item.cost, 0);
  const totalValue =
    items.reduce((sum, item) => sum + item.close, 0) + closed.reduce((sum, item) => sum + item.price, 0);
  const total = totalCost <= 0 ? null : (totalValue - totalCost) / totalCost;
  const history = page ? closed.filter((item) => item.kind === page) : [];
  return (
    <section className="mx-auto mt-6 w-full max-w-5xl rounded-3xl border border-black/5 bg-[#f3f4f6] px-4 py-5 shadow-xs md:px-6">
      <div className="flex items-end justify-between gap-4 border-b border-black/10 pb-3.5">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">Portfolio Performance</span>
          <h2 className="text-xl font-bold tracking-tight text-ink">Cumulative Return</h2>
        </div>
        <p className={`text-3xl font-bold tabular-nums tracking-tight ${total == null ? "text-ink" : pnlTone(total)}`}>
          {total == null ? "—" : signedReturn(total)}
        </p>
      </div>
      {page ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPage(null)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink shadow-xs transition-colors hover:bg-[#eef6ef]"
          >
            <span aria-hidden="true">←</span>
            返回 Holdings
          </button>
          <h3 className="mt-4 font-latin text-2xl font-medium tracking-[0.04em] text-[#006747]">
            {page === "止盈" ? "历史止盈" : "历史止损"}
          </h3>
          {history.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpen(item.ticker)}
                  className="rounded-2xl border border-black/5 bg-surface px-4 py-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:bg-[#eef6ef]"
                >
                  <p className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                    <TickerLogo ticker={item.ticker} />
                    {item.ticker}
                  </p>
                  <div className="mt-2.5 flex items-end justify-between gap-2 border-b border-line pb-2">
                    <div>
                      <p className="text-[11px] text-faint">Entry</p>
                      <p className="text-base font-semibold tabular-nums text-ink">{showPrice(String(item.cost))}</p>
                    </div>
                    {item.enteredOn ? <p className="text-[11px] text-muted">ET {item.enteredOn}</p> : null}
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2 border-b border-line pb-2">
                    <div>
                      <p className="text-[11px] text-faint">离场价格</p>
                      <p className="text-base font-semibold tabular-nums text-ink">{showPrice(String(item.price))}</p>
                    </div>
                    {item.exitedOn ? <p className="text-[11px] text-muted">ET {item.exitedOn}</p> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-faint">收益率</span>
                    <span className={`text-sm font-bold tabular-nums ${pnlTone(item.ret)}`}>{signedReturn(item.ret)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">暂无</p>
          )}
        </div>
      ) : (
        <>
          <section className="mt-4 rounded-2xl border border-black/5 bg-surface px-4 py-3.5 shadow-xs">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-latin text-2xl font-medium tracking-[0.04em] text-[#006747]">Holdings</h3>
              <span className="text-xs text-muted">共 {items.length} 只持仓</span>
            </div>
            {items.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => onOpen(item.ticker)}
                    className={`rounded-xl border px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 ${
                      item.pnl > 0
                        ? "border-[#00a650]/15 bg-[#e7f6ec] hover:bg-[#d9f0e2]"
                        : item.pnl < 0
                          ? "border-[#e11d2e]/15 bg-[#fdeceb] hover:bg-[#f8ddd9]"
                          : "border-black/5 bg-bg hover:bg-[#eef6ef]"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                      <TickerLogo ticker={item.ticker} />
                      {item.ticker}
                    </p>
                    <div className="mt-2.5 flex items-end justify-between gap-2 border-b border-line pb-2">
                      <div>
                        <p className="text-[11px] text-faint">Entry</p>
                        <p className="text-base font-semibold tabular-nums tracking-tight text-ink">{showPrice(String(item.cost))}</p>
                      </div>
                      {item.costDate ? (
                        <p className="text-right text-[11px] text-muted">ET {item.costDate}</p>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2 border-b border-line pb-2">
                      <div>
                        <p className="text-[11px] text-faint">Close</p>
                        <p className={`text-base font-semibold tabular-nums tracking-tight ${sessionTone(item.open, String(item.close))}`}>
                          <span className="mr-1">{sessionMove(item.open, String(item.close)).mark}</span>
                          {showPrice(String(item.close))}
                        </p>
                      </div>
                      {item.closeDate ? (
                        <p className="text-right text-[11px] text-muted">ET {item.closeDate}</p>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-faint">Change</p>
                        <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-white ${pnlPill(item.pnl)}`}>
                          {signedMoney(item.pnl)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-faint">Return</p>
                        <p className={`text-lg font-bold tabular-nums tracking-tight ${pnlTone(item.ret)}`}>{signedReturn(item.ret)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 px-1 text-sm text-muted">暂无</p>
            )}
          </section>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPage("止盈")}
              className="relative overflow-hidden rounded-2xl border border-black/5 bg-surface px-4 py-3.5 pr-24 text-left text-[#006747] shadow-xs transition-colors hover:bg-[#e8f6ee]"
            >
              <span className="block font-latin text-lg font-semibold tracking-[0.03em]">历史止盈</span>
              <span className="mt-0.5 block text-xs text-muted">盈利离场 ({closed.filter((i) => i.kind === "止盈").length})</span>
              <Stamp word="WIN" color="#14804a" />
            </button>
            <button
              type="button"
              onClick={() => setPage("止损")}
              className="relative overflow-hidden rounded-2xl border border-black/5 bg-surface px-4 py-3.5 pr-24 text-left text-bad shadow-xs transition-colors hover:bg-[#fdeceb]"
            >
              <span className="block font-latin text-lg font-semibold tracking-[0.03em]">历史止损</span>
              <span className="mt-0.5 block text-xs text-muted">亏损离场 ({closed.filter((i) => i.kind === "止损").length})</span>
              <Stamp word="LOSS" color="#8e8e93" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function moveDate(iso: string) {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** 区间位置可视化进度条组件 */
function MiniZoneBar({
  lowRaw,
  highRaw,
  closeRaw,
  kind,
}: {
  lowRaw: string;
  highRaw: string;
  closeRaw: string;
  kind: WatchState;
}) {
  const low = Number(lowRaw);
  const high = Number(highRaw);
  const close = Number(closeRaw);
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(close) || high <= low) return null;

  // 将展示边界向外扩展 15%，让突破/跌破的位置也能在进度条两端体现出来
  const span = high - low;
  const minView = low - span * 0.25;
  const maxView = high + span * 0.25;
  const pct = Math.min(100, Math.max(0, ((close - minView) / (maxView - minView)) * 100));
  const zoneStart = ((low - minView) / (maxView - minView)) * 100;
  const zoneWidth = ((high - low) / (maxView - minView)) * 100;

  const isBreakout = kind === "右侧突破";
  const barColor = isBreakout ? "bg-[#00a650]" : kind === "破位走空" ? "bg-[#e11d2e]" : "bg-[#d97706]";
  const zoneBg = isBreakout ? "bg-[#00a650]/20" : kind === "破位走空" ? "bg-[#e11d2e]/20" : "bg-[#d97706]/20";

  return (
    <div className="mt-2">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className={`absolute top-0 bottom-0 ${zoneBg}`}
          style={{ left: `${zoneStart}%`, width: `${zoneWidth}%` }}
        />
        <span
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-2xs ${barColor}`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WatchCards({
  rows,
  moves,
  entered,
  focus,
  onFocus,
  onOpen,
}: {
  rows: Level[];
  moves: WatchMove[];
  entered: Record<string, string>;
  focus: WatchState | "变动" | null;
  onFocus: (state: WatchState | "变动" | null) => void;
  onOpen: (level: Level) => void;
}) {
  const groups: { title: WatchState; label: string; badgeTone: string; rangeLabel: string }[] = [
    { title: "右侧突破", label: "Breakout", badgeTone: "bg-[#e7f6ec] text-[#006747]", rangeLabel: "右侧区间" },
    { title: "破位走空", label: "Breakdown", badgeTone: "bg-[#fdeceb] text-[#b91c1c]", rangeLabel: "走空区间" },
    { title: "破位走弱", label: "Weakening", badgeTone: "bg-[#fef3c7] text-[#92400e]", rangeLabel: "走弱区间" },
  ];
  const boardFocus = focus === "变动" ? null : focus;
  const visible = boardFocus ? groups.filter((group) => group.title === boardFocus) : focus === "变动" ? [] : groups;
  const shownMoves = [...(focus === "变动" ? moves : moves.slice(0, 6))].sort(
    (a, b) => b.movedAt.localeCompare(a.movedAt) || b.id - a.id,
  );
  return (
    <div className={focus ? "mx-auto mt-6 max-w-xl" : "relative z-10 mt-6 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-4"}>
      {visible.map((group) => {
        const matched = rows
          .filter(
            (level) =>
              listedBoard(
                level.brief,
                level.lastClose,
                level.lastOpen,
                level.rightPhase === "watch" || level.rightPhase === "in",
              ) === group.title,
          )
          .sort((a, b) => (entered[b.ticker.toUpperCase()] ?? "").localeCompare(entered[a.ticker.toUpperCase()] ?? ""));
        const items = boardFocus ? matched : matched.slice(0, 6);
        return (
          <section key={group.title} className="card-shadow flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-black/5 bg-surface p-5">
            <div>
              {focus ? (
                <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink" onClick={() => onFocus(null)}>
                  ← 返回看板
                </button>
              ) : null}
              <div className={`flex items-center justify-between ${focus ? "mt-3" : ""}`}>
                <h2 className="font-latin text-2xl font-semibold tracking-[0.03em] text-[#006747]">
                  {group.label}
                </h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${group.badgeTone}`}>
                  {group.title} · {matched.length}
                </span>
              </div>
              {items.length === 0 ? <p className="mt-6 text-center text-sm text-muted">暂无信号</p> : null}
              <ul className="mt-3 divide-y divide-line">
                {items.map((level) => {
                  const hit = watchMatch(level.brief, level.lastClose, level.lastOpen);
                  const zone =
                    hit?.kind === group.title ? hit.zone : group.title === "右侧突破" ? rightBreakZone(level.brief) : hit?.zone;
                  const closeTime = usCashCloseLabel(level.closeAt || level.updatedAt);
                  const moveInfo = sessionMove(level.lastOpen, level.lastClose);
                  return (
                    <li key={level.id} className="relative py-1">
                      <button
                        type="button"
                        className="group -mx-2 block w-[calc(100%+1rem)] min-w-0 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-[#f2f7f4]"
                        onClick={() => onOpen(level)}
                      >
                        <div className="flex items-start justify-between gap-2 pr-7">
                          <div className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-lg font-bold text-ink">
                              <TickerLogo ticker={level.ticker || level.name} />
                              <span className="truncate">{level.ticker || level.name}</span>
                            </span>
                            {level.name && level.ticker ? (
                              <span className="mt-0.5 block truncate text-xs text-faint">{level.name}</span>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`inline-flex items-center gap-0.5 text-base font-bold leading-none tabular-nums ${moveInfo.tone}`}>
                              <span className="text-xs">{moveInfo.mark}</span>
                              {showPrice(level.lastClose) === "—" ? "—" : `$${showPrice(level.lastClose)}`}
                            </span>
                            <span className="mt-1 block text-[10px] text-faint">
                              {closeTime ? `ET ${closeTime.replace(" ET", "")}` : "收盘价"}
                            </span>
                          </div>
                        </div>

                        {zone ? (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] text-muted">
                              <span>{group.rangeLabel}</span>
                              <span className="font-semibold tabular-nums text-ink">{zone.low} – {zone.high}</span>
                            </div>
                            <MiniZoneBar lowRaw={zone.low} highRaw={zone.high} closeRaw={level.lastClose} kind={group.title} />
                          </div>
                        ) : null}
                      </button>
                      <span className="absolute right-1.5 top-3.5 z-20">
                        <WatchMark ticker={level.ticker || level.name} quiet />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {!boardFocus && matched.length > 6 ? (
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-bg py-2 text-center text-xs font-semibold text-ink transition-colors hover:bg-[#e8ede9]"
                onClick={() => onFocus(group.title)}
              >
                查看全部 ({matched.length})
              </button>
            ) : null}
          </section>
        );
      })}
      {focus === "变动" || focus == null ? (
        <section className="card-shadow flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-black/5 bg-surface p-5">
          <div>
            {focus === "变动" ? (
              <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink" onClick={() => onFocus(null)}>
                ← 返回看板
              </button>
            ) : null}
            <div className={`flex items-center justify-between ${focus === "变动" ? "mt-3" : ""}`}>
              <h2 className="font-latin text-2xl font-semibold tracking-[0.03em] text-[#006747]">
                Changes
              </h2>
              <span className="rounded-full bg-[#f3e8ff] px-2.5 py-0.5 text-xs font-semibold text-[#6d28d9]">
                板块异动
              </span>
            </div>
            {shownMoves.length === 0 ? <p className="mt-6 text-center text-sm text-muted">暂无异动</p> : null}
            <ul className="mt-3 divide-y divide-line">
              {shownMoves.map((move) => {
                const level = rows.find((item) => item.ticker.toUpperCase() === move.ticker);
                const date = moveDate(move.movedAt);
                const isAdd = move.action === "加入";
                return (
                  <li key={move.id} className="py-1">
                    <button
                      type="button"
                      className="-mx-2 block w-[calc(100%+1rem)] min-w-0 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-[#f2f7f4]"
                      onClick={() => {
                        if (level) onOpen(level);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-lg font-bold text-ink">
                          <TickerLogo ticker={move.ticker} />
                          {move.ticker}
                        </span>
                        <span className="text-[11px] tabular-nums text-faint">{date}</span>
                      </div>
                      {move.name ? <span className="mt-0.5 block truncate text-xs text-faint">{move.name}</span> : null}
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
                        {isAdd ? (
                          <span className="rounded-md bg-[#f3e8ff] px-2 py-0.5 font-semibold text-[#6d28d9]">
                            + 加入 {move.board}
                          </span>
                        ) : (
                          <span className="rounded-md bg-black/5 px-2 py-0.5 font-medium text-muted">
                            - 移出 {move.board}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {focus == null && moves.length > 6 ? (
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-bg py-2 text-center text-xs font-semibold text-ink transition-colors hover:bg-[#e8ede9]"
              onClick={() => onFocus("变动")}
            >
              查看全部 ({moves.length})
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function StockPanel({
  level,
  backHref = "",
  onBack,
}: {
  level: Level;
  backHref?: string;
  onBack?: () => void;
}) {
  const brief = parseBrief(level.brief);
  const rightBand = [...brief.resistance, ...brief.support].find((zone) => isRightBreak(zone.note));
  const emptyBand = [...brief.resistance, ...brief.support].find((zone) => /走空|做头|做顶|见顶/.test(zone.note));
  const [facts, setFacts] = useState<YahooFacts | null>(null);
  const [bars, setBars] = useState<YahooCandle[] | null>(null);

  useEffect(() => {
    let alive = true;
    getYahooFacts({ data: { ticker: level.ticker } })
      .then((next) => {
        if (alive) setFacts(next);
      })
      .catch(() => {
        if (alive) setFacts({ pe: "", dayHigh: "", dayLow: "", open: "", prevClose: "" });
      });
    getYahooCandles({ data: { ticker: level.ticker } })
      .then((next) => {
        if (alive) setBars(next);
      })
      .catch(() => {
        if (alive) setBars([]);
      });
    return () => {
      alive = false;
    };
  }, [level.ticker]);

  const rightBreak = rightBand ? firstBreak(bars ?? [], Number(rightBand.low), Number(rightBand.high), "right") : null;
  const emptyBreak = emptyBand ? firstBreak(bars ?? [], Number(emptyBand.low), Number(emptyBand.high), "down") : null;

  return (
    <article className="mx-auto mt-8 w-full max-w-[56rem]">
      {backHref ? (
        <a
          href={backHref}
          className="mb-6 inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-medium tracking-wide text-ink shadow-2xs transition-colors duration-200 hover:bg-[#eef6ef]"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
            <path d="M10.2 2.8 5 8l5.2 5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回上一层
        </a>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-medium tracking-wide text-ink shadow-2xs transition-colors duration-200 hover:bg-[#eef6ef]"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
            <path d="M10.2 2.8 5 8l5.2 5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回上一层
        </button>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TickerLogo ticker={level.ticker || level.name} />
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl">{level.ticker || level.name}</h2>
        <WatchMark ticker={level.ticker || level.name} />
        {level.name && level.ticker ? <span className="text-sm font-medium text-faint">{level.name}</span> : null}
      </div>
      {level.comment.trim() ? (
        <section className="mt-5 rounded-2xl border border-[#1a4b7a]/15 bg-white/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wide text-[#1a4b7a]">交易员快评</h3>
            {usEasternStamp(level.commentAt) ? (
              <p className="text-[11px] text-faint">更新于 {usEasternStamp(level.commentAt)}</p>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink md:text-base">{level.comment.trim()}</p>
        </section>
      ) : null}
      <div className="mt-6 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_18.5rem]">
        <div className="card-shadow rounded-3xl border border-black/5 bg-surface p-6 md:p-8">
          <ZoneChain
            support={brief.support}
            resistance={brief.resistance}
            close={level.lastClose}
            closeAt={level.closeAt}
            openAt={level.openAt}
            open={level.lastOpen || facts?.open}
            prevClose={facts?.prevClose}
            supportAt={level.supportAt}
            resistanceAt={level.resistanceAt}
          />
          {rightBreak ? (
            <div className="mt-6 rounded-2xl border border-good/20 bg-good-soft px-4 py-3.5">
              <p className="text-xs font-semibold text-good">右侧已突破 · 收盘确认</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-good tabular-nums">{showPrice(String(rightBreak.c))}</p>
              <p className="mt-1 text-xs text-good">于美东 {candleDay(rightBreak.t)} 收盘价 {showPrice(String(rightBreak.c))} 站稳右侧区间</p>
            </div>
          ) : null}
          {emptyBreak ? (
            <div className="mt-6 rounded-2xl border border-bad/20 bg-bad-soft px-4 py-3.5">
              <p className="text-xs font-semibold text-bad">破位走空 · 收盘确认</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-bad tabular-nums">{showPrice(String(emptyBreak.c))}</p>
              <p className="mt-1 text-xs text-bad">于美东 {candleDay(emptyBreak.t)} 收盘价 {showPrice(String(emptyBreak.c))} 跌破关键支撑</p>
            </div>
          ) : null}
        </div>
        <div className="grid gap-4">
          <FactsCard facts={facts} />
          <ValueCard price={level.lastClose} year2026={level.value2026} year2027={level.value2027} />
        </div>
      </div>
      <CandleCard ticker={level.ticker} />
      <ThreeCandleCard ticker={level.ticker} />
    </article>
  );
}

function firstBreak(bars: YahooCandle[], low: number, high: number, side: "right" | "down") {
  if (!bars.length || !Number.isFinite(low) || !Number.isFinite(high)) return null;
  let active: YahooCandle | null = null;
  for (const bar of bars) {
    if (side === "right") {
      if (!active && bar.c > high) active = bar;
      else if (active && (bar.o < low || bar.c < low)) active = null;
    } else if (!active && bar.c < low) active = bar;
    else if (active && (bar.o > high || bar.c > high)) active = null;
  }
  return active;
}

function candleDay(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function candleStamp(ms: number) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}/${part("month")}/${part("day")} ${part("weekday")}`;
}

function formatVolume(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

const zoomSteps = [1, 2, 3, 5, 8, 13, 21, 34, 55, 90, 140, 220, 360, 520];

type StudyBar = YahooCandle & { rsi6: number | null; rsi24: number | null };

function wilderRsi(closes: number[], period: number) {
  const values: Array<number | null> = closes.map(() => null);
  if (closes.length <= period) return values;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  values[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    values[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return values;
}

function withRsi(bars: YahooCandle[]): StudyBar[] {
  const closes = bars.map((bar) => bar.c);
  const rsi6 = wilderRsi(closes, 6);
  const rsi24 = wilderRsi(closes, 24);
  return bars.map((bar, index) => ({ ...bar, rsi6: rsi6[index], rsi24: rsi24[index] }));
}

function weekStart(ms: number) {
  const [year, month, day] = candleDay(ms).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}

function toWeeks(days: YahooCandle[]) {
  const groups = new Map<string, YahooCandle>();
  for (const bar of days) {
    const key = weekStart(bar.t);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...bar });
      continue;
    }
    existing.h = Math.max(existing.h, bar.h);
    existing.l = Math.min(existing.l, bar.l);
    existing.c = bar.c;
    existing.v += bar.v;
    existing.t = bar.t;
  }
  return [...groups.values()];
}

function CandleCard({ ticker }: { ticker: string }) {
  const [bars, setBars] = useState<YahooCandle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState(0);
  const [end, setEnd] = useState(0);
  const [span, setSpan] = useState<"day" | "week">("day");
  const [hoverBar, setHoverBar] = useState<StudyBar | null>(null);
  const drag = useRef({ x: 0, end: 0, active: false });
  const plot = useRef<HTMLDivElement>(null);
  const frame = useRef({ shown: 0, total: 0, right: 0 });
  const points = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; count: number } | null>(null);

  useEffect(() => {
    if (!ticker) return;
    let alive = true;
    setBars(null);
    setFailed(false);
    setCount(0);
    getYahooCandles({ data: { ticker } })
      .then((next) => {
        if (!alive) return;
        setBars(next);
        setEnd(next.length);
        setCount(next.length);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [ticker]);

  const series = useMemo(() => (bars ? withRsi(span === "week" ? toWeeks(bars) : bars) : []), [bars, span]);
  const total = series.length;
  const shown = total === 0 ? 0 : Math.min(Math.max(count || total, 1), total);
  const right = total === 0 ? 0 : Math.min(Math.max(end || total, shown), total);
  const view = series.slice(Math.max(0, right - shown), right);
  const focus = hoverBar ?? view[view.length - 1];
  const up = focus ? focus.c >= focus.o : false;
  frame.current = { shown, total, right };

  function applyCount(nextCount: number, anchor: number) {
    const visible = frame.current.shown;
    const all = frame.current.total;
    const edge = frame.current.right;
    if (!all || !visible) return;
    const next = Math.min(all, Math.max(1, Math.round(nextCount)));
    const index = edge - visible + Math.min(1, Math.max(0, anchor)) * visible;
    const nextEnd = Math.min(all, Math.max(next, Math.round(index + (1 - anchor) * next)));
    setCount(next);
    setEnd(nextEnd);
  }

  function zoom(direction: -1 | 1) {
    if (!total) return;
    if (direction < 0) {
      const next = [...zoomSteps].reverse().find((step) => step < shown) ?? 1;
      applyCount(next, 1);
      return;
    }
    const next = zoomSteps.find((step) => step > shown);
    applyCount(!next || next >= total ? total : next, 1);
  }

  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!frame.current.total) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = rect.width ? (event.clientX - rect.left) / rect.width : 1;
      const factor = event.deltaY > 0 ? 1.2 : 1 / 1.2;
      const visible = frame.current.shown;
      const all = frame.current.total;
      const edge = frame.current.right;
      const next = Math.min(all, Math.max(1, Math.round(visible * factor)));
      const index = edge - visible + Math.min(1, Math.max(0, anchor)) * visible;
      setCount(next);
      setEnd(Math.min(all, Math.max(next, Math.round(index + (1 - anchor) * next))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view.length]);

  useEffect(() => {
    setCount(series.length);
    setEnd(series.length);
  }, [span, series.length]);

  return (
    <section className="card-shadow mt-4 rounded-3xl border border-black/5 bg-surface px-5 py-5 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">{span === "week" ? "近两年周K" : "近两年日K"}</h3>
          <p className="mt-1 text-xs text-faint">已收盘，含成交量、RSI6 和 RSI24。不是实时。</p>
        </div>
        {focus ? (
          <p className={`text-xs font-medium tabular-nums ${up ? "text-[#00a650]" : "text-bad"}`}>
            {candleDay(focus.t)} 开 {focus.o.toFixed(2)} 高 {focus.h.toFixed(2)} 低 {focus.l.toFixed(2)} 收 {focus.c.toFixed(2)} 量 {formatVolume(focus.v)}
            {focus.rsi6 != null ? ` RSI6 ${focus.rsi6.toFixed(1)}` : ""}
            {focus.rsi24 != null ? ` RSI24 ${focus.rsi24.toFixed(1)}` : ""}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ChartButton disabled={!total || shown <= 1} onClick={() => zoom(-1)}>放大</ChartButton>
        <ChartButton disabled={!total || shown >= total} onClick={() => zoom(1)}>缩小</ChartButton>
        <button
          type="button"
          onClick={() => setSpan("day")}
          className={`h-9 rounded-full px-4 text-xs font-semibold transition-colors ${span === "day" ? "bg-ink text-surface" : "bg-bg text-ink hover:bg-black/5"}`}
        >
          日线
        </button>
        <button
          type="button"
          onClick={() => setSpan("week")}
          className={`h-9 rounded-full px-4 text-xs font-semibold transition-colors ${span === "week" ? "bg-ink text-surface" : "bg-bg text-ink hover:bg-black/5"}`}
        >
          周线
        </button>
        <span className="text-xs text-faint">
          {total ? `显示 ${shown} / ${total} 根` : "正在读取日K"}
          {shown < total ? "。滚轮或两指缩放，放大后按住拖动。" : "。在图上滚轮或两指缩放。"}
        </span>
      </div>
      {bars === null && !failed ? <div className="mt-4 h-72 animate-pulse rounded-2xl bg-bg" /> : null}
      {failed || (bars && bars.length === 0) ? <p className="mt-4 text-sm text-muted">日K暂时读不出来。</p> : null}
      {view.length > 0 ? (
        <>
          <div
            ref={plot}
            className={`touch-none select-none ${shown < total ? "cursor-grab active:cursor-grabbing" : ""}`}
            onPointerDown={(event) => {
              points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              if (points.current.size >= 2) {
                drag.current.active = false;
                const [a, b] = [...points.current.values()];
                pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), count: shown };
              } else if (event.button === 0 && shown < total) {
                drag.current = { x: event.clientX, end: right, active: true };
              }
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!points.current.has(event.pointerId)) return;
              points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              if (points.current.size >= 2 && pinch.current && pinch.current.distance > 8) {
                const [a, b] = [...points.current.values()];
                const distance = Math.hypot(a.x - b.x, a.y - b.y);
                applyCount(pinch.current.count * (pinch.current.distance / distance), 0.5);
                return;
              }
              if (!drag.current.active || shown >= total) return;
              const slot = Math.max(event.currentTarget.clientWidth / shown, 6);
              const shift = Math.round((drag.current.x - event.clientX) / slot);
              setEnd(Math.min(total, Math.max(shown, drag.current.end + shift)));
            }}
            onPointerUp={(event) => {
              points.current.delete(event.pointerId);
              pinch.current = null;
              drag.current.active = false;
            }}
            onPointerCancel={(event) => {
              points.current.delete(event.pointerId);
              pinch.current = null;
              drag.current.active = false;
            }}
          >
            <CandleChart bars={view} onHover={setHoverBar} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function ChartButton({ children, disabled, onClick }: { children: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-full bg-ink px-4 text-xs font-semibold text-surface transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function rsiPath(
  bars: StudyBar[],
  key: "rsi6" | "rsi24",
  slot: number,
  left: number,
  yOf: (value: number) => number,
) {
  let path = "";
  let drawing = false;
  bars.forEach((bar, index) => {
    const value = bar[key];
    if (value == null) {
      drawing = false;
      return;
    }
    const x = left + slot * index + slot / 2;
    path += `${drawing ? "L" : "M"}${x.toFixed(1)},${yOf(value).toFixed(1)}`;
    drawing = true;
  });
  return path;
}

function CandleChart({ bars, onHover }: { bars: StudyBar[]; onHover: (bar: StudyBar | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const width = 760;
  const height = 456;
  const priceTop = 8;
  const priceHeight = 200;
  const volumeTop = 224;
  const volumeHeight = 52;
  const rsiTop = 300;
  const rsiHeight = 96;
  const left = 58;
  const rightPad = 12;
  const plot = width - left - rightPad;
  const slot = plot / bars.length;
  const body = Math.max(1.5, Math.min(slot * 0.62, slot * 0.72));
  const low = Math.min(...bars.map((bar) => bar.l));
  const high = Math.max(...bars.map((bar) => bar.h));
  const pad = (high - low) * 0.08 || high * 0.02;
  const min = low - pad;
  const max = high + pad;
  const y = (price: number) => priceTop + ((max - price) / (max - min)) * priceHeight;
  const yRsi = (value: number) => rsiTop + ((100 - value) / 100) * rsiHeight;
  const maxVolume = Math.max(...bars.map((bar) => bar.v), 1);
  const ticks = [max, (max + min) / 2, min];
  const marks = [0, Math.floor((bars.length - 1) / 2), bars.length - 1].filter((index, order, list) => list.indexOf(index) === order);
  const picked = hover == null ? bars[bars.length - 1] : bars[hover];

  function pick(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.floor((x - left) / slot);
    const next = index < 0 || index >= bars.length ? null : index;
    if (next === hoverRef.current) return;
    hoverRef.current = next;
    setHover(next);
    onHover(next == null ? null : bars[next]);
  }

  const guide = hover == null ? null : bars[hover];
  const guideX = guide && hover != null ? left + slot * hover + slot / 2 : 0;
  const guideY = guide ? y(guide.c) : 0;
  const tipX = guideX > width * 0.62 ? guideX - 156 : guideX + 10;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-[30rem] w-full"
      role="img"
      aria-label="K线、成交量与RSI"
      onPointerMove={pick}
      onPointerDown={pick}
      onPointerLeave={() => {
        hoverRef.current = null;
        setHover(null);
        onHover(null);
      }}
    >
      {ticks.map((price) => (
        <g key={price}>
          <line x1={left} x2={width - rightPad} y1={y(price)} y2={y(price)} stroke="#e6e6eb" />
          <text x={left - 8} y={y(price) + 4} textAnchor="end" className="fill-[#86868b]" fontSize="11">
            {price.toFixed(0)}
          </text>
        </g>
      ))}
      <line x1={left} x2={width - rightPad} y1={volumeTop - 8} y2={volumeTop - 8} stroke="#e6e6eb" />
      {[70, 50, 30].map((level) => (
        <g key={level}>
          <line x1={left} x2={width - rightPad} y1={yRsi(level)} y2={yRsi(level)} stroke="#e6e6eb" strokeDasharray="3 3" />
          <text x={left - 8} y={yRsi(level) + 4} textAnchor="end" className="fill-[#86868b]" fontSize="11">
            {level}
          </text>
        </g>
      ))}
      <text x={left} y={rsiTop - 8} className="fill-[#0a3d7a]" fontSize="11">
        RSI6 {picked?.rsi6 != null ? picked.rsi6.toFixed(1) : "—"}
      </text>
      <text x={left + 78} y={rsiTop - 8} className="fill-[#c4a035]" fontSize="11">
        RSI24 {picked?.rsi24 != null ? picked.rsi24.toFixed(1) : "—"}
      </text>
      {bars.map((bar, index) => {
        const x = left + slot * index + slot / 2;
        const rising = bar.c >= bar.o;
        const color = rising ? "#00a650" : "#c41e16";
        const top = y(Math.max(bar.o, bar.c));
        const bottom = y(Math.min(bar.o, bar.c));
        const heightPx = Math.max(1, bottom - top);
        return (
          <g key={bar.t}>
            <line x1={x} x2={x} y1={y(bar.h)} y2={y(bar.l)} stroke={color} strokeWidth="1.2" />
            <rect x={x - body / 2} y={top} width={body} height={heightPx} fill={color} />
            <rect
              x={x - body / 2}
              y={volumeTop + volumeHeight - (bar.v / maxVolume) * volumeHeight}
              width={body}
              height={Math.max(1, (bar.v / maxVolume) * volumeHeight)}
              fill={color}
              opacity="0.85"
            />
          </g>
        );
      })}
      <path d={rsiPath(bars, "rsi6", slot, left, yRsi)} fill="none" stroke="#0a3d7a" strokeWidth="1.6" />
      <path d={rsiPath(bars, "rsi24", slot, left, yRsi)} fill="none" stroke="#c4a035" strokeWidth="1.6" />
      {marks.map((index) => (
        <text key={bars[index].t} x={left + slot * index + slot / 2} y={height - 8} textAnchor="middle" className="fill-[#86868b]" fontSize="11">
          {candleDay(bars[index].t).slice(5)}
        </text>
      ))}
      {guide ? (
        <g>
          <line x1={guideX} x2={guideX} y1={priceTop} y2={rsiTop + rsiHeight + 8} stroke="#1d1d1f" strokeDasharray="4 3" />
          <line x1={left} x2={width - rightPad} y1={guideY} y2={guideY} stroke="#1d1d1f" strokeDasharray="4 3" />
          <rect x={4} y={guideY - 9} width={50} height={18} rx={4} fill="#1d1d1f" />
          <text x={29} y={guideY + 4} textAnchor="middle" fill="#ffffff" fontSize="10">
            {guide.c.toFixed(2)}
          </text>
          <rect
            x={Math.min(width - rightPad - 168, Math.max(left, guideX - 84))}
            y={rsiTop + rsiHeight + 8}
            width={168}
            height={22}
            rx={4}
            fill="#1d1d1f"
          />
          <text
            x={Math.min(width - rightPad - 84, Math.max(left + 84, guideX))}
            y={rsiTop + rsiHeight + 23}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11"
          >
            {candleStamp(guide.t)}
          </text>
          <rect x={tipX} y={priceTop + 4} width={146} height={118} rx={8} fill="#ffffff" stroke="#e6e6eb" />
          <text x={tipX + 10} y={priceTop + 22} className="fill-[#86868b]" fontSize="11">
            {candleDay(guide.t)}
          </text>
          <text x={tipX + 10} y={priceTop + 40} className="fill-[#1d1d1f]" fontSize="12">
            开盘 {guide.o.toFixed(2)}
          </text>
          <text x={tipX + 10} y={priceTop + 56} className="fill-[#1d1d1f]" fontSize="12">
            最高 {guide.h.toFixed(2)}
          </text>
          <text x={tipX + 10} y={priceTop + 72} className="fill-[#1d1d1f]" fontSize="12">
            最低 {guide.l.toFixed(2)}
          </text>
          <text x={tipX + 10} y={priceTop + 88} className="fill-[#1d1d1f]" fontSize="12">
            收盘 {guide.c.toFixed(2)}
          </text>
          <text x={tipX + 10} y={priceTop + 104} className="fill-[#0a3d7a]" fontSize="12">
            RSI6 {guide.rsi6 != null ? guide.rsi6.toFixed(1) : "—"}
          </text>
          <text x={tipX + 10} y={priceTop + 118} className="fill-[#c4a035]" fontSize="12">
            RSI24 {guide.rsi24 != null ? guide.rsi24.toFixed(1) : "—"}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function FactsCard({ facts }: { facts: YahooFacts | null }) {
  const rows = [
    ["市盈率 (PE)", facts?.pe],
    ["今日最高", facts?.dayHigh],
    ["今日最低", facts?.dayLow],
  ] as const;
  return (
    <section className="card-shadow rounded-3xl border border-black/5 bg-surface px-6 py-5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
          <span className="text-sm text-muted">{label}</span>
          <span className="text-lg font-semibold tabular-nums tracking-tight">
            {facts == null ? "—" : value || "—"}
          </span>
        </div>
      ))}
    </section>
  );
}

function medianOf(low: number, high: number) {
  return Math.round((low + high) / 2);
}

function pct(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.abs((part / whole) * 100).toFixed(1)}%`;
}

function signedPct(part: number, whole: number) {
  if (!whole) return "—";
  const value = (part / whole) * 100;
  const text = `${Math.abs(value).toFixed(1)}%`;
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

function ValueCard({ price, year2026, year2027 }: { price: string; year2026: string; year2027: string }) {
  const bands = [parseValueBand(year2026), parseValueBand(year2027)];
  const shown = bands.filter((band): band is { low: number; high: number } => band != null);
  const now = Number(price);
  return (
    <section className="overflow-hidden rounded-3xl border border-black/5 bg-surface shadow-xs">
      <div className="px-5 pt-4 pb-4">
        <p className="text-sm font-bold text-[#0a3d7a]">价值估值区间</p>
        {shown.length > 0 ? (
          <div className="mt-4 space-y-4">
            {bands.map((band, index) => {
              if (!band) return null;
              const year = 2026 + index;
              const median = medianOf(band.low, band.high);
              const gap = Number.isFinite(now) ? now - median : null;
              return (
                <div key={year}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold text-ink">{year}</span>
                    <span className="text-lg font-semibold tabular-nums tracking-tight text-ink">
                      {band.low}–{band.high}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <span className="text-xs text-muted">中位数</span>
                    <span className="text-sm font-semibold tabular-nums text-ink">{median}</span>
                  </div>
                  <ValueGauge low={band.low} high={band.high} median={median} price={now} />
                  <p className={`mt-1 text-right text-xs font-semibold tabular-nums ${gap == null ? "text-muted" : gap > 0 ? "text-bad" : "text-[#00a650]"}`}>
                    {gap == null ? "收盘价 —" : `收盘价比中位数 ${signedPct(gap, median)}`}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">尚未给出价值区间</p>
        )}
      </div>
      {bands[0] && bands[1] ? <RevisionRow prior={bands[0]} next={bands[1]} /> : null}
    </section>
  );
}

function gaugeSpot(value: number, low: number, high: number) {
  const span = high - low || 1;
  return Math.min(100, Math.max(0, ((value - low) / span) * 84 + 8));
}

function ValueGauge({
  low,
  high,
  median,
  price,
}: {
  low: number;
  high: number;
  median: number;
  price: number;
}) {
  const known = Number.isFinite(price);
  const pastHigh = known && price > high;
  const pastMedian = known && price > median;
  const spot = known ? gaugeSpot(price, low, high) : null;
  const medianSpot = gaugeSpot(median, low, high);
  const tone = !known ? "bg-line" : pastHigh ? "bg-bad" : pastMedian ? "bg-[#c4a035]" : "bg-[#00a650]";
  const note = !known
    ? "收盘价 —"
    : pastHigh
      ? "已过中位数，已过最高"
      : price === high
        ? "已过中位数，就在最高"
        : pastMedian
          ? "已过中位数，未到最高"
          : price === median
            ? "就在中位数"
            : "未到中位数";
  const noteTone = !known ? "text-muted" : pastHigh ? "text-bad" : pastMedian ? "text-[#8a6a12]" : "text-[#00a650]";
  return (
    <div className="mt-3">
      <div className="relative h-7">
        <div className="absolute top-3 right-[8%] left-[8%] h-1.5 rounded-full bg-[#eceae4]" />
        <div className="absolute top-2 h-3.5 w-px bg-[#b9b4a8]" style={{ left: `${medianSpot}%` }} />
        <div className="absolute top-2 right-[8%] h-3.5 w-px bg-ink" />
        {spot != null ? (
          <span
            className={`absolute top-1.5 size-3.5 -translate-x-1/2 rounded-full border-2 border-surface shadow-xs ${tone}`}
            style={{ left: `${spot}%` }}
          />
        ) : null}
      </div>
      <div className="flex items-baseline justify-between text-[10px] text-faint">
        <span className="tabular-nums">{low}</span>
        <span className="tabular-nums">中位 {median}</span>
        <span className="tabular-nums">最高 {high}</span>
      </div>
      <p className={`mt-1 text-xs font-semibold ${noteTone}`}>{note}</p>
    </div>
  );
}

function RevisionRow({
  prior,
  next,
}: {
  prior: { low: number; high: number };
  next: { low: number; high: number };
}) {
  const rows = [
    ["下沿", next.low - prior.low, prior.low],
    ["上沿", next.high - prior.high, prior.high],
  ] as const;
  return (
    <div className="border-t border-line bg-[#fafaf8] px-5 py-3">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">2027 相对 2026</p>
      <div className="mt-2 space-y-1">
        {rows.map(([label, delta, base]) => {
          const up = delta > 0;
          const down = delta < 0;
          return (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted">{label}</span>
              <span className={`text-sm font-semibold tabular-nums ${up ? "text-[#00a650]" : down ? "text-bad" : "text-ink"}`}>
                {delta === 0 ? "持平" : `${up ? "上调" : "下调"} ${pct(delta, base)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
