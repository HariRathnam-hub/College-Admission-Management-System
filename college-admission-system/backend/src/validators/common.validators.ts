import { z } from "zod";

/**
 * Spread into any `query` object schema that supports pagination, e.g.:
 *   z.object({ query: z.object({ ...paginationQueryShape, status: z.string().optional() }) })
 *
 * Left as an object *shape* (not a built schema) so callers can extend it
 * with their own filters in a single z.object() call.
 */
export const paginationQueryShape = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

/**
 * Reused by every route of the form `/:id` where `id` is a Prisma `uuid()`
 * primary key (programs, applications, notifications, student profiles).
 */
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid id format"),
  }),
});
