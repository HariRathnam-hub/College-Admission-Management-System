import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { AppError } from "@/middlewares/error.middleware";

/**
 * Role guard. Must run AFTER authMiddleware on any route that uses it —
 * it only checks the role already attached to req.user, it does not verify
 * tokens itself.
 *
 * Usage: router.get("/admin/x", authMiddleware, requireRole("ADMIN"), handler)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Defensive guard against a route-wiring mistake (requireRole used
      // without authMiddleware in front of it) — should never trigger in
      // correctly wired routes.
      throw new AppError("Authentication required", 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError("You do not have permission to perform this action", 403);
    }

    next();
  };
}
