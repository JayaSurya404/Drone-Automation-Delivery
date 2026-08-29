import type {
  NotificationRepository,
  CreateNotificationData,
  ListNotificationsParams
} from "../notification.repository.js";
import type { NotificationResponse } from "@skynav/contracts";

export function createMockNotificationRepository(): NotificationRepository & { notifications: NotificationResponse[] } {
  const notifications: NotificationResponse[] = [];

  return {
    notifications,

    async create(data: CreateNotificationData): Promise<NotificationResponse> {
      // Check idempotency by eventId + userId
      if (data.eventId) {
        const existing = notifications.find(
          (n) => n.eventId === data.eventId && n.userId === (data.userId ?? null)
        );
        if (existing) {
          return existing;
        }
      }

      const notif: NotificationResponse = {
        id: data.id,
        organizationId: data.organizationId,
        userId: data.userId ?? null,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        isRead: false,
        readAt: null,
        aggregateType: data.aggregateType ?? null,
        aggregateId: data.aggregateId ?? null,
        eventId: data.eventId ?? null,
        metadata: data.metadata ?? null,
        createdAt: new Date().toISOString()
      };

      notifications.unshift(notif);
      return notif;
    },

    async findById(id: string, organizationId: string, userId?: string | null): Promise<NotificationResponse | null> {
      const found = notifications.find((n) => {
        if (n.id !== id || n.organizationId !== organizationId) return false;
        if (userId !== undefined && userId !== null) {
          return n.userId === userId || n.userId === null;
        }
        return true;
      });
      return found ?? null;
    },

    async list(params: ListNotificationsParams): Promise<{ data: NotificationResponse[]; unreadCount: number; total: number }> {
      let filtered = notifications.filter((n) => n.organizationId === params.organizationId);

      if (params.userId !== undefined && params.userId !== null) {
        filtered = filtered.filter((n) => n.userId === params.userId || n.userId === null);
      }

      if (params.type !== undefined) {
        filtered = filtered.filter((n) => n.type === params.type);
      }

      if (params.severity !== undefined) {
        filtered = filtered.filter((n) => n.severity === params.severity);
      }

      const unreadCount = filtered.filter((n) => !n.isRead).length;

      if (params.isRead !== undefined) {
        filtered = filtered.filter((n) => n.isRead === params.isRead);
      }

      const total = filtered.length;
      const data = filtered.slice(params.offset, params.offset + params.limit);

      return {
        data,
        unreadCount,
        total
      };
    },

    async markRead(id: string, organizationId: string, userId?: string | null): Promise<NotificationResponse | null> {
      const found = await this.findById(id, organizationId, userId);
      if (found) {
        found.isRead = true;
        found.readAt = new Date().toISOString();
        return found;
      }
      return null;
    },

    async markAllRead(organizationId: string, userId?: string | null): Promise<number> {
      let count = 0;
      for (const n of notifications) {
        if (n.organizationId === organizationId && !n.isRead) {
          if (userId !== undefined && userId !== null) {
            if (n.userId === userId || n.userId === null) {
              n.isRead = true;
              n.readAt = new Date().toISOString();
              count++;
            }
          } else {
            n.isRead = true;
            n.readAt = new Date().toISOString();
            count++;
          }
        }
      }
      return count;
    }
  };
}
