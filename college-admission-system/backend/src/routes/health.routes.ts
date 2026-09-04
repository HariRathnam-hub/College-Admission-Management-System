import { Router } from "express";
import { prisma } from "@/config/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  let databaseStatus: "up" | "down" = "up";

  try {
    // Cheapest possible round-trip to Neon to confirm the pool is alive.
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    databaseStatus = "down";
    console.error("Health check DB ping failed:", error);
  }

  const overallOk = databaseStatus === "up";

  res.status(overallOk ? 200 : 503).json({
    success: overallOk,
    message: overallOk ? "OK" : "Database unreachable",
    database: databaseStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;
