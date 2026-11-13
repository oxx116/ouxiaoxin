import { etDateLabel, gapNotice, isRightBreak, layoutChain, usEasternStamp, type PlacedZone, type Side, type Zone } from "@/lib/brief";

function zoneDistance(zone: PlacedZone, price: number) {
  const low = Number(zone.low);
  const high = Number(zone.high);
  if (price >= low && price <= high) return 0;
  if (price < low) return low - price;
  return price - high;
}

function nearestTwo(zones: PlacedZone[], price: number) {
  const picked = [...zones]
    .sort((a, b) => zoneDistance(a, price) - zoneDistance(b, price) || Number(b.high) - Number(a.high))
    .slice(0, 2);
  picked.sort((a, b) => Number(b.high) - Number(a.high) || Number(b.low) - Number(a.low));
  return picked;
}

function formatQuote(raw: string | undefined) {
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

function signed(value: number, digits: number) {
  const text = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

function quoteMove(close: string | undefined, prev: string | undefined) {
  const now = Number(close);
  const before = Number(prev);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) return null;
  const delta = now - before;
  return { delta, pct: (delta / before) * 100, up: delta > 0, down: delta < 0 };
}

export function ZoneChain({
  support,
  resistance,
  close,
  closeAt,
  openAt,
  open,
  prevClose,
  supportAt,
  resistanceAt,
}: {
  support: Zone[];
  resistance: Zone[];
  close?: string;
  closeAt?: string;
  openAt?: string;
  open?: string;
  prevClose?: string;
  supportAt?: string;
  resistanceAt?: string;
}) {
  const { above, below, current } = layoutChain(support, resistance, close ?? "");
  const closeDate = etDateLabel(closeAt ?? "");
  const openDate = etDateLabel(openAt ?? "");
  const notice = gapNotice(
    support,
    resistance,
    open ?? "",
    prevClose ?? "",
    close ?? "",
    current?.role ?? null,
  );
  const move = quoteMove(close, open);
  const tone = move?.up ? "text-[#00a650]" : move?.down ? "text-bad" : "text-ink";
  const price = Number(close);
  const pressure = Number.isFinite(price) ? nearestTwo(above, price) : above.slice(0, 2);
  const supportZones = Number.isFinite(price) ? nearestTwo(below, price) : below.slice(0, 2);
  return (
    <div className="mt-6">
      <ZoneBlock title="压力" zones={pressure} editedAt={resistanceAt} />
      <div className="my-3 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="px-5 pt-5 pb-4">
          <p className="text-sm font-bold text-[#0a3d7a]">
            {current ? `该价格处于${current.role}区` : "行情"}
          </p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted">开盘</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{formatQuote(open)}</p>
              {openDate ? <p className="mt-1 text-[11px] text-faint">ET {openDate}</p> : null}
            </div>
            <div>
              <p className="text-left text-sm font-semibold text-[#0a3d7a]">收盘</p>
              <div className="mt-1 flex items-end justify-end gap-2">
                <p className={`text-4xl font-semibold tabular-nums tracking-tight leading-none ${tone}`}>
                  {formatQuote(close)}
                </p>
                {move ? (
                  <span
                    className={`mb-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                      move.up ? "bg-[#e8f8ef] text-[#00a650]" : move.down ? "bg-bad-soft text-bad" : "bg-bg text-muted"
                    }`}
                  >
                    {move.up ? "↑" : move.down ? "↓" : ""}
                    {signed(move.delta, 3)} {signed(move.pct, 2)}%
                  </span>
                ) : null}
              </div>
              {closeDate ? <p className="mt-1 text-right text-[11px] text-faint">ET {closeDate}</p> : null}
            </div>
          </div>
          {notice ? <p className="mt-4 text-sm font-medium leading-6 text-bad">{notice}</p> : null}
        </div>
        {current ? (
          <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3">
            <span className="w-28 text-right text-base font-medium tabular-nums tracking-tight text-ink">
              {current.low}–{current.high}
            </span>
            <StrengthSeal strength={current.strength} />
          </div>
        ) : null}
      </div>
      <ZoneBlock title="支撑" zones={supportZones} editedAt={supportAt} />
    </div>
  );
}

function ZoneBlock({ title, zones, editedAt }: { title: Side; zones: PlacedZone[]; editedAt?: string }) {
  const edited = editedAt ? usEasternStamp(editedAt) : "";
  return (
    <section>
      <h3 className="px-1 text-base font-bold text-ink">
        {title}
        {edited ? <span className="ml-2 text-xs font-normal text-faint">（{edited}）</span> : null}
      </h3>
      {zones.length === 0 ? <p className="px-1 py-3 text-sm text-faint">没有</p> : null}
      <ul>
        {zones.map((zone) => (
          <li
            key={`${title}-${zone.low}-${zone.high}-${zone.note}`}
            className={`flex items-center gap-3 border-b border-line px-1 py-3 last:border-0 ${
              zone.current ? "rounded-xl bg-[#f8efc8]" : ""
            }`}
          >
            <span
              className={
                zone.current
                  ? "w-28 shrink-0 text-base font-semibold tabular-nums tracking-tight"
                  : "w-28 shrink-0 text-base font-medium tabular-nums tracking-tight text-muted"
              }
            >
              {zone.low}–{zone.high}
            </span>
            <StrengthMark strength={zone.strength} />
            {isRightBreak(zone.note) ? (
              <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-surface">右侧</span>
            ) : null}
            {zone.note ? <span className="text-base font-black text-[#1a4b7a]">{zone.note}</span> : null}
            {zone.current ? (
              <span className="ml-auto select-none pr-1 font-brush text-4xl leading-none text-[#d2b15c]">{title}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StrengthSeal({ strength }: { strength: Zone["strength"] }) {
  return <StrengthMark strength={strength} large />;
}

function StrengthMark({ strength, large = false }: { strength: Zone["strength"]; large?: boolean }) {
  const tone =
    strength === "超强"
      ? "bg-[#c41e16] text-white"
      : strength === "强"
        ? "bg-[#fde8e6] text-[#c41e16]"
        : strength === "中"
          ? "bg-[#fff3c4] text-[#8a6200]"
          : strength === "小"
            ? "bg-[#e5f6ea] text-[#1d7a45]"
            : "";
  if (!tone) return null;
  const size = large
    ? "inline-flex h-11 min-w-11 items-center justify-center px-2 text-base font-semibold"
    : "inline-flex h-6 min-w-6 items-center justify-center px-1.5 text-xs font-medium";
  return <span className={`${size} rounded-full ${tone}`}>{strength}</span>;
}
