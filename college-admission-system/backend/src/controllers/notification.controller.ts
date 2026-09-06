import { Request, Response } from "express";
import * as notificationService from "@/services/notification.service";

export async function listMyNotifications(req: Request, res: Response): Promise<void> {
  const { notifications, meta, unreadCount } = await notificationService.listMyNotifications(
    req.user!.id,
    req.query as { page?: number; limit?: number; unreadOnly?: string }
  );

  res.status(200).json({
    success: true,
    data: { notifications, unreadCount },
    meta,
  });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const unreadCount = await notificationService.getUnreadCount(req.user!.id);
  res.status(200).json({ success: true, data: { unreadCount } });
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  const notification = await notificationService.markAsRead(req.user!.id, req.params.id);
  res.status(200).json({ success: true, data: { notification } });
}

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  await notificationService.markAllAsRead(req.user!.id);
  res.status(200).json({ success: true, message: "All notifications marked as read" });
}
