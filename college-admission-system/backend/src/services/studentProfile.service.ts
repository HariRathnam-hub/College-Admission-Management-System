import { Prisma } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { AppError } from "@/middlewares/error.middleware";
import { getPagination, buildMeta, PaginationQuery } from "@/utils/pagination";

const USER_SUMMARY_SELECT = {
  email: true,
  isEmailVerified: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function getMyProfile(userId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { user: { select: USER_SUMMARY_SELECT } },
  });

  if (!profile) {
    // Should be unreachable in practice — every STUDENT account gets a
    // profile row at signup (auth.service.registerStudent) — but guarded
    // defensively in case of manual DB edits or future account types.
    throw new AppError("Student profile not found", 404);
  }

  return profile;
}

export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  address?: string;
}

export async function updateMyProfile(userId: string, input: UpdateMyProfileInput) {
  await getMyProfile(userId); // throws 404 if somehow missing

  return prisma.studentProfile.update({
    where: { userId },
    data: input,
  });
}

interface ListStudentsQuery extends PaginationQuery {
  search?: string;
}

export async function listStudents(query: ListStudentsQuery) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.StudentProfileWhereInput = query.search
    ? {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { user: { email: { contains: query.search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [students, total] = await prisma.$transaction([
    prisma.studentProfile.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: USER_SUMMARY_SELECT } },
    }),
    prisma.studentProfile.count({ where }),
  ]);

  return { students, meta: buildMeta(total, page, limit) };
}

export async function getStudentById(id: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: {
      user: { select: USER_SUMMARY_SELECT },
      applications: { include: { program: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!profile) {
    throw new AppError("Student not found", 404);
  }

  return profile;
}
