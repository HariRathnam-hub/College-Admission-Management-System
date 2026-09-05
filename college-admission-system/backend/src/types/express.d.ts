import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /**
       * Populated by authMiddleware after verifying the access token.
       * Absent on public routes / before authMiddleware runs.
       */
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

export {};
