export type Strength = "超强" | "强" | "中" | "小" | "";

export type Zone = {
  low: string;
  high: string;
  strength: Strength;
  note: string;
};

export type Brief = {
  ticker: string;
  support: Zone[];
  resistance: Zone[];
  skipped: string[];
};

export type Side = "支撑" | "压力";

export type PlacedZone = Zone & { role: Side; current: boolean };

const zoneLine =
  /^(\d+(?:\.\d+)?)\s*[-~～—–]\s*(\d+(?:\.\d+)?)\s*(?:[（(]\s*(超强|强|中|小)\s*[）)])?\s*(.*)$/;

export function parseBrief(text: string): Brief {
  const support: Zone[] = [];
  const resistance: Zone[] = [];
  const skipped: string[] = [];
  let ticker = "";
  let section: "support" | "resistance" | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^支撑/.test(line)) {
      section = "support";
      continue;
    }
    if (/^压力/.test(line)) {
      section = "resistance";
      continue;
    }
    const match = line.match(zoneLine);
    if (match && section) {
      const zone: Zone = {
        low: match[1],
        high: match[2],
        strength: (match[3] as Strength | undefined) ?? "",
        note: match[4].trim(),
      };
      if (section === "support") support.push(zone);
      else resistance.push(zone);
      continue;
    }
    if (!ticker && /^[A-Za-z][A-Za-z0-9.\-]{0,14}$/.test(line)) {
      ticker = line.toUpperCase();
      continue;
    }
    if (!ticker && /^\d{4,6}$/.test(line)) {
      ticker = line;
      continue;
    }
    skipped.push(line);
  }

  return { ticker, support, resistance, skipped };
}

export type WatchState = "右侧突破" | "破位走空" | "破位走弱";

const watchOrder: WatchState[] = ["右侧突破", "破位走空", "破位走弱"];

function watchKind(note: string): WatchState | null {
  if (isRightBreak(note)) return "右侧突破";
  if (/走空|做头|做顶|见顶/.test(note)) return "破位走空";
  if (/走弱/.test(note)) return "破位走弱";
  return null;
}

function zoneHit(zones: Zone[], kind: WatchState, price: number) {
  return (
    zones.find((zone) => {
      if (watchKind(zone.note) !== kind) return false;
      const low = Number(zone.low);
      const high = Number(zone.high);
      if (kind === "右侧突破") return price >= high;
      return price <= low;
    }) ?? null
  );
}

export function watchMatch(text: string, close: string, open: string): { kind: WatchState; zone: Zone } | null {
  const zones = [...parseBrief(text).resistance, ...parseBrief(text).support];
  const prices = [close, open]
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map(Number)
    .filter((price) => Number.isFinite(price));
  const emptied = prices.map((price) => zoneHit(zones, "破位走空", price)).find((zone) => zone != null) ?? null;
  const rightZones = zones.filter((zone) => isRightBreak(zone.note) && Number.isFinite(Number(zone.low)));
  let failedRight: Zone | null = null;
  if (rightZones.length > 0) {
    const floor = Math.min(...rightZones.map((zone) => Number(zone.low)));
    if (prices.some((price) => price < floor)) {
      failedRight = rightZones.find((zone) => Number(zone.low) === floor) ?? rightZones[0];
    }
  }
  if (failedRight) return emptied ? { kind: "破位走空", zone: emptied } : { kind: "破位走弱", zone: failedRight };
  for (const price of prices) {
    for (const kind of watchOrder) {
      const zone = zoneHit(zones, kind, price);
      if (zone) return { kind, zone };
    }
  }
  return null;
}

export function watchState(text: string, close: string, open: string): WatchState | null {
  return watchMatch(text, close, open)?.kind ?? null;
}

export function rightBreakZone(text: string): Zone | null {
  const zones = [...parseBrief(text).resistance, ...parseBrief(text).support];
  return (
    zones.find(
      (zone) => isRightBreak(zone.note) && Number.isFinite(Number(zone.low)) && Number.isFinite(Number(zone.high)),
    ) ?? null
  );
}

/** Sticky names stay on 右侧突破 after the first breakout until the close loses the zone floor. */
export function listedBoard(text: string, close: string, open: string, held: boolean): WatchState | null {
  const raw = watchState(text, close, open);
  if (raw === "破位走空" || raw === "破位走弱") return raw;
  if (raw === "右侧突破" || held) return "右侧突破";
  return raw;
}

