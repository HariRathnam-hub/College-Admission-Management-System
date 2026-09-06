import { Request, Response } from "express";
import * as studentProfileService from "@/services/studentProfile.service";

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  const profile = await studentProfileService.getMyProfile(req.user!.id);
  res.status(200).json({ success: true, data: { profile } });
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const profile = await studentProfileService.updateMyProfile(req.user!.id, req.body);
  res.status(200).json({ success: true, message: "Profile updated", data: { profile } });
}

export async function listStudents(req: Request, res: Response): Promise<void> {
  const { students, meta } = await studentProfileService.listStudents(
    req.query as { page?: number; limit?: number; search?: string }
  );
  res.status(200).json({ success: true, data: { students }, meta });
}

export async function getStudentById(req: Request, res: Response): Promise<void> {
  const student = await studentProfileService.getStudentById(req.params.id);
  res.status(200).json({ success: true, data: { student } });
}
