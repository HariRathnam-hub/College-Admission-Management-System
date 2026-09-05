import { Role } from "@prisma/client";
import { AppError } from "@/middlewares/error.middleware";

/**
 * Resource-level ownership check — deliberately separate from RBAC.
 * RBAC (requireRole) answers "is this role allowed to hit this route at
 * all?"; ownership answers "does this specific resource belong to this
 * specific caller?" — a question only the service layer can answer, since
 * it requires loading the resource first.
 *
 * ADMIN always passes (admins can access any student's resources by
 * design — that's the point of the admin review workflow). For STUDENT,
 * the resource's owning userId must exactly match the caller's id.
 *
 * Returns 404 rather than 403 for a non-owning STUDENT: this avoids
 * confirming to an unauthorized caller that a resource with that ID even
 * exists, which is a stronger property than a plain 403 would give.
 *
 * Usage (from Phase 5 onward, once Application/Document routes exist):
 *   const application = await prisma.application.findUnique({
 *     where: { id },
 *     include: { student: true },
 *   });
 *   if (!application) throw new AppError("Not found", 404);
 *   assertOwnership(req.user, application.student.userId);
 */
export function assertOwnership(
  requester: { id: string; role: Role },
  resourceOwnerUserId: string
): void {
  if (requester.role === Role.ADMIN) {
    return;
  }

  if (requester.id !== resourceOwnerUserId) {
    throw new AppError("Resource not found", 404);
  }
}
