/**
 * set a cookie with proper security flags.
 *
 * security flags:
 * - sameSite=lax: prevents cSRF attacks while allowing normal navigation
 * - secure: only send over hTTPS
 *
 * note: these are preference/uI cookies, not auth cookies.
 * auth is handled by convex auth which manages its own cookies.
 */
export function setCookie(
  name: string,
  value: string | number | boolean,
  maxAgeSeconds: number = 60 * 60 * 24 * 365 // 1 year default
): void {
  if (typeof window === "undefined") return;

  const isSecure = window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";

  document.cookie = `${name}=${String(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
}

/**
 * delete a cookie by setting max-age to 0.
 * uses matching attributes (path, sameSite, secure) to ensure deletion works.
 */
export function deleteCookie(name: string): void {
  if (typeof window === "undefined") return;

  const isSecure = window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";

  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
}

/**
 * get a cookie value by name.
 * handles values containing "=" characters (e.g., base64-encoded data).
 */
export function getCookie(name: string): string | null {
  if (typeof window === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  return match ? match.substring(name.length + 1) : null;
}
