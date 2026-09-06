import { ApplicationStatus, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { AppError } from "@/middlewares/error.middleware";
import { getPagination, buildMeta, PaginationQuery } from "@/utils/pagination";
import { assertValidTransition, TERMINAL_DECISION_STATUSES } from "@/utils/applicationStatus";
import * as notificationService from "@/services/notification.service";
import * as emailService from "@/services/email.service";

interface ListApplicationsQuery extends PaginationQuery {
  status?: ApplicationStatus;
  programId?: string;
  search?: string;
  sortBy?: "createdAt" | "submittedAt" | "decisionAt";
  sortOrder?: "asc" | "desc";
}

export async function listApplications(query: ListApplicationsQuery) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.ApplicationWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.programId ? { programId: query.programId } : {}),
    ...(query.search
      ? {
          student: {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
            ],
          },
        }
      : {}),
  };

  const [applications, total] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy ?? "createdAt"]: query.sortOrder ?? "desc" },
      include: {
        program: { select: { id: true, name: true, department: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    prisma.application.count({ where }),
  ]);

  return { applications, meta: buildMeta(total, page, limit) };
}

export async function getApplicationDetail(id: string) {
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      program: true,
      student: { include: { user: { select: { email: true, isEmailVerified: true } } } },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { email: true, role: true } } },
      },
      documents: true,
    },
  });

  if (!application) {
    throw new AppError("Application not found", 404);
  }

  return application;
}

export async function updateApplicationStatus(
  applicationId: string,
  adminUserId: string,
  newStatus: ApplicationStatus,
  note?: string
) {
  const { updated, studentEmail, programName } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      include: { student: { include: { user: true } }, program: true },
    });

    if (!application) {
      throw new AppError("Application not found", 404);
    }

    if (application.status === ApplicationStatus.DRAFT) {
      throw new AppError("Cannot review an application that hasn't been submitted yet", 409);
    }

    assertValidTransition(application.status, newStatus);

    if (newStatus === ApplicationStatus.APPROVED) {
      if (application.program.seatsAvailable <= 0) {
        throw new AppError("No seats available for this program", 409);
      }

      // Decrementing here (inside the same transaction, guarded by the
      // seatsAvailable > 0 check above) is safe from a race between two
      // concurrent approvals for the last seat — Prisma/Postgres will
      // serialize the two transactions and the second one re-reads
      // seatsAvailable as 0.
      await tx.program.update({
        where: { id: application.programId },
        data: { seatsAvailable: { decrement: 1 } },
      });
    }

    const isTerminalDecision = TERMINAL_DECISION_STATUSES.includes(newStatus);

    const updatedApplication = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        decisionAt: isTerminalDecision ? new Date() : application.decisionAt,
        decisionNote: note ?? application.decisionNote,
      },
    });

    await tx.applicationStatusHistory.create({
      data: {
        applicationId,
        fromStatus: application.status,
        toStatus: newStatus,
        changedByUserId: adminUserId,
        note,
      },
    });

    await notificationService.createNotification(
      {
        userId: application.student.userId,
        type: NotificationType.APPLICATION_STATUS_CHANGE,
        title: "Application status updated",
        message: `Your application for ${application.program.name} is now ${newStatus
          .replace(/_/g, " ")
          .toLowerCase()}.`,
        relatedApplicationId: applicationId,
      },
      tx
    );

    return {
      updated: updatedApplication,
      studentEmail: application.student.user.email,
      programName: application.program.name,
    };
  });

  // Sent outside the transaction, best-effort: the decision is already
  // durably recorded, so a transient email-provider failure here must not
  // roll it back or fail the request.
  try {
    await emailService.sendApplicationStatusUpdateEmail(studentEmail, programName, newStatus, note);
  } catch (error) {
    console.error("Failed to send application status update email:", error);
  }

  return updated;
}
