import { Router } from "express";
import { Role } from "@prisma/client";
import * as applicationReviewController from "@/controllers/applicationReview.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { requireRole } from "@/middlewares/rbac.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  listApplicationsSchema,
  getApplicationDetailSchema,
  updateApplicationStatusSchema,
} from "@/validators/applicationReview.validators";

const router = Router();

// Every route here is ADMIN-only — this is the review workflow, distinct
// from /applications (student-facing self-service) even though both
// operate on the same Application rows.
router.use(authMiddleware, requireRole(Role.ADMIN));

router.get("/", validate(listApplicationsSchema), applicationReviewController.listApplications);
router.get("/:id", validate(getApplicationDetailSchema), applicationReviewController.getApplicationDetail);
router.patch(
  "/:id/status",
  validate(updateApplicationStatusSchema),
  applicationReviewController.updateApplicationStatus
);

export default router;
