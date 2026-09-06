import { Router } from "express";
import * as notificationController from "@/controllers/notification.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  listNotificationsSchema,
  markNotificationReadSchema,
} from "@/validators/notification.validators";

const router = Router();

// Every route here is scoped to req.user.id — both STUDENT and ADMIN
// accounts can have notifications, so there's no requireRole() guard.
router.get("/", authMiddleware, validate(listNotificationsSchema), notificationController.listMyNotifications);
router.get("/unread-count", authMiddleware, notificationController.getUnreadCount);
router.patch(
  "/read-all",
  authMiddleware,
  notificationController.markAllAsRead
);
router.patch(
  "/:id/read",
  authMiddleware,
  validate(markNotificationReadSchema),
  notificationController.markAsRead
);

export default router;
