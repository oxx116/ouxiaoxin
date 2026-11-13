import { createServerFn } from "@tanstack/react-start";
import { GATE_SESSION_MARKER_COOKIE } from "./gate-session-marker";
import { SIGNED_OUT_COOKIE } from "./signed-out";

const COOKIES = [
  "__Host-grok-auth.session_token",
  "__Host-grok-auth.session_data",
  "__Host-grok-auth.account_data",
  "__Host-grok-auth.dont_remember",
  GATE_SESSION_MARKER_COOKIE,
];

export const endSession = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequestHeaders, setCookie } = await import("@tanstack/react-start/server");
  const { auth } = await import("./server");
  const headers = getRequestHeaders();
  try {
    const session = await auth.api.getSession({ headers }).catch(() => null);
    if (session?.user?.id) {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`delete from "session" where "userId" = ${session.user.id}`;
    }
    await auth.api.signOut({ headers }).catch(() => undefined);
    const { forgetVerified } = await import("./verify.server");
    forgetVerified();
  } finally {
    for (const name of COOKIES) {
      setCookie(name, "", {
        path: "/",
        secure: true,
        sameSite: "lax",
        maxAge: 0,
        httpOnly: name !== GATE_SESSION_MARKER_COOKIE,
      });
    }
    setCookie(SIGNED_OUT_COOKIE, "1", {
      path: "/",
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      httpOnly: false,
    });
  }
  return { ok: true };
});
