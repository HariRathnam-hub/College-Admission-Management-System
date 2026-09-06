import { Router } from "express";
import { Role } from "@prisma/client";
import * as studentProfileController from "@/controllers/studentProfile.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { requireRole } from "@/middlewares/rbac.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  updateMyProfileSchema,
  listStudentsSchema,
  getStudentByIdSchema,
} from "@/validators/studentProfile.validators";

const router = Router();

// ---- Self-service (STUDENT only) ----
// Routed before "/:id" would otherwise be needed — "/me" is a fixed
// segment, not a param, so there's no path-collision risk either way, but
// keeping it first documents the intent.
router.get("/me", authMiddleware, requireRole(Role.STUDENT), studentProfileController.getMyProfile);
router.patch(
  "/me",
  authMiddleware,
  requireRole(Role.STUDENT),
  validate(updateMyProfileSchema),
  studentProfileController.updateMyProfile
);

// ---- Admin read access ----
router.get(
  "/",
  authMiddleware,
  requireRole(Role.ADMIN),
  validate(listStudentsSchema),
  studentProfileController.listStudents
);
router.get(
  "/:id",
  authMiddleware,
  requireRole(Role.ADMIN),
  validate(getStudentByIdSchema),
  studentProfileController.getStudentById
);

export default router;
