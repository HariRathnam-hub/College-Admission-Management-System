import { Request, Response } from "express";
import { ApplicationStatus } from "@prisma/client";
import * as applicationReviewService from "@/services/applicationReview.service";

export async function listApplications(req: Request, res: Response): Promise<void> {
  const { applications, meta } = await applicationReviewService.listApplications(
    req.query as {
      page?: number;
      limit?: number;
      status?: ApplicationStatus;
      programId?: string;
      search?: string;
      sortBy?: "createdAt" | "submittedAt" | "decisionAt";
      sortOrder?: "asc" | "desc";
    }
  );
  res.status(200).json({ success: true, data: { applications }, meta });
}

export async function getApplicationDetail(req: Request, res: Response): Promise<void> {
  const application = await applicationReviewService.getApplicationDetail(req.params.id);
  res.status(200).json({ success: true, data: { application } });
}

export async function updateApplicationStatus(req: Request, res: Response): Promise<void> {
  const { status, note } = req.body;
  const application = await applicationReviewService.updateApplicationStatus(
    req.params.id,
    req.user!.id,
    status,
    note
  );
  res.status(200).json({ success: true, message: "Application status updated", data: { application } });
}
