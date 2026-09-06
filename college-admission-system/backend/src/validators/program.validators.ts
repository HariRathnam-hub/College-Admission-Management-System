import { z } from "zod";
import { paginationQueryShape, idParamSchema } from "@/validators/common.validators";

export const listProgramsSchema = z.object({
  query: z.object({
    ...paginationQueryShape,
    department: z.string().trim().min(1).max(150).optional(),
    // Query params always arrive as strings — coerced to a real boolean in
    // program.service.ts. Only meaningful for ADMIN callers; non-admin
    // callers always see isActive=true regardless (enforced server-side).
    isActive: z.enum(["true", "false"]).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z.enum(["createdAt", "applicationDeadline", "name", "seatsAvailable"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getProgramSchema = idParamSchema;

const programBodyShape = {
  name: z.string().trim().min(1, "Name is required").max(200),
  department: z.string().trim().min(1, "Department is required").max(150),
  description: z.string().trim().max(5000).optional(),
  duration: z.string().trim().max(50).optional(),
  fees: z.coerce.number().nonnegative("Fees cannot be negative").optional(),
  applicationDeadline: z.coerce.date().optional(),
  seatsAvailable: z.coerce.number().int().min(0, "Seats cannot be negative").optional(),
  isActive: z.boolean().optional(),
};

export const createProgramSchema = z.object({
  body: z.object(programBodyShape),
});

export const updateProgramSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid id format") }),
  body: z
    .object(programBodyShape)
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const deleteProgramSchema = idParamSchema;
