import type { YahooCandle } from "@/lib/yahoo";

export type ReadHit = {
  name: string;
  kind: "止跌" | "见顶";
  rank: number;
  note: string;
  warn?: string;
  form: number;
  volume: number;
  score: number;
  pass: boolean;
  grade: string;
  explain: string;
  breakAbove: number | null;
  breakBelow: number | null;
  breakHow?: "strict" | "touch" | "color" | "close-below";
  placeNote?: string;
};

function body(bar: YahooCandle) {
  return Math.abs(bar.c - bar.o);
}

function upper(bar: YahooCandle) {
  return bar.h - Math.max(bar.o, bar.c);
}

function lower(bar: YahooCandle) {
  return Math.min(bar.o, bar.c) - bar.l;
}

function bull(bar: YahooCandle) {
  return bar.c > bar.o;
}

function bear(bar: YahooCandle) {
  return bar.c < bar.o;
}

function candleParts(bar: YahooCandle) {
  const range = bar.h - bar.l;
  const real = Math.abs(bar.o - bar.c);
  const upperWick = bar.h - Math.max(bar.o, bar.c);
  const lowerWick = Math.min(bar.o, bar.c) - bar.l;
  return { range, real, upperWick, lowerWick };
}

function starShape(bar: YahooCandle) {
  const part = candleParts(bar);
  if (!(part.range > 0)) return null;
  if (part.real / part.range > 0.2) return null;
  if (part.upperWick < part.real && part.lowerWick < part.real) return null;
  return part;
}

function bodyGap(trend: YahooCandle, star: YahooCandle) {
  const starTop = Math.max(star.o, star.c);
  const starBot = Math.min(star.o, star.c);
  const trendTop = Math.max(trend.o, trend.c);
  const trendBot = Math.min(trend.o, trend.c);
  return bear(trend) ? trendBot - starTop : starBot - trendTop;
}

function admittedStar(star: YahooCandle, trend: YahooCandle) {
  const part = starShape(star);
  const trendBody = body(trend);
  if (!part || !(trendBody > 0) || part.real > trendBody / 2) return null;
  const gap = bodyGap(trend, star);
  const strict = part.real / part.range <= 0.1 && part.real <= trendBody / 3 && gap >= trendBody * 0.1;
  const top = Math.max(star.o, star.c);
  const bot = Math.min(star.o, star.c);
  const balanced = Math.abs(part.upperWick - part.lowerWick) <= part.range * 0.2;
  const doji = part.real / part.range <= 0.03 && part.upperWick >= part.range * 0.4 && part.lowerWick >= part.range * 0.4 && balanced;
  const hammer = bot >= star.l + part.range * (2 / 3) && part.lowerWick >= part.real * 2 && part.upperWick <= part.real * 0.5;
  const shooting = top <= star.l + part.range / 3 && part.upperWick >= part.real * 2 && part.lowerWick <= part.real * 0.5;
  const propeller =
    part.real / part.range <= 0.15 &&
    part.upperWick >= part.real * 2 &&
    part.lowerWick >= part.real * 2 &&
    Math.abs(part.upperWick - part.lowerWick) <= part.range * 0.3;
  const kind = doji ? "十字星" : hammer ? "锤子型" : shooting ? "射击之星型" : propeller ? "螺旋桨" : "星线";
  return { strict, kind };
}

function rising(values: number[]) {
  return values.length >= 2 && values.every((value, index) => index === 0 || value > values[index - 1]);
}

function falling(values: number[]) {
  return values.length >= 2 && values.every((value, index) => index === 0 || value < values[index - 1]);
}

