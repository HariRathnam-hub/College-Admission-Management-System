import { Router } from "express";
import { Role } from "@prisma/client";
import * as programController from "@/controllers/program.controller";
import { optionalAuthMiddleware, authMiddleware } from "@/middlewares/auth.middleware";
import { requireRole } from "@/middlewares/rbac.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  listProgramsSchema,
  getProgramSchema,
  createProgramSchema,
  updateProgramSchema,
  deleteProgramSchema,
} from "@/validators/program.validators";

const router = Router();

// ---- Public browsing ----
// optionalAuthMiddleware lets an authenticated ADMIN see inactive programs
// too (see program.service.listPrograms), without requiring anyone else to
// log in just to browse the catalog.
router.get("/", optionalAuthMiddleware, validate(listProgramsSchema), programController.listPrograms);
router.get("/:id", optionalAuthMiddleware, validate(getProgramSchema), programController.getProgram);

// ---- Admin-only management ----
router.post(
  "/",
  authMiddleware,
  requireRole(Role.ADMIN),
  validate(createProgramSchema),
  programController.createProgram
);
router.patch(
  "/:id",
  authMiddleware,
  requireRole(Role.ADMIN),
  validate(updateProgramSchema),
  programController.updateProgram
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(Role.ADMIN),
  validate(deleteProgramSchema),
  programController.deleteProgram
);

export default router;
