import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/utils/jwt";
import { AppError } from "@/middlewares/error.middleware";

/**
 * The ONLY real authentication enforcement point in this system (per
 * Phase 1 §1.4). Next.js middleware on the frontend can only see cookies,
 * never the in-memory access token, so it is UX-only — every protected
 * route MUST go through this middleware server-side regardless of what
 * the frontend already checked.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    // Covers both expired and malformed/invalid-signature tokens — the
    // client's response is the same either way, prompting it to call
    // /auth/refresh and retry.
    throw new AppError("Invalid or expired access token", 401);
  }
}
