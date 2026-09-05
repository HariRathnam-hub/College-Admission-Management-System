import { Role } from "@prisma/client";

/** Payload encoded into the short-lived (15m) access token. */
export interface AccessTokenPayload {
  sub: string; // User.id
  role: Role;
}

/**
 * Payload encoded into the long-lived (7d) refresh token.
 *
 * `jti` (JWT ID) is a unique identifier minted at issuance time and stored
 * verbatim as RefreshToken.jti in the database. The refresh flow looks the
 * DB row up BY jti first (a direct, indexed primary lookup), then verifies
 * the presented token's hash against that row's tokenHash as a second,
 * independent check — rather than searching the table by tokenHash alone.
 * This means a row is located deterministically by an explicit identifier
 * embedded in the token, and the hash comparison is purely a verification
 * step against the row jti already found, not the lookup mechanism itself.
 *
 * No role claim here — role is re-read from the DB on every refresh (see
 * token.service.ts), so a role change takes effect immediately rather than
 * waiting out the old refresh token's lifetime.
 */
export interface RefreshTokenPayload {
  sub: string; // User.id
  jti: string; // RefreshToken.jti
}
