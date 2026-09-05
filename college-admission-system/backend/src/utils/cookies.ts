import { Response, CookieOptions } from "express";
import { env } from "@/config/env";
import { REFRESH_TOKEN_MAX_AGE_MS } from "@/utils/jwt";

/**
 * Scope the cookie to only the auth routes that need it, rather than the
 * whole API — reduces the blast radius of any future cookie-reading bug
 * elsewhere and keeps it out of request headers for unrelated endpoints.
 */
const REFRESH_COOKIE_PATH = "/api/v1/auth";

/**
 * Cross-site cookie configuration (per Phase 1 §1.3.1):
 * - Production: frontend (Vercel) and backend (Render) are different
 *   origins, so SameSite=None is required or the browser will simply never
 *   send the cookie back. SameSite=None is only honored by browsers when
 *   Secure is also true.
 * - Development: localhost is plain HTTP, where Secure+SameSite=None
 *   cookies get silently rejected — so dev falls back to SameSite=Lax and
 *   Secure=false, which works fine since frontend and backend are both on
 *   localhost (same-site, even if different ports).
 */
function baseCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, baseCookieOptions());
}
