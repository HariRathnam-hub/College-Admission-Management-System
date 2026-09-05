import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

/**
 * Validates { body, params, query } against the given Zod schema. Throws
 * ZodError on failure, which express-async-errors forwards to the
 * centralized errorHandler (middlewares/error.middleware.ts) — that handler
 * already maps ZodError to a 422 response with field-level messages, so
 * this middleware doesn't need its own try/catch.
 */
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    next();
  };
}
