import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { paginationQueryShape, idParamSchema } from "@/validators/common.validators";

export const createApplicationSchema = z.object({
  body: z.object({
    programId: z.string().uuid("Invalid program id"),
  }),
});

export const listMyApplicationsSchema = z.object({
  query: z.object({
    ...paginationQueryShape,
    status: z.nativeEnum(ApplicationStatus).optional(),
  }),
});

export const getApplicationSchema = idParamSchema;
export const submitApplicationSchema = idParamSchema;
export const withdrawApplicationSchema = idParamSchema;
