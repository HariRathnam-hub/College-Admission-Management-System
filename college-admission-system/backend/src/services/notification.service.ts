import { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { AppError } from "@/middlewares/error.middleware";
import { getPagination, buildMeta, PaginationQuery } from "@/utils/pagination";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedApplicationId?: string;
}

/**
 * Accepts either the singleton `prisma` client or a transaction client
 * (`tx` from `prisma.$transaction(async (tx) => ...)`), so callers in
 * applicationReview.service and application.service can create the
 * notification atomically alongside the status/history change instead of
 * as a separate, potentially-inconsistent write.
 */
type PrismaOrTx = PrismaClient | Prisma.TransactionClient;

export async function createNotification(
  input: CreateNotificationInput,
  client: PrismaOrTx = prisma
) {
  return client.notification.create({ data: input });
}

interface ListNotificationsQuery extends PaginationQuery {
  unreadOnly?: string;
}

export async function listMyNotifications(userId: string, query: ListNotificationsQuery) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unreadOnly === "true" ? { isRead: false } : {}),
  };

  const [notifications, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, meta: buildMeta(total, page, limit), unreadCount };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(userId: string, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });

  // 404 (not 403) if it belongs to someone else — consistent with
  // utils/ownership.ts's approach of not confirming another user's
  // resource exists.
  if (!notification || notification.userId !== userId) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.isRead) {
    return notification;
  }

  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
