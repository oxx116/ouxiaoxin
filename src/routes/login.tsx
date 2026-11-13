import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, rememberSessionToken, signIn } from "@/lib/auth/client";
import { clearSignedOutLocal, markSignedOutLocal } from "@/lib/auth/signed-out";
import { WelcomeSplash } from "@/components/welcome-splash";

export const Route = createFileRoute("/login")({ component: LoginPage });

const DRAFT = "mt-login-draft";

function readDraft(): { email: string; password: string; mode: "in" | "up" } {
  try {
    const raw = JSON.parse(sessionStorage.getItem(DRAFT) || "{}") as { email?: string; password?: string; mode?: "in" | "up" };
    return {
      email: raw.email || "",
      password: raw.password || "",
      mode: raw.mode === "up" ? "up" : "in",
    };
  } catch {
    return { email: "", password: "", mode: "in" as const };
  }
}

function writeDraft(email: string, password: string, mode: "in" | "up") {
  sessionStorage.setItem(DRAFT, JSON.stringify({ email, password, mode }));
}

async function postAuth(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as { token?: string; user?: { id?: string }; message?: string } | null;
  return { ok: response.ok, data };
}

function ProviderLogo({ id }: { id: string }) {
  if (id === "google") {
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3.1 5.2-5.9 6.5l6.3 5.3C38.2 37.3 44 32 44 24c0-1.3-.1-2.7-.4-3.5z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#111" d="M18.2 2H21l-6.5 7.4L22 22h-6.8l-4.3-6.6L6 22H3.2l7-8L2 2h7l3.9 6.1L18.2 2zm-1.2 18h1.8L7.1 3.9H5.2L17 20z" />
    </svg>
  );
}

const CANDLE_PATTERNS = [
  [14, 16, -6, 18, 12, -5, 20, 15, 10, -7, 22, 14, 18, -6, 20, 16, 12, 18, 22, 16],
  [-16, -18, -12, -8, 6, -10, -14, 8, 12, 18, 14, 20, 16, -6, 22, 18, 24, 16, 20, 22],
  [16, 18, 14, 12, -8, 10, -16, -18, -14, -12, -8, 6, 14, 18, 16, 20, 12, 22, 18, 16],
  [12, 18, 22, 16, 20, 14, 10, -8, -14, -18, -12, -16, -10, -8, 6, -12, -10, 8, -6, -8],
  [10, -12, 14, -10, 12, -14, 8, -10, 16, -8, 12, 18, 14, 20, -6, 22, 16, 24, 18, 20],
];

