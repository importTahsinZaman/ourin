/**
 * Set a cookie with proper security flags.
 *
 * Security flags:
 * - SameSite=Lax: Prevents CSRF attacks while allowing normal navigation
 * - Secure: Only send over HTTPS
 *
 * Note: These are preference/UI cookies, not auth cookies.
 * Auth is handled by Convex Auth which manages its own cookies.
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
 * Delete a cookie by setting max-age to 0.
 * Uses matching attributes (path, SameSite, Secure) to ensure deletion works.
 */
export function deleteCookie(name: string): void {
  if (typeof window === "undefined") return;

  const isSecure = window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";

  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
}

/**
 * Get a cookie value by name.
 * Handles values containing "=" characters (e.g., Base64-encoded data).
 */
export function getCookie(name: string): string | null {
  if (typeof window === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  return match ? match.substring(name.length + 1) : null;
}
