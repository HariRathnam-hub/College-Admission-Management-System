import { z } from "zod";
import { paginationQueryShape, idParamSchema } from "@/validators/common.validators";

export const updateMyProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      phone: z.string().trim().min(7, "Enter a valid phone number").max(20).optional(),
      dateOfBirth: z.coerce.date().optional(),
      address: z.string().trim().min(1).max(500).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const listStudentsSchema = z.object({
  query: z.object({
    ...paginationQueryShape,
    search: z.string().trim().min(1).max(100).optional(),
  }),
});

// Admin lookup by StudentProfile.id (distinct from User.id).
export const getStudentByIdSchema = idParamSchema;