function RisingCandles() {
  const [run, setRun] = useState(0);
  const [pattern, setPattern] = useState(() => Math.floor(Math.random() * CANDLE_PATTERNS.length));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPattern(Math.floor(Math.random() * CANDLE_PATTERNS.length));
      setRun((value) => value + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);
  let price = 0;
  const raw = CANDLE_PATTERNS[pattern].map((step) => {
    const open = price;
    price += step;
    return { low: Math.min(open, price), high: Math.max(open, price), up: step > 0 };
  });
  const min = Math.min(...raw.map((bar) => bar.low));
  const max = Math.max(...raw.map((bar) => bar.high));
  const span = max - min || 1;
  const floor = 408;
  const usable = 360;
  const bars = raw.map((bar) => ({
    ...bar,
    top: floor - ((bar.high - min) / span) * usable,
    body: Math.max(14, ((bar.high - bar.low) / span) * usable),
  }));
  return (
    <svg key={run} viewBox="0 0 560 440" className="h-[460px] w-full">
      {bars.map((bar, index) => {
        const x = 14 + index * 27;
        const color = bar.up ? "#1d7a45" : "#c41e16";
        return (
          <g key={x} className="login-bar" style={{ animationDelay: `${index * 0.48}s` }}>
            <line x1={x + 8} y1={bar.top - 8} x2={x + 8} y2={bar.top + bar.body} stroke={color} strokeWidth="1.6" />
            <rect x={x} y={bar.top} width="16" height={bar.body} rx="1.4" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
function LoginPage() {
  const draft = readDraft();
  const [mode, setMode] = useState<"in" | "up">(draft.mode);
  const [email, setEmail] = useState(draft.email);
  const [password, setPassword] = useState(draft.password);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [welcome, setWelcome] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("notice");
    if (reason === "expired") setError("访问时间已到。请联系管理员续期后再登录。");
    if (reason === "disabled") setError("这个账户已停用。请联系管理员恢复访问。");
  }, []);

  function keep(nextEmail: string, nextPassword: string, nextMode: "in" | "up" = mode) {
    setEmail(nextEmail);
    setPassword(nextPassword);
    writeDraft(nextEmail, nextPassword, nextMode);
  }

  async function enter(next: "in" | "up") {
    if (pending) return;
    const address = email.trim().toLowerCase();
    setMode(next);
    keep(address, password, next);
    if (!address || password.length < 8) {
      setError(next === "up" ? "密码至少 8 位。" : "请填写邮箱和密码。");
      return;
    }
    if (next === "up" && password !== confirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    setError("");
    setPending(true);
    try {
      clearSignedOutLocal();
      const path = next === "up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";
      const { ok, data } = await postAuth(path, { email: address, password, name: address });
      if (!ok || !data?.user?.id) {
        const message = (data?.message || "").toLowerCase();
        if (next === "up" && (message.includes("exist") || message.includes("already"))) {
          setMode("in");
          writeDraft(address, password, "in");
          setError("这个邮箱已经注册过，直接登录。");
        } else {
          setError(next === "up" ? "注册没有成功，请再试一次。" : "邮箱或密码不对。");
        }
        setPending(false);
        return;
      }
      if (next === "up") {
        rememberSessionToken(null);
        const { endSession } = await import("@/lib/auth/end-session");
        await endSession().catch(() => undefined);
        markSignedOutLocal();
        setPassword("");
        setConfirm("");
        setMode("in");
        writeDraft(address, "", "in");
        setWelcome(true);
        setPending(false);
        return;
      }
      if (data.token) rememberSessionToken(data.token);
      sessionStorage.setItem("mt-entering", String(Date.now()));
      sessionStorage.setItem("mt-welcome-back", "1");
      window.location.assign("/");
      return;
    } catch {
      setError("没有连上，请再点一次。邮箱和密码还在。");
      setPending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await enter(mode);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f3ef] px-6 py-16 md:px-20 md:py-24">
      {welcome ? <WelcomeSplash onDone={() => setWelcome(false)} /> : null}
      <div className="pointer-events-none absolute bottom-6 right-[2%] top-16 hidden w-[460px] md:block" aria-hidden="true">
        <RisingCandles />
      </div>
      <div className="relative max-w-xl">
        <div className="flex items-center gap-2 text-ink">
          <svg width="34" height="36" viewBox="0 0 34 36" aria-hidden="true" className="shrink-0">
            <path
              fill="currentColor"
              d="M1 25.5V6.5h3.2l5.3 12.4L14.8 6.5H18v19h-3.1v-9.4L10.2 25h-2.4L3.1 16.1v9.4H1z"
            />
            <path fill="currentColor" d="M16.5 6.2h16.2v2.6H16.5z" />
            <path d="M24.6 8.8v24" stroke="#1d7a45" strokeWidth="1.2" />
            <rect x="21.8" y="11.2" width="5.6" height="18.4" rx="0.6" fill="#1d7a45" />
          </svg>
          <span className="font-display text-[1.7rem] font-medium leading-none tracking-[0.06em]">MetricTrader</span>
        </div>
        <h1 className="mt-16 font-display text-5xl font-medium tracking-tight text-ink md:text-7xl">
          {welcome ? "歡迎" : mode === "up" ? "注册" : "登录"} <span className="italic">MetricTrader</span>
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#5c5c5c]">
          {welcome
            ? "欢迎加入 MetricTrader。请用刚才的邮箱和密码登录。"
            : mode === "up"
              ? "注册后可以看支撑、压力和右侧。"
              : "登录后进入首页。邮箱和密码会留在这里，直到登录成功。"}
        </p>
        <form onSubmit={submit} className="mt-10 max-w-sm space-y-3" autoComplete="on">
          {mode === "up" ? (
            <>
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                placeholder="注册邮箱"
                value={email}
                onChange={(event) => keep(event.target.value, password, "up")}
                className="h-12 w-full rounded-2xl border border-black/10 bg-white/70 px-4 text-base text-ink outline-none placeholder:text-[#9a9a9a]"
              />
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="设置密码，至少 8 位"
                value={password}
                onChange={(event) => keep(email, event.target.value, "up")}
                className="h-12 w-full rounded-2xl border border-black/10 bg-white/70 px-4 text-base text-ink outline-none placeholder:text-[#9a9a9a]"
              />
              <input
                type="password"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="验证密码"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="h-12 w-full rounded-2xl border border-black/10 bg-white/70 px-4 text-base text-ink outline-none placeholder:text-[#9a9a9a]"
              />
            </>
          ) : (
            <>
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                placeholder="邮箱"
                value={email}
                onChange={(event) => keep(event.target.value, password)}
                className="h-12 w-full rounded-2xl border border-black/10 bg-white/70 px-4 text-base text-ink outline-none placeholder:text-[#9a9a9a]"
              />
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="current-password"
                placeholder="密码"
                value={password}
                onChange={(event) => keep(email, event.target.value)}
                className="h-12 w-full rounded-2xl border border-black/10 bg-white/70 px-4 text-base text-ink outline-none placeholder:text-[#9a9a9a]"
              />
            </>
          )}
          {error ? <p className="text-sm leading-6 text-bad">{error}</p> : null}
          <div className="flex justify-center gap-16 pt-5">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (mode === "up") {
                  setMode("in");
                  setError("");
                  setWelcome(false);
                  writeDraft(email, password, "in");
                  return;
                }
                setWelcome(false);
                void enter("in");
              }}
              className="h-12 w-36 rounded-2xl border border-ink bg-white/50 text-[15px] font-medium tracking-[0.14em] text-ink shadow-[0_1px_0_rgba(0,0,0,0.04)] transition duration-300 hover:bg-transparent hover:shadow-none disabled:opacity-60"
            >
              {pending && mode === "in" ? "进入中" : "登录"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (mode !== "up") {
                  setMode("up");
                  setError("");
                  setWelcome(false);
                  writeDraft(email, password, "up");
                  return;
                }
                void enter("up");
              }}
              className="h-12 w-36 rounded-2xl border border-ink bg-white/50 text-[15px] font-medium tracking-[0.14em] text-ink shadow-[0_1px_0_rgba(0,0,0,0.04)] transition duration-300 hover:bg-transparent hover:shadow-none disabled:opacity-60"
            >
              {pending && mode === "up" ? "进入中" : "注册"}
            </button>
          </div>
        </form>
        <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              disabled={pending}
              onClick={() => {
                if (pending) return;
                const attempt = signIn(provider.providerId, { callbackURL: "/" });
                setPending(true);
                setError("");
                void attempt.catch((cause) => {
                  setPending(false);
                  const message = cause instanceof Error ? cause.message : "";
                  if (message.toLowerCase().includes("pop-up")) {
                    setError("浏览器拦住了登录窗口。请允许弹出窗口后再点一次。");
                    return;
                  }
                  setError(message ? `X 或 Google 没有打开：${message}` : "没有打开登录，请再点一次。");
                });
              }}
              className="grid h-12 w-full grid-cols-[1.25rem_1fr] items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 text-sm text-ink transition duration-300 hover:border-black/20 hover:bg-transparent disabled:opacity-60"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <ProviderLogo id={provider.idp} />
              </span>
              <span className="-ml-5 text-center">用 {provider.label} 继续</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
