import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Per-endpoint limiters, tighter than the global 300-req/15min limiter
 * already applied to the whole API in app.ts (Phase 1). Auth endpoints are
 * the ones worth throttling specifically against brute force / credential
 * stuffing / mail-bombing via verification-resend or reset requests.
 */
function limiterResponse(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ success: false, message });
  };
}

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterResponse("Too many signup attempts. Please try again later."),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterResponse("Too many login attempts. Please try again later."),
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterResponse("Too many refresh attempts. Please try again later."),
});

export const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterResponse("Too many requests. Please try again later."),
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterResponse("Too many requests. Please try again later."),
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterResponse("Too many attempts. Please try again later."),
});
