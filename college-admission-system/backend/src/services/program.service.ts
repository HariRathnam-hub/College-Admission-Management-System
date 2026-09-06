import { Prisma } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { AppError } from "@/middlewares/error.middleware";
import { getPagination, buildMeta, PaginationQuery } from "@/utils/pagination";

interface ListProgramsQuery extends PaginationQuery {
  department?: string;
  isActive?: string;
  search?: string;
  sortBy?: "createdAt" | "applicationDeadline" | "name" | "seatsAvailable";
  sortOrder?: "asc" | "desc";
}

export async function listPrograms(query: ListProgramsQuery, isAdmin: boolean) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.ProgramWhereInput = {};

  // Non-admin callers (anonymous browsers and students alike) only ever see
  // active programs, regardless of what they pass for `isActive` — this is
  // enforced here, not just hidden in the frontend.
  if (!isAdmin) {
    where.isActive = true;
  } else if (query.isActive !== undefined) {
    where.isActive = query.isActive === "true";
  }

  if (query.department) {
    where.department = { equals: query.department, mode: "insensitive" };
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { department: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [programs, total] = await prisma.$transaction([
    prisma.program.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy ?? "createdAt"]: query.sortOrder ?? "desc" },
    }),
    prisma.program.count({ where }),
  ]);

  return { programs, meta: buildMeta(total, page, limit) };
}

export async function getProgramById(id: string) {
  const program = await prisma.program.findUnique({ where: { id } });

  if (!program) {
    throw new AppError("Program not found", 404);
  }

  return program;
}

/**
 * Callers should not surface an inactive/past-deadline program to students
 * as applicable — that check lives in application.service.createApplication,
 * not here, since fetching a program by id is also used for admin editing of
 * inactive programs.
 */
export async function getActiveApplicableProgramById(id: string) {
  const program = await getProgramById(id);

  if (!program.isActive) {
    throw new AppError("This program is not currently accepting applications", 409);
  }

  if (program.applicationDeadline && program.applicationDeadline < new Date()) {
    throw new AppError("The application deadline for this program has passed", 409);
  }

  return program;
}

export interface CreateProgramInput {
  name: string;
  department: string;
  description?: string;
  duration?: string;
  fees?: number;
  applicationDeadline?: Date;
  seatsAvailable?: number;
  isActive?: boolean;
}

export async function createProgram(input: CreateProgramInput) {
  return prisma.program.create({
    data: {
      name: input.name,
      department: input.department,
      description: input.description,
      duration: input.duration,
      fees: input.fees,
      applicationDeadline: input.applicationDeadline,
      seatsAvailable: input.seatsAvailable ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateProgram(id: string, input: Partial<CreateProgramInput>) {
  await getProgramById(id); // throws 404 if missing

  return prisma.program.update({
    where: { id },
    data: input,
  });
}

export async function deleteProgram(id: string): Promise<void> {
  const program = await getProgramById(id);

  const applicationCount = await prisma.application.count({ where: { programId: id } });

  if (applicationCount > 0) {
    // Application.programId is onDelete: Restrict, so the DB would reject
    // this anyway — checking first lets us return a clear 409 with
    // guidance instead of a raw foreign-key-violation error.
    throw new AppError(
      "This program has existing applications and cannot be deleted. Set isActive to false to close it to new applications instead.",
      409
    );
  }

  await prisma.program.delete({ where: { id: program.id } });
}
