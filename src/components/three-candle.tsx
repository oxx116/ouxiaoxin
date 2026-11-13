import { useEffect, useState } from "react";
import { getTechCandles, syncPatternMarks, type PatternMark } from "@/lib/patterns";
import type { YahooCandle } from "@/lib/yahoo";

function dayOf(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function MiniCandles({ bars }: { bars: YahooCandle[] }) {
  const low = Math.min(...bars.map((bar) => bar.l));
  const high = Math.max(...bars.map((bar) => bar.h));
  const span = high - low || 1;
  const width = 168;
  const height = 188;
  const gap = 14;
  const body = 28;
  const group = bars.length * body + (bars.length - 1) * gap;
  const start = (width - group) / 2;
  const y = (price: number) => 8 + ((high - price) / span) * (height - 32);
  const labels = ["前天", "昨日", "当天"];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto h-48 w-40" aria-hidden="true">
      {bars.map((bar, index) => {
        const x = start + index * (body + gap) + body / 2;
        const up = bar.c >= bar.o;
        const color = up ? "#1d7a45" : "#c41e16";
        const top = y(Math.max(bar.o, bar.c));
        const bottom = y(Math.min(bar.o, bar.c));
        return (
          <g key={bar.t}>
            <line x1={x} x2={x} y1={y(bar.h)} y2={y(bar.l)} stroke={color} strokeWidth="2.2" />
            <rect x={x - body / 2} y={top} width={body} height={Math.max(3, bottom - top)} rx="1.5" fill={color} />
            <text x={x} y={height - 6} textAnchor="middle" fontSize="12" fill="#6e6e73">
              {labels[index] ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function shortfall(explain: string) {
  return explain
    .replace(/合计\s*\d+，.*?形态(强烈|标准|及格|可观察|无效)。?/g, "")
    .replace(/量能(强放量|明显放量|最低放量|平量)。?/g, "")
    .trim();
}

function PatternList({ marks }: { marks: PatternMark[] }) {
  const today = dayOf(Date.now());
  if (marks.length === 0) return <p className="mt-2 text-sm text-muted">未发现有可靠的形态</p>;
  return (
    <ul className="mt-2 space-y-2">
      {marks.map((mark) => {
        const broken = mark.status === "broken";
        const misplaced = Boolean(mark.placeNote);
        const quiet = misplaced && /抱线|孕线/.test(mark.name);
        const reason = shortfall(mark.explain);
        return (
          <li key={mark.id} className="space-y-1.5">
            {broken && !misplaced ? (
              <p className="rounded-lg bg-bg px-2.5 py-1.5 text-xs font-medium leading-5 text-bad">
                美东 {mark.signalOn} 出现的{mark.name}
                {mark.brokenOn === today ? "今日" : `于美东 ${mark.brokenOn}`}已击破，已经失效。
              </p>
            ) : null}
            <div className="rounded-lg bg-bg px-2.5 py-1.5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <p className="text-sm font-semibold text-ink">
                  {mark.name}
                  <span className="ml-1.5 text-[11px] font-normal text-faint">美东 {mark.signalOn}</span>
                </p>
                {misplaced ? (
                  <span className="inline-flex items-center justify-center rounded-sm border border-[#8a6200] px-2 py-0.5 text-sm font-bold leading-none text-[#8a6200]">
                    位置不对
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center justify-center rounded-sm border px-2 py-0.5 text-sm font-bold leading-none ${
                      mark.kind === "止跌" ? "border-[#1d7a45] text-[#1d7a45]" : "border-[#c41e16] text-[#c41e16]"
                    }`}
                  >
                    {mark.kind === "止跌" ? "见底" : "见顶"}
                  </span>
                )}
                <p className={`text-right text-xs font-semibold ${mark.grade === "无效" ? "text-bad" : mark.grade === "可观察" ? "text-[#8a6200]" : "text-[#1d7a45]"}`}>
                  {quiet || broken ? "" : `${mark.score}分 ${mark.name}形态${mark.grade}`}
                </p>
              </div>
              {misplaced ? null : (
                <p className={`mt-0.5 text-[11px] font-medium leading-4 ${broken ? "text-bad" : "text-[#1d7a45]"}`}>
                  {broken ? `${mark.name}被击破，已失效` : `${mark.name}有效`}
                </p>
              )}
              {mark.placeNote ? <p className="text-[11px] font-medium leading-4 text-[#8a6200]">{mark.placeNote}</p> : null}
              {!quiet && reason ? <p className="text-[11px] leading-4 text-muted">{reason}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ThreeCandleCard({ ticker }: { ticker: string }) {
  const [bars, setBars] = useState<YahooCandle[] | null>(null);
  const [marks, setMarks] = useState<PatternMark[] | null>(null);
  useEffect(() => {
    if (!ticker) return;
    let alive = true;
    setBars(null);
    setMarks(null);
    void getTechCandles({ data: { ticker } })
      .then(async (next) => {
        if (!alive) return;
        setBars(next);
        try {
          const saved = await syncPatternMarks({ data: { ticker, bars: next } });
          if (alive) setMarks(saved);
        } catch {
          if (alive) setMarks([]);
        }
      })
      .catch(() => {
        if (!alive) return;
        setBars([]);
        setMarks([]);
      });
    return () => {
      alive = false;
    };
  }, [ticker]);

  const three = bars?.slice(-3) ?? [];
  return (
    <section className="card-shadow mt-4 rounded-3xl bg-surface px-5 py-5 md:px-6">
      <h3 className="flex items-center gap-2 text-base font-bold text-ink">
        有限技术参考
        <span className="rounded-md bg-[#ececee] px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide text-[#3a3a3c]">
          Beta
        </span>
      </h3>
      <p className="mt-1 text-xs text-faint">该板块仅作分析，不代表任何交易意见，非投资参考！</p>
      {bars === null ? <p className="mt-4 text-sm text-muted">正在读取</p> : null}
      {bars && three.length < 3 ? <p className="mt-4 text-sm text-muted">日K不够三根。</p> : null}
      {three.length === 3 ? (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="flex justify-center rounded-2xl bg-bg px-2 py-2">
              <MiniCandles bars={three} />
            </div>
            <ul className="grid gap-2">
              {three.map((bar, index) => (
                <li key={bar.t} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-ink">{["前天", "昨日", "当天"][index]}</span>
                  <span className="text-xs text-faint">ET {dayOf(bar.t)}</span>
                  <span className={`tabular-nums ${bar.c >= bar.o ? "text-[#1d7a45]" : "text-bad"}`}>
                    开 {bar.o.toFixed(2)} 收 {bar.c.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 border-t border-line pt-4">
            {marks === null ? <p className="text-sm text-muted">正在记录形态</p> : <PatternList marks={marks} />}
          </div>
        </>
      ) : null}
    </section>
  );
}
