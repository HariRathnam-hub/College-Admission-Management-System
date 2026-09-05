import { Router } from "express";
import healthRoutes from "@/routes/health.routes";
import authRoutes from "@/routes/auth.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);

// Future phases will mount:
// router.use("/students", studentRoutes);
// router.use("/programs", programRoutes);
// router.use("/applications", applicationRoutes);
// router.use("/admin", adminRoutes);
// router.use("/analytics", analyticsRoutes);

export default router;