export function isRightBreak(note: string) {
  return /右侧|看新高|突破新高|创新高/.test(note);
}

export function parseValueBand(text: string) {
  const match = text.replace(/[,，]/g, "").match(/(\d+(?:\.\d+)?)\s*[-–—~到至]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  let low = Number(match[1]);
  let high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low === high) return null;
  if (low > high) [low, high] = [high, low];
  return { low, high };
}

export function layoutChain(support: Zone[], resistance: Zone[], close: string) {
  const price = Number(close);
  const tagged = [...resistance.map((zone) => ({ zone })), ...support.map((zone) => ({ zone }))];
  if (!close.trim() || !Number.isFinite(price)) {
    return {
      above: resistance.map((zone) => ({ ...zone, role: "压力" as Side, current: false })),
      below: support.map((zone) => ({ ...zone, role: "支撑" as Side, current: false })),
      current: null as PlacedZone | null,
    };
  }

  const above: PlacedZone[] = [];
  const below: PlacedZone[] = [];
  let current: PlacedZone | null = null;
  for (const { zone } of tagged) {
    const low = Number(zone.low);
    const high = Number(zone.high);
    const inside = price >= low && price <= high;
    const placed: PlacedZone = { ...zone, role: price > high ? "支撑" : "压力", current: false };
    if (inside) {
      const tighter = current == null || high - low < Number(current.high) - Number(current.low);
      if (tighter) current = placed;
    }
    if (placed.role === "压力") above.push(placed);
    else below.push(placed);
  }
  if (current) {
    const match = (current.role === "压力" ? above : below).find(
      (zone) => zone.low === current.low && zone.high === current.high && zone.note === current.note,
    );
    if (match) match.current = true;
  }
  const byHigh = (a: PlacedZone, b: PlacedZone) =>
    Number(b.high) - Number(a.high) || Number(b.low) - Number(a.low);
  above.sort(byHigh);
  below.sort(byHigh);
  return { above, below, current };
}

function etPart(date: Date, type: "year" | "month" | "day" | "weekday" | "hour") {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .find((item) => item.type === type)?.value ?? ""
  );
}

export function gapNotice(
  support: Zone[],
  resistance: Zone[],
  open: string,
  prevClose: string,
  close: string,
  insideRole: Side | null,
) {
  const openPrice = Number(open);
  const previous = Number(prevClose);
  const closePrice = Number(close);
  if (!Number.isFinite(openPrice) || !Number.isFinite(previous) || openPrice === previous) return null;

  let zone: Zone | undefined;
  let side: Side = "压力";
  let edge = "上沿";
  if (openPrice > previous) {
    const skipped = resistance.filter((item) => previous <= Number(item.high) && openPrice > Number(item.high));
    skipped.sort((a, b) => Number(b.high) - Number(a.high) || Number(b.low) - Number(a.low));
    zone = skipped[0];
  } else {
    const skipped = support.filter((item) => previous >= Number(item.low) && openPrice < Number(item.low));
    skipped.sort((a, b) => Number(a.low) - Number(b.low) || Number(a.high) - Number(b.high));
    zone = skipped[0];
    side = "支撑";
    edge = "下沿";
  }
  if (!zone) return null;
  const head = `今日开盘价开在${zone.low}–${zone.high}${zone.strength}${side}${edge}`;
  if (!insideRole || !Number.isFinite(closePrice)) return `${head}。`;
  const verb = closePrice < openPrice ? "回落" : "回升";
  return `${head}，但收盘价${verb}至${insideRole}带内。`;
}

export function etDateLabel(iso: string) {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  if (!part("year")) return "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function usEasternStamp(iso: string) {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `ET ${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

export function usCashCloseLabel(iso: string) {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const hour = Number(etPart(instant, "hour"));
  let cursor = new Date(instant.getTime());
  if (hour < 16) cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  for (let i = 0; i < 4; i += 1) {
    const weekday = etPart(cursor, "weekday");
    if (weekday !== "Sat" && weekday !== "Sun") break;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return `${etPart(cursor, "year")}-${etPart(cursor, "month")}-${etPart(cursor, "day")} 16:00 ET`;
}
