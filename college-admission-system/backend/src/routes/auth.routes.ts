import { Router } from "express";
import * as authController from "@/controllers/auth.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  signupSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/validators/auth.validators";
import {
  signupLimiter,
  loginLimiter,
  refreshLimiter,
  resendVerificationLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "@/middlewares/authRateLimit.middleware";

const router = Router();

// ---- Session lifecycle ----
router.post("/signup", signupLimiter, validate(signupSchema), authController.signup);
router.post("/login", loginLimiter, validate(loginSchema), authController.login);
router.post("/refresh", refreshLimiter, authController.refresh);
router.post("/logout", authMiddleware, authController.logout);
router.get("/me", authMiddleware, authController.me);

// ---- Email verification ----
router.get(
  "/verify-email/:token",
  validate(verifyEmailSchema),
  authController.verifyEmail
);
router.post(
  "/resend-verification",
  resendVerificationLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification
);

// ---- Password reset ----
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/reset-password/:token",
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

export default router;
