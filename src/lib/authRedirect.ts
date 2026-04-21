const AUTH_REDIRECT_KEY = "gamespark-auth-redirect";

export function setAuthRedirect(path: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_REDIRECT_KEY, path);
}

export function getAuthRedirect() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(AUTH_REDIRECT_KEY);
}

export function clearAuthRedirect() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_REDIRECT_KEY);
}
