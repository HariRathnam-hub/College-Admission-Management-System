import { env } from "@/config/env";
import app from "@/app";
import { connectDatabase, disconnectDatabase } from "@/config/prisma";

async function bootstrap() {
  // Fail fast if Neon is unreachable / DATABASE_URL is wrong, rather than
  // starting an API that will 500 on its first DB query.
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  async function shutdown(signal: string) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      console.log("✅ Server closed, DB connections released.");
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

bootstrap().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
