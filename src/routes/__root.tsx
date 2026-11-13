import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CommandSearch } from "@/components/command-search";
import appCss from "../styles.css?url";

const APP_NAME = "MetricTrader";

function DropCachedPage() {
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}

function RecoverStalePage({ error }: { error: unknown }) {
  useEffect(() => {
    const message = error instanceof Error ? error.message : "";
    if (!/dynamically imported module|Failed to fetch/i.test(message)) return;
    const key = "mt-chunk-reload";
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }, [error]);
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">页面需要刷新</h1>
      <p className="mt-3 text-sm text-muted">刚才的脚本已经更新，请再打开一次。</p>
      <button
        type="button"
        className="mt-6 h-11 rounded-full bg-ink px-5 text-sm font-medium text-white"
        onClick={() => window.location.reload()}
      >
        刷新
      </button>
    </main>
  );
}

export const Route = createRootRoute({
  headers: () => ({
    "Cache-Control": "no-store",
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MetricTrader — 支撑、压力、右侧" },
      {
        name: "description",
        content: "看收盘价落在压力还是支撑。突破压力后该档变为支撑，跌进支撑后该档变为压力。",
      },
      { name: "theme-color", content: "#f5f5f7" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  errorComponent: RecoverStalePage,
  component: () => (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <DropCachedPage />
        <AuthProvider>
          <SiteHeader />
          <CommandSearch />
          <Outlet />
          <SiteFooter />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

export { APP_NAME };
