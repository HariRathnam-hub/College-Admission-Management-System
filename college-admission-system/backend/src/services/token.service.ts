import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/config/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "@/utils/jwt";
import { generateRawToken, hashToken } from "@/utils/tokenGenerator";
import { AppError } from "@/middlewares/error.middleware";
import { env } from "@/config/env";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Mints a new access+refresh pair and persists the refresh token's
 * identity. `jti` is generated here (not in jwt.ts) because the exact same
 * value must be embedded in the signed JWT AND written to
 * RefreshToken.jti in the same operation — this is the field the refresh
 * flow will look the row up by.
 */
export async function issueTokenPair(userId: string, role: Role): Promise<TokenPair> {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, jti });

  await prisma.refreshToken.create({
    data: {
      jti,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Verifies + rotates a presented refresh token, returning a brand-new pair.
 *
 * Lookup order (per requirement — do NOT search by tokenHash directly):
 *   1. Verify the JWT signature/expiry.
 *   2. Extract `jti` from the verified payload.
 *   3. Look the RefreshToken row up BY jti (unique-indexed, O(1) lookup by
 *      an explicit identifier — not a scan/lookup keyed on the hash).
 *   4. Only then compute sha256(rawToken) and compare it against that row's
 *      tokenHash, as a second confirmation that this exact token belongs to
 *      the row found in step 3.
 *
 * REUSE DETECTION: if the row found by jti is already revoked, this exact
 * refresh token was already used once before to obtain a new pair. A
 * legitimate client would be presenting the newer token by now — so this
 * token reappearing means it was copied (stolen from a compromised device,
 * intercepted, etc.). We can't tell which caller (original vs. attacker) is
 * legitimate, so the only safe response is to revoke every refresh token
 * belonging to that user, forcing a full re-login everywhere.
 */
export async function rotateRefreshToken(rawRefreshToken: string): Promise<TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // Step 1: lookup by jti — NOT by tokenHash.
  const existing = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });

  if (!existing) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // Step 2: verify the presented token's hash matches this row's hash.
  // A mismatch here (valid jti, valid JWT signature, but wrong hash) would
  // mean the row was somehow re-used for a different token value than the
  // one it was issued for — not reachable through normal flows, but treated
  // as tampering rather than silently accepted.
  const presentedHash = hashToken(rawRefreshToken);
  if (presentedHash !== existing.tokenHash) {
    await revokeAllUserRefreshTokens(existing.userId);
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (existing.revokedAt) {
    // Reuse of an already-rotated token — treat as a compromise signal.
    await revokeAllUserRefreshTokens(existing.userId);
    throw new AppError("Session expired, please log in again", 401);
  }

  if (existing.expiresAt < new Date()) {
    throw new AppError("Session expired, please log in again", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user) {
    throw new AppError("Session expired, please log in again", 401);
  }

  // Rotate: revoke the presented token's row, then issue a fresh pair with
  // a brand-new jti. Re-reading the user's role from the DB (rather than
  // trusting a claim in the old refresh token) means a role change takes
  // effect on the very next refresh, not after the old token's full 7-day
  // lifetime.
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  return issueTokenPair(user.id, user.role);
}

/**
 * Used at logout. Verifies the token to extract its jti, then revokes by
 * jti (never by tokenHash) — consistent with the lookup order used for
 * rotation. If the token is already invalid/expired, there's nothing valid
 * to revoke, so this silently no-ops (the cookie gets cleared by the
 * controller regardless).
 */
export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: { jti: payload.jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---- Email verification tokens ----
// (unchanged by this update — no jti concept here, these are single-use
// opaque tokens, not JWTs, so there's no token ID to extract.)

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const rawToken = generateRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MIN * 60_000),
    },
  });
  return rawToken;
}

export async function consumeEmailVerificationToken(rawToken: string): Promise<string> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired verification link", 400);
  }

  const [, user] = await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { isEmailVerified: true },
    }),
  ]);

  return user.id;
}

// ---- Password reset tokens ----

export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MIN * 60_000),
    },
  });
  return rawToken;
}

export async function consumePasswordResetToken(rawToken: string): Promise<string> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired reset link", 400);
  }

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.userId;
}
