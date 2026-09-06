import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { paginationQueryShape, idParamSchema } from "@/validators/common.validators";

export const listApplicationsSchema = z.object({
  query: z.object({
    ...paginationQueryShape,
    status: z.nativeEnum(ApplicationStatus).optional(),
    programId: z.string().uuid().optional(),
    // Matches against the applicant's first/last name or email.
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z.enum(["createdAt", "submittedAt", "decisionAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getApplicationDetailSchema = idParamSchema;

export const updateApplicationStatusSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid id format") }),
  body: z.object({
    status: z.nativeEnum(ApplicationStatus, {
      errorMap: () => ({ message: "status must be one of the valid ApplicationStatus values" }),
    }),
    note: z.string().trim().max(2000).optional(),
  }),
});
