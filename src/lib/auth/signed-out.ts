export const SIGNED_OUT_COOKIE = "mt-signed-out";
export const SIGNED_OUT_STORAGE = "mt-signed-out";

export function markSignedOutLocal() {
  try {
    window.sessionStorage.setItem(SIGNED_OUT_STORAGE, "1");
  } catch {
    /* ignore */
  }
}

export function clearSignedOutLocal() {
  try {
    window.sessionStorage.removeItem(SIGNED_OUT_STORAGE);
  } catch {
    /* ignore */
  }
  document.cookie = `${SIGNED_OUT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${SIGNED_OUT_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}

export function hasSignedOutLocal() {
  try {
    return window.sessionStorage.getItem(SIGNED_OUT_STORAGE) === "1";
  } catch {
    return false;
  }
}
