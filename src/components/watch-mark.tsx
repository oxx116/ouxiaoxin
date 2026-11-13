import { useEffect, useRef, useState } from "react";
import { addWatch, listWatch, removeWatch } from "@/lib/access";

let cache: Promise<Set<string>> | null = null;

function loadSet(force = false) {
  if (force || !cache) {
    cache = listWatch()
      .then((rows) => new Set(rows.map((row) => row.ticker.toUpperCase())))
      .catch(() => new Set<string>());
  }
  return cache;
}

export function refreshWatch() {
  cache = null;
  window.dispatchEvent(new Event("watch-changed"));
}

export function WatchMark({ ticker, quiet = false }: { ticker: string; quiet?: boolean }) {
  const key = ticker.trim().toUpperCase();
  const [on, setOn] = useState(false);
  const [fx, setFx] = useState<"" | "beat" | "break" | "back">("");
  const wish = useRef<boolean | null>(null);
  const fxWave = useRef(0);

  function play(kind: "beat" | "break") {
    const wave = fxWave.current + 1;
    fxWave.current = wave;
    if (kind === "beat") {
      setFx("beat");
      window.setTimeout(() => {
        if (fxWave.current === wave) setFx("");
      }, 780);
      return;
    }
    setFx("break");
    window.setTimeout(() => {
      if (fxWave.current === wave) setFx("back");
    }, 1850);
    window.setTimeout(() => {
      if (fxWave.current === wave) setFx("");
    }, 2270);
  }

  useEffect(() => {
    let alive = true;
    const read = () => {
      void loadSet().then((set) => {
        if (!alive) return;
        setOn(wish.current === null ? set.has(key) : wish.current);
        if (wish.current !== null && set.has(key) === wish.current) wish.current = null;
      });
    };
    read();
    window.addEventListener("watch-changed", read);
    return () => {
      alive = false;
      window.removeEventListener("watch-changed", read);
    };
  }, [key]);

  if (!key) return null;
  const lightRed = "#e7a0a0";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "移出自选" : "加入自选"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = !on;
        wish.current = next;
        setOn(next);
        play(next ? "beat" : "break");
        const run = next ? addWatch({ data: { ticker: key } }) : removeWatch({ data: { ticker: key } });
        void run
          .then((result) => {
            if (next && result && "ok" in result && result.ok === false) {
              wish.current = null;
              setOn(false);
              return;
            }
            refreshWatch();
          })
          .catch(() => {
            wish.current = on;
            setOn(on);
          });
      }}
      className={`relative z-20 grid shrink-0 place-items-center ${quiet ? "size-9" : "size-11"}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`${quiet ? "size-6" : "size-7"} ${fx === "beat" ? "heart-beat" : ""}`}>
        {fx === "break" ? (
          <>
            <g className="heart-half heart-half-left">
              <path d="M12 20.4 4.4 13.1a4.8 4.8 0 0 1 6.8-6.8L12 7.1l.8-.8a4.8 4.8 0 0 1 6.8 6.8L12 20.4z" fill="#c5c5c1" />
            </g>
            <g className="heart-half heart-half-right">
              <path d="M12 20.4 4.4 13.1a4.8 4.8 0 0 1 6.8-6.8L12 7.1l.8-.8a4.8 4.8 0 0 1 6.8 6.8L12 20.4z" fill="#b7b7b3" />
            </g>
          </>
        ) : (
          <path
            d="M12 20.4 4.4 13.1a4.8 4.8 0 0 1 6.8-6.8L12 7.1l.8-.8a4.8 4.8 0 0 1 6.8 6.8L12 20.4z"
            fill={on ? lightRed : "none"}
            stroke={on ? lightRed : "#8a8a86"}
            strokeWidth={on ? 0 : 1.8}
            strokeLinejoin="round"
            className={fx === "back" ? "heart-pop" : undefined}
            style={{ fill: on ? lightRed : "none", stroke: on ? lightRed : "#8a8a86" }}
          />
        )}
      </svg>
    </button>
  );
}