function trendOf(prior: YahooCandle[]) {
  const window = prior.slice(-3);
  if (window.length < 3) return "背景不足";
  const [first, , last] = window;
  const highs = window.map((bar) => bar.h);
  const lows = window.map((bar) => bar.l);
  const upSkipMiddle = last.l > first.l && last.h > first.h;
  const downSkipMiddle = last.l < first.l && last.h < first.h;
  if ((rising(lows) && rising(highs)) || upSkipMiddle) return "上涨";
  if ((falling(lows) && falling(highs)) || downSkipMiddle) return "下跌";
  return "横盘";
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function volumeRead(current: number, baseline: number) {
  if (!(baseline > 0) || !(current > 0)) return { label: "无量能", ratio: 0, weak: true };
  const ratio = current / baseline;
  if (ratio < 0.9) return { label: "缩量", ratio, weak: true };
  if (ratio <= 1.1) return { label: "平量", ratio, weak: true };
  if (ratio < 1.5) return { label: "未达放量", ratio, weak: true };
  if (ratio < 1.8) return { label: "最低放量", ratio, weak: false };
  if (ratio < 2.5) return { label: "明显放量", ratio, weak: false };
  return { label: "强放量", ratio, weak: false };
}

export function readThree(bars: YahooCandle[], ticker = ""): { trend: string; hits: ReadHit[] } {
  const three = bars.slice(-3);
  if (three.length < 3) return { trend: "不足", hits: [] };
  const [a, b, c] = three;
  const trend = trendOf(three);
  const hits: ReadHit[] = [];
  const base = avg(bars.slice(-6, -1).map((bar) => bar.v));
  const vol = volumeRead(c.v, base);
  const volText = `量能${vol.label}`;
  const volWarn = vol.weak ? `量能提醒：${volText}，形态为主，请关注量。` : undefined;

  const range = c.h - c.l;
  const secondary = (wick: number) => {
    if (wick <= 0) return "最强";
    if (range > 0 && wick < range * 0.1) return "合格";
    if (range > 0 && wick <= range * 0.2) return "边缘";
    return "过长";
  };
  const hammerShape = body(c) > 0 && lower(c) >= body(c) * 2 && upper(c) <= body(c) * 0.5;
  const invertedShape = body(c) > 0 && upper(c) >= body(c) * 2 && lower(c) <= body(c) * 0.5;
  const hammerNote = secondary(upper(c));
  const invertedNote = secondary(lower(c));

  const unclear = trend === "横盘" || trend === "背景不足";
  const mark = (name: string) => (unclear ? `${name}候选` : name);
  const back = unclear ? "近3根总体横盘，仅作候选。" : "";

  if (trend === "下跌" && hammerShape) {
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, name: "锤子线", kind: "止跌", rank: 1, note: `下影至少实体两倍，上影${hammerNote}。${volText}`, warn: volWarn });
  } else if (trend === "上涨" && hammerShape) {
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, name: "上吊线", kind: "见顶", rank: 2, note: `下影至少实体两倍，上影${hammerNote}。${volText}`, warn: volWarn });
  } else if (unclear && hammerShape) {
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, name: "长下影候选", kind: "止跌", rank: 8, note: `外形接近锤子或上吊。${volText}${back}`, warn: volWarn });
  }
  if (trend === "下跌" && invertedShape) {
    const name = invertedNote === "边缘" ? "倒锤子试探" : "倒锤子线";
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, name, kind: "止跌", rank: 4, note: `上影至少实体两倍，下影${invertedNote}。${volText}`, warn: volWarn });
  } else if (trend === "上涨" && invertedShape) {
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, name: "流星线", kind: "见顶", rank: 1, note: `上影至少实体两倍，下影${invertedNote}。${volText}`, warn: volWarn });
  } else if (unclear && invertedShape) {
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, name: "长上影候选", kind: "见顶", rank: 8, note: `外形接近倒锤子或流星。${volText}${back}`, warn: volWarn });
  }

  const place = bars.slice(-20);
  const placeHigh = place.length ? Math.max(...place.map((bar) => bar.h)) : c.h;
  const placeLow = place.length ? Math.min(...place.map((bar) => bar.l)) : c.l;
  const placeSpan = placeHigh - placeLow || 1;
  const percentile = place.length >= 20 ? (c.c - placeLow) / placeSpan : 0.5;
  const atBottom = place.length >= 20 && percentile <= 0.2;
  const atTop = place.length >= 20 && percentile >= 0.8;
  const volumeOk = vol.ratio >= 0.9;
  const bullEngulf = volumeOk && bear(b) && bull(c) && c.o < b.l && c.c > b.h;
  const bearEngulf = volumeOk && bear(c) && c.o > b.h && c.c < b.l;
  const bullHarami = bear(b) && c.c >= c.o && c.o > b.c && c.c < b.o;
  const bearHarami = bull(b) && c.c <= c.o && c.o < b.c && c.c > b.o;
  if (bullEngulf) {
    const placeNote = atBottom ? "" : "不满足相对底部";
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, placeNote, name: "看涨抱线", kind: "止跌", rank: 2, note: placeNote || `昨日阴线、当日阳线包住昨日整根。${volText}`, warn: volWarn });
  }
  if (bearEngulf) {
    const placeNote = atTop ? "" : "不满足相对顶部";
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, placeNote, name: "看跌抱线", kind: "见顶", rank: 3, note: placeNote || `当日阴线包住昨日整根。${volText}`, warn: volWarn });
  }
  if (bullHarami) {
    const placeNote = atBottom ? "" : "不满足相对底部";
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, placeNote, name: "看涨孕线", kind: "止跌", rank: 5, note: placeNote || `昨日阴线实体包住当日阳线。${volText}`, warn: volWarn });
  }
  if (bearHarami) {
    const placeNote = atTop ? "" : "不满足相对顶部";
    hits.push({ form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: null, placeNote, name: "看跌孕线", kind: "见顶", rank: 5, note: placeNote || `昨日阳线实体包住当日阴线。${volText}`, warn: volWarn });
  }

  const middles: YahooCandle[] = [];
  for (let index = bars.length - 2; index >= 0; index -= 1) {
    if (!starShape(bars[index])) break;
    middles.unshift(bars[index]);
    if (middles.length > 3) break;
  }
  const trendBar = middles.length >= 1 && middles.length <= 3 ? bars[bars.length - 2 - middles.length] : undefined;
  const starsOk = trendBar != null && middles.length >= 1 && middles.length <= 3 && middles.every((star) => admittedStar(star, trendBar));
  const lastStar = middles[middles.length - 1];
  const starVolOk = trendBar && lastStar && trendBar.v > 0 && lastStar.v > 0 && Math.max(c.v / trendBar.v, c.v / lastStar.v) > 2 / 3 && Math.min(c.v / trendBar.v, c.v / lastStar.v) >= 0.5;
  const eveningVolOk = trendBar && lastStar && c.v > trendBar.v && c.v > lastStar.v;
  const morning = Boolean(starsOk && trendBar && bear(trendBar) && bull(c) && c.c > trendBar.o && starVolOk);
  const evening = Boolean(starsOk && trendBar && bull(trendBar) && bear(c) && c.c < trendBar.l && eveningVolOk);
  if (morning && trendBar) {
    const lows = [trendBar, ...middles, c].map((bar) => bar.l);
    const placeNote = atBottom ? "" : "启明星出现，但出现的位置不对";
    hits.push({
      form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: null, breakBelow: Math.min(...lows), placeNote,
      name: "启明星",
      kind: "止跌",
      rank: 3,
      note: placeNote || `中间星线成立，当天收盘高于趋势K开盘。${volText}`,
      warn: volWarn,
    });
  }
  if (evening && trendBar) {
    const highs = [trendBar, ...middles, c].map((bar) => bar.h);
    const placeNote = atTop ? "" : "黄昏之星出现，但出现的位置不对";
    hits.push({
      form: 0, volume: 0, score: 0, pass: false, explain: "", grade: "", breakAbove: Math.max(...highs), breakBelow: null, placeNote,
      name: "黄昏之星",
      kind: "见顶",
      rank: 4,
      note: placeNote || `中间星线成立，当天收盘跌破趋势K最低。${volText}`,
      warn: volWarn,
    });
  }

  const volumeScore =
    vol.label === "强放量" ? 100 : vol.label === "明显放量" ? 90 : vol.label === "最低放量" ? 75 : vol.label === "未达放量" ? 50 : vol.label === "平量" ? 35 : vol.label === "缩量" ? 10 : 0;
  const scored = hits.map((hit) => {
    const soft = /候选|试探|边缘/.test(`${hit.name}${hit.note}`);
    const form = soft ? 70 : 100;
    const score = Math.round(form * 0.68 + volumeScore * 0.32);
    const grade = score > 90 ? "强烈" : score >= 75 ? "标准" : score >= 60 ? "及格" : score >= 55 ? "可观察" : "无效";
    const explain =
      vol.label === "缩量" ? "缩量，已扣分。" : vol.label === "无量能" ? "无量能。" : vol.label === "未达放量" ? "量能未达放量。" : "";
    const anchor =
      hit.breakAbove != null || hit.breakBelow != null
        ? { breakAbove: hit.breakAbove, breakBelow: hit.breakBelow }
        : hit.name.includes("黄昏")
          ? { breakAbove: Math.max(a.h, b.h, c.h), breakBelow: null }
          : hit.name.includes("看跌孕线")
          ? { breakAbove: b.h, breakBelow: null }
          : hit.name.includes("启明星")
            ? { breakAbove: null, breakBelow: Math.min(a.l, b.l, c.l) }
            : hit.name.includes("看涨孕线")
              ? { breakAbove: null, breakBelow: b.l }
              : hit.name.includes("倒锤子")
            ? { breakAbove: Math.max(c.o, c.c), breakBelow: Math.min(c.o, c.c) }
            : hit.kind === "见顶"
                ? { breakAbove: c.h, breakBelow: null }
                : { breakAbove: null, breakBelow: c.l };
    const breakHow = hit.name.includes("倒锤子")
      ? "invert"
      : hit.name.includes("孕线")
      ? "touch"
      : hit.name.includes("抱线") || hit.name.includes("黄昏")
        ? "strict"
        : hit.name.includes("启明星")
          ? "close-below"
          : "color";
    return { ...hit, ...anchor, breakHow, form, volume: volumeScore, score, pass: score >= 60, grade, explain };
  });
  scored.sort((left, right) => right.score - left.score || left.rank - right.rank);
  return { trend, hits: scored };
}

export type PatternSeed = {
  name: string;
  kind: "止跌" | "见顶";
  score: number;
  grade: string;
  explain: string;
  signalMs: number;
  breakAbove: number | null;
  breakBelow: number | null;
  breakHow: "strict" | "touch" | "color" | "close-below";
  placeNote: string;
};

function etDay(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function scanPatterns(bars: YahooCandle[]): PatternSeed[] {
  const seeds: PatternSeed[] = [];
  for (let i = 2; i < bars.length; i += 1) {
    if (etDay(bars[i].t) < "2026-11-01") continue;
    const read = readThree(bars.slice(0, i + 1));
    for (const hit of read.hits) {
      seeds.push({
        name: hit.name,
        kind: hit.kind,
        score: hit.score,
        grade: hit.grade,
        explain: hit.explain,
        signalMs: bars[i].t,
        breakAbove: hit.breakAbove,
        breakBelow: hit.breakBelow,
        breakHow: hit.breakHow ?? "color",
        placeNote: hit.placeNote ?? "",
      });
    }
  }
  return seeds;
}
