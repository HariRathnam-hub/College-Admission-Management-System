import { Router } from "express";
import { Role } from "@prisma/client";
import * as applicationController from "@/controllers/application.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { requireRole } from "@/middlewares/rbac.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  createApplicationSchema,
  listMyApplicationsSchema,
  getApplicationSchema,
  submitApplicationSchema,
  withdrawApplicationSchema,
} from "@/validators/application.validators";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requireRole(Role.STUDENT),
  validate(createApplicationSchema),
  applicationController.createApplication
);

router.get(
  "/",
  authMiddleware,
  requireRole(Role.STUDENT),
  validate(listMyApplicationsSchema),
  applicationController.listMyApplications
);

// No requireRole() here on purpose: applicationService.getMyApplicationById
// calls assertOwnership(req.user, ...), which lets ADMIN read any
// application by id while a STUDENT can only read their own (404 otherwise).
router.get(
  "/:id",
  authMiddleware,
  validate(getApplicationSchema),
  applicationController.getApplicationById
);

router.post(
  "/:id/submit",
  authMiddleware,
  requireRole(Role.STUDENT),
  validate(submitApplicationSchema),
  applicationController.submitApplication
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole(Role.STUDENT),
  validate(withdrawApplicationSchema),
  applicationController.withdrawApplication
);

export default router;
