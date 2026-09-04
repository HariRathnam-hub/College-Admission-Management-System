import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma Client.
 *
 * In development, `tsx watch` re-executes this module on every file change.
 * Without caching the instance on `global`, each reload would open a new
 * connection pool against Neon and eventually exhaust it. Reusing the
 * cached client on `global.__prisma` avoids that.
 */
export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

/**
 * Explicitly opens the connection pool and verifies connectivity.
 * Called once at server boot so a bad DATABASE_URL / unreachable Neon
 * endpoint fails fast with a clear log line, instead of surfacing as a
 * cryptic error on the first incoming request.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("✅ Database connected (Neon PostgreSQL)");
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
    throw error;
  }
}

/**
 * Called during graceful shutdown (SIGINT/SIGTERM) so in-flight queries
 * are allowed to finish and the pool is released cleanly.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
