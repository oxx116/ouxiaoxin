import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearSignedOutLocal } from "@/lib/auth/signed-out";
import { loadBrief } from "@/lib/access";
import { ProviderMark } from "@/components/provider-mark";

export function SiteHeader() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const onLogin = path === "/login";
  const atHome = path === "/";
  const admin = useAdminFlag();
  const [menu, setMenu] = useState(false);
  const [dock, setDock] = useState(false);
  const [query, setQuery] = useState("");
  const [spark, setSpark] = useState(0);
  const lastY = useRef(0);
  const glassWave = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const down = y > lastY.current + 6;
      if (menu && down) setMenu(false);
      if (atHome) setDock(y > 160);
      else setDock(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [atHome, menu]);

  useEffect(() => {
    setMenu(false);
  }, [path]);

  if (onLogin) return null;

  function home() {
    window.dispatchEvent(new Event("app-home"));
    if (path !== "/") void navigate({ to: "/" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f4f3ef]/95 backdrop-blur-xl">
      <div className="relative mx-auto max-w-7xl px-5">
        <div className="relative flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-6">
            <button type="button" aria-label="返回首页" className="flex min-w-0 items-center gap-2 text-ink" onClick={home}>
              <svg width="34" height="36" viewBox="0 0 34 36" aria-hidden="true" className="shrink-0">
                <path
                  fill="currentColor"
                  d="M1 25.5V6.5h3.2l5.3 12.4L14.8 6.5H18v19h-3.1v-9.4L10.2 25h-2.4L3.1 16.1v9.4H1z"
                />
                <path fill="currentColor" d="M16.5 6.2h16.2v2.6H16.5z" />
                <path d="M24.6 8.8v24" stroke="#1d7a45" strokeWidth="1.2" />
                <rect x="21.8" y="11.2" width="5.6" height="18.4" rx="0.6" fill="#1d7a45" />
              </svg>
              <span className={`truncate font-display text-[1.65rem] font-medium leading-none tracking-[0.06em] ${dock ? "max-md:hidden" : ""}`}>
                MetricTrader
              </span>
            </button>
            <button type="button" className={`hidden text-sm font-medium md:inline ${atHome ? "text-ink" : "text-muted"}`} onClick={home}>
              首页
            </button>
            <Link to="/watch" className={`hidden text-sm font-medium md:inline ${path === "/watch" ? "text-ink" : "text-muted"}`}>
              我的自选
            </Link>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            {admin ? (
              <>
                <Link to="/manage" className={`text-sm font-medium ${path === "/manage" ? "text-ink" : "text-muted"}`}>
                  更新位置
                </Link>
                <Link to="/users" className={`text-sm font-medium ${path === "/users" ? "text-ink" : "text-muted"}`}>
                  用户管理
                </Link>
              </>
            ) : null}
            <AuthSlot />
          </div>
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-full text-ink md:hidden"
            aria-label={menu ? "关闭菜单" : "打开菜单"}
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
              {menu ? (
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
        {dock && !menu ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ticker = query.trim();
              if (!ticker) return;
              const wave = glassWave.current + 1;
              glassWave.current = wave;
              setSpark(wave);
              window.setTimeout(() => {
                if (glassWave.current === wave) setSpark(0);
              }, 1600);
              if (path === "/") window.dispatchEvent(new CustomEvent("app-find", { detail: ticker }));
              else window.location.assign(`/?q=${encodeURIComponent(ticker)}`);
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <label className="relative block">
              <span className="sr-only">搜索股票代码</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ticker"
                autoComplete="off"
                className="h-8 w-28 border-0 border-b border-black/25 bg-transparent px-1 pr-6 pb-0 pt-2 text-base leading-none text-ink outline-none placeholder:text-faint"
              />
              <button type="submit" aria-label="Search" className="absolute right-0 bottom-0.5 grid size-5 place-items-center text-ink">
                <span className="relative grid size-5 place-items-center">
                  {spark > 0 ? <HeaderGlass key={spark} color /> : <HeaderGlass />}
                </span>
              </button>
            </label>
          </form>
        ) : null}
        <nav
          className={`space-y-1 overflow-hidden transition-all duration-300 ease-out md:hidden ${
            menu ? "max-h-96 border-t border-black/5 py-3 opacity-100" : "pointer-events-none max-h-0 border-transparent py-0 opacity-0"
          }`}
        >
            <button
              type="button"
              className={`block w-full rounded-2xl px-3 py-3 text-left text-base ${atHome ? "bg-white text-ink" : "text-ink"}`}
              onClick={home}
            >
              首页
            </button>
            <Link
              to="/watch"
              className={`block rounded-2xl px-3 py-3 text-base ${path === "/watch" ? "bg-white text-ink" : "text-ink"}`}
            >
              我的自选
            </Link>
            {admin ? (
              <>
                <Link
                  to="/manage"
                  className={`block rounded-2xl px-3 py-3 text-base ${path === "/manage" ? "bg-white text-ink" : "text-ink"}`}
                >
                  更新位置
                </Link>
                <Link
                  to="/users"
                  className={`block rounded-2xl px-3 py-3 text-base ${path === "/users" ? "bg-white text-ink" : "text-ink"}`}
                >
                  用户管理
                </Link>
              </>
            ) : null}
            <div className="border-t border-black/5 pt-2">
              <AuthSlot stacked />
            </div>
          </nav>
      </div>
    </header>
  );
}

function HeaderGlass({ color = false }: { color?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={color ? "search-glass-color absolute inset-0 size-5" : "size-5"}>
      <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke={color ? "url(#gemini-glass-bar)" : "currentColor"} strokeWidth="2.6" />
      <path d="M15.2 15.2 20 20" fill="none" stroke={color ? "url(#gemini-glass-bar)" : "currentColor"} strokeWidth="2.6" strokeLinecap="round" />
      {color ? (
        <defs>
          <linearGradient id="gemini-glass-bar" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
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

function useAdminFlag() {
  const { user } = useCurrentUserState();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    let alive = true;
    loadBrief(user.id)
      .then((brief) => {
        if (alive) setAdmin(brief.isAdmin);
      })
      .catch(() => {
        if (alive) setAdmin(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);
  return admin;
}
function savedVia(userId: string): Array<"google" | "x"> {
  try {
    const raw = sessionStorage.getItem(`mt-via:${userId}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item === "google" || item === "x");
  } catch {
    return [];
  }
}

function AuthSlot({ stacked = false }: { stacked?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [via, setVia] = useState<Array<"google" | "x">>([]);

  useEffect(() => {
    if (!user) return;
    const known = savedVia(user.id);
    if (known.length > 0) setVia(known);
    let alive = true;
    loadBrief(user.id)
      .then((account) => {
        if (!alive) return;
        const next = account.via.length > 0 ? account.via : known;
        setVia(next);
        if (next.length > 0) sessionStorage.setItem(`mt-via:${user.id}`, JSON.stringify(next));
      })
      .catch(() => {
        if (alive && known.length === 0) setVia([]);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  if (user) clearSignedOutLocal();
  if (isPending || !user) return null;
  const label = user.displayName && user.displayName !== user.primaryEmail ? user.displayName : user.primaryEmail;
  return (
    <div className={stacked ? "flex flex-col gap-1 px-1" : "flex items-center gap-3"}>
      <span className={`flex items-center gap-1.5 text-sm text-muted ${stacked ? "px-2 py-2" : "max-w-[16rem]"}`}>
        <span className={stacked ? "break-all" : "truncate"}>{label}</span>
        {via.map((item) => (
          <ProviderMark key={item} via={item} />
        ))}
      </span>
      <button
        type="button"
        disabled={signingOut}
        onClick={() => {
          setSignOutFailed(false);
          setSigningOut(true);
          void signOut("/login").catch(() => {
            setSigningOut(false);
            setSignOutFailed(true);
          });
        }}
        className={stacked ? "rounded-2xl px-3 py-3 text-left text-base text-ink disabled:opacity-60" : "text-sm text-muted disabled:opacity-60"}
      >
        {signingOut ? "正在退出" : signOutFailed ? "再试一次" : "退出"}
      </button>
    </div>
  );
}

export function SiteFooter() {
  const admin = useAdminFlag();
  return (
    <footer className="mx-auto flex max-w-xl items-center justify-between px-5 py-12 text-xs leading-5 text-faint">
      <p>不是实时行情，也不构成投资建议。</p>
      {admin ? (
        <span className="flex gap-4">
          <Link to="/manage" className="text-faint hover:text-ink">
            更新位置
          </Link>
          <Link to="/users" className="text-faint hover:text-ink">
            用户管理
          </Link>
        </span>
      ) : (
        <span />
      )}
    </footer>
  );
}
