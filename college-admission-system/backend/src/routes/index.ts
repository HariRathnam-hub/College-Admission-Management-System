import { Router } from "express";
import healthRoutes from "@/routes/health.routes";

const router = Router();

router.use("/health", healthRoutes);

// Future phases will mount:
// router.use("/auth", authRoutes);
// router.use("/students", studentRoutes);
// router.use("/applications", applicationRoutes);
// router.use("/admin", adminRoutes);
// router.use("/analytics", analyticsRoutes);

export default router;
