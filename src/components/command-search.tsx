import { useEffect, useMemo, useRef, useState } from "react";
import { listHome } from "@/lib/levels";
import { TickerLogo } from "@/components/ticker-logo";

type Hit = { ticker: string; name: string };

export function useShortcutLabel() {
  const [label, setLabel] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setLabel("⌘K");
  }, []);
  return label;
}

function visibleSearch() {
  const box = document.getElementById("stock-search");
  return box instanceof HTMLInputElement && box.offsetParent !== null ? box : null;
}

export function CommandSearch() {
  const label = useShortcutLabel();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Hit[] | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (window.location.pathname === "/login") return;
      event.preventDefault();
      const box = visibleSearch();
      if (box) {
        box.focus();
        box.select();
        return;
      }
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const frame = window.requestAnimationFrame(() => input.current?.focus());
    if (!rows) {
      void listHome()
        .then((next) => setRows(next.levels.map((level) => ({ ticker: level.ticker, name: level.name }))))
        .catch(() => setRows([]));
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, rows]);

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return (rows ?? []).slice(0, 8);
    return (rows ?? [])
      .filter((row) => row.ticker.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [rows, query]);

  function choose(ticker: string) {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    setOpen(false);
    if (window.location.pathname === "/") {
      window.dispatchEvent(new CustomEvent("app-find", { detail: symbol }));
      return;
    }
    window.location.assign(`/?q=${encodeURIComponent(symbol)}`);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/35 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div
        className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl bg-[#f4f3ef] shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const pick = hits[active] ?? hits[0];
            if (pick) choose(pick.ticker);
          }}
        >
          <label className="flex items-center gap-3 border-b border-black/10 px-4">
            <span className="sr-only">搜索股票代码</span>
            <input
              ref={input}
              value={query}
              autoComplete="off"
              placeholder="搜索股票代码"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((index) => Math.min(index + 1, Math.max(hits.length - 1, 0)));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => Math.max(index - 1, 0));
                }
              }}
              className="h-14 min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-faint"
            />
            <kbd className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[11px] text-faint">{label}</kbd>
          </label>
        </form>
        {rows === null ? <p className="px-4 py-4 text-sm text-muted">正在读取</p> : null}
        {rows && hits.length === 0 ? <p className="px-4 py-4 text-sm text-muted">无观察结果，敬请期待</p> : null}
        <ul>
          {hits.map((row, index) => (
            <li key={row.ticker}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-4 py-3 text-left ${index === active ? "bg-white" : ""}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(row.ticker)}
              >
                <TickerLogo ticker={row.ticker} />
                <span className="font-bold text-ink">{row.ticker}</span>
                {row.name ? <span className="truncate text-sm text-faint">{row.name}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
