import { z } from "zod";

// Every schema validates the full { body, params, query } shape that
// middlewares/validate.middleware.ts passes in — this keeps validation
// consistent regardless of whether a value comes from the request body or
// a route param (e.g. :token).

export const signupSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    // bcrypt silently truncates input beyond 72 bytes — capping here avoids
    // a confusing situation where a very long password "works" at signup
    // but the tail of it is never actually checked.
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1, "Password is required"),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({
    token: z.string().min(1),
  }),
  body: z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
  }),
});

export const verifyEmailSchema = z.object({
  params: z.object({
    token: z.string().min(1),
  }),
});
