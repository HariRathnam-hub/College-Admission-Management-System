import { Router } from "express";
import healthRoutes from "@/routes/health.routes";
import authRoutes from "@/routes/auth.routes";
import programRoutes from "@/routes/program.routes";
import studentRoutes from "@/routes/student.routes";
import applicationRoutes from "@/routes/application.routes";
import adminApplicationRoutes from "@/routes/adminApplication.routes";
import notificationRoutes from "@/routes/notification.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);

// Phase 4
router.use("/programs", programRoutes);
router.use("/students", studentRoutes);
router.use("/applications", applicationRoutes);
router.use("/admin/applications", adminApplicationRoutes);
router.use("/notifications", notificationRoutes);

// Future phases will mount:
// router.use("/analytics", analyticsRoutes);

export default router;
