import { z } from "zod";
import { paginationQueryShape, idParamSchema } from "@/validators/common.validators";

export const listNotificationsSchema = z.object({
  query: z.object({
    ...paginationQueryShape,
    unreadOnly: z.enum(["true", "false"]).optional(),
  }),
});

export const markNotificationReadSchema = idParamSchema;
