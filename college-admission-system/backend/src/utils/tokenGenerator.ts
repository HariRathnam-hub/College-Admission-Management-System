import crypto from "crypto";

/**
 * Generates a cryptographically secure random token (default 32 bytes /
 * 256 bits of entropy), hex-encoded. Used for email verification and
 * password reset links — NOT for JWTs, which are handled separately in
 * utils/jwt.ts.
 */
export function generateRawToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * One-way SHA-256 hash of a raw token. Only this hash is ever stored in the
 * database (EmailVerificationToken.tokenHash, PasswordResetToken.tokenHash,
 * RefreshToken.tokenHash) — the raw token itself exists only transiently
 * (in the email we send, or in the refresh-token cookie) and is never
 * persisted anywhere. Anyone with read access to the database therefore
 * cannot replay a valid token; they'd need the pre-image, which is
 * computationally infeasible to recover from a SHA-256 digest.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
