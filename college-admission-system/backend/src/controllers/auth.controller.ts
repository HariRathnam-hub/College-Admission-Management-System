import { Request, Response } from "express";
import { env } from "@/config/env";
import { AppError } from "@/middlewares/error.middleware";
import { setRefreshTokenCookie, clearRefreshTokenCookie } from "@/utils/cookies";
import * as authService from "@/services/auth.service";
import * as tokenService from "@/services/token.service";

export async function signup(req: Request, res: Response): Promise<void> {
  const user = await authService.registerStudent(req.body);
  res.status(201).json({
    success: true,
    message: "Account created. Please check your email to verify your address.",
    data: { user },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const { tokens, user } = await authService.login(email, password);

  setRefreshTokenCookie(res, tokens.refreshToken);

  res.status(200).json({
    success: true,
    data: { accessToken: tokens.accessToken, user },
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];
  if (!rawRefreshToken) {
    throw new AppError("No refresh token provided", 401);
  }

  const tokens = await tokenService.rotateRefreshToken(rawRefreshToken);
  setRefreshTokenCookie(res, tokens.refreshToken);

  res.status(200).json({
    success: true,
    data: { accessToken: tokens.accessToken },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];
  await authService.logout(rawRefreshToken);
  clearRefreshTokenCookie(res);
  res.status(200).json({ success: true, message: "Logged out" });
}

export async function me(req: Request, res: Response): Promise<void> {
  // req.user is guaranteed by authMiddleware running before this handler.
  const user = await authService.getCurrentUser(req.user!.id);
  res.status(200).json({ success: true, data: { user } });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  await authService.verifyEmail(req.params.token);
  res.status(200).json({ success: true, message: "Email verified successfully" });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  await authService.resendVerification(req.body.email);
  res.status(200).json({
    success: true,
    message:
      "If an account with that email exists and isn't yet verified, a verification link has been sent.",
  });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body.email);
  res.status(200).json({
    success: true,
    message: "If an account with that email exists, a password reset link has been sent.",
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.params.token, req.body.newPassword);
  res.status(200).json({ success: true, message: "Password updated. Please log in again." });
}
