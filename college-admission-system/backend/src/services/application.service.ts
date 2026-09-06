import { ApplicationStatus, NotificationType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { AppError } from "@/middlewares/error.middleware";
import { assertOwnership } from "@/utils/ownership";
import { getPagination, buildMeta, PaginationQuery } from "@/utils/pagination";
import { getActiveApplicableProgramById } from "@/services/program.service";
import * as notificationService from "@/services/notification.service";

type RequestUser = { id: string; role: Role };

async function getOwnStudentProfile(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });

  if (!profile) {
    // Should be unreachable — every STUDENT user gets a profile row at
    // signup — but guarded defensively.
    throw new AppError("Student profile not found", 404);
  }

  return profile;
}

export async function createApplication(userId: string, programId: string) {
  const profile = await getOwnStudentProfile(userId);

  // Throws 404/409 if the program doesn't exist, is inactive, or its
  // deadline has passed.
  await getActiveApplicableProgramById(programId);

  try {
    return await prisma.application.create({
      data: {
        studentId: profile.id,
        programId,
        status: ApplicationStatus.DRAFT,
      },
      include: { program: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Unique([studentId, programId]) constraint — the pre-check above
      // doesn't cover a concurrent duplicate request, so this is the real
      // guarantee, not just a nicety.
      throw new AppError("You already have an application on file for this program", 409);
    }
    throw error;
  }
}

interface ListMyApplicationsQuery extends PaginationQuery {
  status?: ApplicationStatus;
}

export async function listMyApplications(userId: string, query: ListMyApplicationsQuery) {
  const profile = await getOwnStudentProfile(userId);
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.ApplicationWhereInput = {
    studentId: profile.id,
    ...(query.status ? { status: query.status } : {}),
  };

  const [applications, total] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { program: true },
    }),
    prisma.application.count({ where }),
  ]);

  return { applications, meta: buildMeta(total, page, limit) };
}

export async function getMyApplicationById(user: RequestUser, id: string) {
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      program: true,
      student: true,
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { email: true, role: true } } },
      },
    },
  });

  if (!application) {
    throw new AppError("Application not found", 404);
  }

  // ADMIN always passes; STUDENT must own it — see utils/ownership.ts.
  assertOwnership(user, application.student.userId);

  return application;
}

export async function submitApplication(user: RequestUser, id: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const application = await tx.application.findUnique({
      where: { id },
      include: { student: true, program: true },
    });

    if (!application) {
      throw new AppError("Application not found", 404);
    }

    assertOwnership(user, application.student.userId);

    if (application.status !== ApplicationStatus.DRAFT) {
      throw new AppError("Only draft applications can be submitted", 409);
    }

    if (!application.program.isActive) {
      throw new AppError("This program is no longer accepting applications", 409);
    }

    if (application.program.applicationDeadline && application.program.applicationDeadline < new Date()) {
      throw new AppError("The application deadline for this program has passed", 409);
    }

    const { phone, dateOfBirth, address } = application.student;
    if (!phone || !dateOfBirth || !address) {
      throw new AppError(
        "Please complete your student profile (phone, date of birth, and address) before submitting an application",
        422
      );
    }

    const updated = await tx.application.update({
      where: { id },
      data: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
    });

    await tx.applicationStatusHistory.create({
      data: {
        applicationId: id,
        fromStatus: ApplicationStatus.DRAFT,
        toStatus: ApplicationStatus.SUBMITTED,
        changedByUserId: user.id,
      },
    });

    await notificationService.createNotification(
      {
        userId: user.id,
        type: NotificationType.APPLICATION_STATUS_CHANGE,
        title: "Application submitted",
        message: `Your application to ${application.program.name} has been submitted and is awaiting review.`,
        relatedApplicationId: id,
      },
      tx
    );

    return updated;
  });
}

export async function withdrawApplication(user: RequestUser, id: string): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id },
    include: { student: true },
  });

  if (!application) {
    throw new AppError("Application not found", 404);
  }

  assertOwnership(user, application.student.userId);

  if (application.status !== ApplicationStatus.DRAFT) {
    throw new AppError(
      "Only draft applications can be withdrawn. A submitted application cannot be deleted — contact admissions if you need to change it.",
      409
    );
  }

  await prisma.application.delete({ where: { id } });
}
