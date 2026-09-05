import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * A precomputed, valid bcrypt hash of an arbitrary fixed string. Used only
 * to normalize response timing (see compareAgainstDummyHash below) — it is
 * NOT a real user's password hash and matches no account.
 */
const DUMMY_HASH = "$2a$12$Gv/5euYWmZO0hyU9dBoT4eVOxWNcT2LuopHA4Tc.u5pa1rKo6CffW";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Account-enumeration protection: when login is called with an email that
 * doesn't exist, we still want to perform a bcrypt comparison (an
 * intentionally slow operation) before responding, so that the "no such
 * user" code path takes roughly as long as the "user exists, wrong
 * password" path. Skipping bcrypt entirely for non-existent users would
 * make that branch return much faster, letting an attacker distinguish
 * valid registered emails from invalid ones purely by response time.
 */
export async function compareAgainstDummyHash(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}
