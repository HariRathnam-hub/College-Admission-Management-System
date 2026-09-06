import { Request, Response } from "express";
import { Role } from "@prisma/client";
import * as programService from "@/services/program.service";

export async function listPrograms(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user?.role === Role.ADMIN;
  const { programs, meta } = await programService.listPrograms(
    req.query as {
      page?: number;
      limit?: number;
      department?: string;
      isActive?: string;
      search?: string;
      sortBy?: "createdAt" | "applicationDeadline" | "name" | "seatsAvailable";
      sortOrder?: "asc" | "desc";
    },
    isAdmin
  );

  res.status(200).json({ success: true, data: { programs }, meta });
}

export async function getProgram(req: Request, res: Response): Promise<void> {
  const program = await programService.getProgramById(req.params.id);
  res.status(200).json({ success: true, data: { program } });
}

export async function createProgram(req: Request, res: Response): Promise<void> {
  const program = await programService.createProgram(req.body);
  res.status(201).json({ success: true, message: "Program created", data: { program } });
}

export async function updateProgram(req: Request, res: Response): Promise<void> {
  const program = await programService.updateProgram(req.params.id, req.body);
  res.status(200).json({ success: true, message: "Program updated", data: { program } });
}

export async function deleteProgram(req: Request, res: Response): Promise<void> {
  await programService.deleteProgram(req.params.id);
  res.status(200).json({ success: true, message: "Program deleted" });
}
