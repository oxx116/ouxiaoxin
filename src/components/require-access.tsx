import { useEffect, useState, type ReactNode } from "react";
import { loadBrief } from "@/lib/access";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

function justEntered() {
  try {
    const at = Number(sessionStorage.getItem("mt-entering") || 0);
    return at > 0 && Date.now() - at < 20000;
  } catch {
    return false;
  }
}

function leave(notice?: string) {
  if (justEntered()) return;
  window.location.replace(notice ? `/login?notice=${notice}` : "/login");
}

export function RequireAccess({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [status, setStatus] = useState<"loading" | "ok" | "expired" | "disabled">("loading");

  useEffect(() => {
    if (isPending || !user) return;
    let alive = true;
    loadBrief(user.id)
      .then((access) => {
        if (!alive) return;
        sessionStorage.removeItem("mt-entering");
        sessionStorage.removeItem("mt-login-draft");
        if (access.status === "ok" || access.isAdmin) setStatus("ok");
        else setStatus(access.status);
      })
      .catch(() => {
        if (alive) setStatus("ok");
      });
    return () => {
      alive = false;
    };
  }, [user, isPending]);

  useEffect(() => {
    if (isPending || user) return;
    const wait = justEntered() ? 4000 : 800;
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem("mt-entering");
      leave();
    }, wait);
    return () => window.clearTimeout(timer);
  }, [isPending, user]);

  useEffect(() => {
    if (status === "expired" || status === "disabled") leave(status);
  }, [status]);

  if (isPending || (!user && justEntered())) return null;
  if (!user || status === "expired" || status === "disabled") return null;
  return <>{children}</>;
}