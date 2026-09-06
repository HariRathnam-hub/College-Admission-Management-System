import { Request, Response } from "express";
import { ApplicationStatus } from "@prisma/client";
import * as applicationService from "@/services/application.service";

export async function createApplication(req: Request, res: Response): Promise<void> {
  const application = await applicationService.createApplication(req.user!.id, req.body.programId);
  res.status(201).json({
    success: true,
    message: "Application created as a draft. Submit it once you're ready.",
    data: { application },
  });
}

export async function listMyApplications(req: Request, res: Response): Promise<void> {
  const { applications, meta } = await applicationService.listMyApplications(
    req.user!.id,
    req.query as { page?: number; limit?: number; status?: ApplicationStatus }
  );
  res.status(200).json({ success: true, data: { applications }, meta });
}

export async function getApplicationById(req: Request, res: Response): Promise<void> {
  const application = await applicationService.getMyApplicationById(req.user!, req.params.id);
  res.status(200).json({ success: true, data: { application } });
}

export async function submitApplication(req: Request, res: Response): Promise<void> {
  const application = await applicationService.submitApplication(req.user!, req.params.id);
  res.status(200).json({ success: true, message: "Application submitted", data: { application } });
}

export async function withdrawApplication(req: Request, res: Response): Promise<void> {
  await applicationService.withdrawApplication(req.user!, req.params.id);
  res.status(200).json({ success: true, message: "Application withdrawn" });
}
