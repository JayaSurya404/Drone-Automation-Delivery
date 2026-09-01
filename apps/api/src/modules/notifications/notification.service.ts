import crypto from "node:crypto";
import type {
  AuthenticatedUser,
  DomainEventEnvelope,
  NotificationResponse,
  NotificationListQuery,
  NotificationListResponse,
  NotificationType,
  NotificationSeverity
} from "@skynav/contracts";
import type { NotificationRepository } from "./notification.repository.js";
import type { AuditService } from "../audit/audit.service.js";

export class NotificationNotFoundError extends Error {
  constructor(id: string) {
    super(`Notification with ID '${id}' not found.`);
    this.name = "NotificationNotFoundError";
  }
}

export class NotificationForbiddenError extends Error {
  constructor(message = "You are not authorized to access this notification.") {
    super(message);
    this.name = "NotificationForbiddenError";
  }
}

export interface NotificationService {
  listNotifications(user: AuthenticatedUser, query: NotificationListQuery): Promise<NotificationListResponse>;
  getNotification(id: string, user: AuthenticatedUser): Promise<NotificationResponse>;
  markNotificationRead(id: string, user: AuthenticatedUser): Promise<NotificationResponse>;
  markAllRead(user: AuthenticatedUser): Promise<{ updatedCount: number }>;
  createFromDomainEvent(event: DomainEventEnvelope): Promise<NotificationResponse[]>;
}

export function createNotificationService(
  notificationRepo: NotificationRepository,
  auditService?: AuditService
): NotificationService {
  return {
    async listNotifications(user: AuthenticatedUser, query: NotificationListQuery): Promise<NotificationListResponse> {
      const isCustomer = user.role === "CUSTOMER";
      const userId = isCustomer ? user.id : undefined;

      const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
      const offset = Math.max(query.offset ?? 0, 0);

      const result = await notificationRepo.list({
        organizationId: user.organizationId,
        userId,
        isRead: query.isRead,
        type: query.type,
        severity: query.severity,
        limit,
        offset
      });

      return {
        data: result.data,
        unreadCount: result.unreadCount,
        pagination: {
          total: result.total,
          limit,
          offset
        }
      };
    },

    async getNotification(id: string, user: AuthenticatedUser): Promise<NotificationResponse> {
      const isCustomer = user.role === "CUSTOMER";
      const userId = isCustomer ? user.id : undefined;

      const notification = await notificationRepo.findById(id, user.organizationId, userId);
      if (!notification) {
        throw new NotificationNotFoundError(id);
      }

      return notification;
    },

    async markNotificationRead(id: string, user: AuthenticatedUser): Promise<NotificationResponse> {
      const isCustomer = user.role === "CUSTOMER";
      const userId = isCustomer ? user.id : undefined;

      const updated = await notificationRepo.markRead(id, user.organizationId, userId);
      if (!updated) {
        throw new NotificationNotFoundError(id);
      }

      return updated;
    },

    async markAllRead(user: AuthenticatedUser): Promise<{ updatedCount: number }> {
      const isCustomer = user.role === "CUSTOMER";
      const userId = isCustomer ? user.id : undefined;

      const count = await notificationRepo.markAllRead(user.organizationId, userId);
      return { updatedCount: count };
    },

    async createFromDomainEvent(event: DomainEventEnvelope): Promise<NotificationResponse[]> {
      const createdNotifications: NotificationResponse[] = [];

      // Determine recipients and content based on domain event type
      const { eventType, organizationId, aggregateType, aggregateId, payload, id: eventId } = event;

      let type: NotificationType = "SYSTEM";
      let severity: NotificationSeverity = "INFO";
      let title = "System Notification";
      let message = "A system activity event was recorded.";
      let customerRecipientId: string | null = null;
      let notifyCustomer = false;
      let notifyAdmin = false;

      // Extract customerId if present in payload
      if (typeof payload?.customerId === "string") {
        customerRecipientId = payload.customerId;
      }

      switch (eventType) {
        case "ORDER_CREATED":
          type = "ORDER_UPDATE";
          severity = "INFO";
          title = "Order Created";
          message = `Order ${payload?.orderNumber ?? aggregateId} has been placed successfully.`;
          notifyCustomer = true;
          notifyAdmin = true;
          break;

        case "ORDER_CONFIRMED":
          type = "ORDER_UPDATE";
          severity = "INFO";
          title = "Order Confirmed";
          message = `Order ${payload?.orderNumber ?? aggregateId} is confirmed and queued for aerial dispatch.`;
          notifyCustomer = true;
          break;

        case "ORDER_ASSIGNED":
        case "MISSION_ASSIGNED":
          type = "DELIVERY_UPDATE";
          severity = "INFO";
          title = "Drone Assigned";
          message = `UAV assigned to delivery mission. Pre-flight checks in progress.`;
          notifyCustomer = true;
          notifyAdmin = true;
          break;

        case "ORDER_IN_TRANSIT":
        case "MISSION_LAUNCHED":
        case "DRONE_TAKEOFF":
          type = "DELIVERY_UPDATE";
          severity = "INFO";
          title = "Delivery In Flight";
          message = `Your UAV is airborne and navigating the delivery corridor.`;
          notifyCustomer = true;
          notifyAdmin = true;
          break;

        case "DRONE_ARRIVED":
        case "MISSION_DELIVERING":
          type = "DELIVERY_UPDATE";
          severity = "INFO";
          title = "UAV Approaching Destination";
          message = `Drone has arrived at the drop zone. Prepare for rooftop delivery.`;
          notifyCustomer = true;
          break;

        case "ORDER_DELIVERED":
        case "MISSION_COMPLETED":
          type = "DELIVERY_UPDATE";
          severity = "SUCCESS";
          title = "Delivery Completed";
          message = `Package successfully verified and delivered. Touchdown complete.`;
          notifyCustomer = true;
          notifyAdmin = true;
          break;

        case "ORDER_CANCELLED":
        case "MISSION_CANCELLED":
          type = "ORDER_UPDATE";
          severity = "WARNING";
          title = "Delivery Cancelled";
          message = `Order ${payload?.orderNumber ?? aggregateId} was cancelled. Reason: ${payload?.reason ?? "Operator request"}`;
          notifyCustomer = true;
          notifyAdmin = true;
          break;

        case "ORDER_FAILED":
        case "MISSION_FAILED":
          type = "DELIVERY_UPDATE";
          severity = "CRITICAL";
          title = "Delivery Mission Failed";
          message = `Mission failed. Failsafe activated: ${payload?.reason ?? "Obstacle or corridor fault"}`;
          notifyCustomer = true;
          notifyAdmin = true;
          break;

        case "DRONE_LOW_BATTERY":
          type = "DRONE_UPDATE";
          severity = "WARNING";
          title = "UAV Low Battery Warning";
          message = `Drone battery reached advisory threshold (${payload?.batteryPercent ?? 25}%).`;
          notifyAdmin = true;
          break;

        case "DRONE_CRITICAL_BATTERY":
          type = "DRONE_UPDATE";
          severity = "CRITICAL";
          title = "Critical Battery Alert — RTH Triggered";
          message = `Critical battery threshold reached (${payload?.batteryPercent ?? 15}%). Autonomous Return-To-Home initiated.`;
          notifyAdmin = true;
          notifyCustomer = Boolean(customerRecipientId);
          break;

        case "DRONE_EMERGENCY":
        case "EMERGENCY_TRIGGERED":
        case "MISSION_EMERGENCY":
          type = "EMERGENCY";
          severity = "CRITICAL";
          title = "Emergency Protocol Triggered";
          message = `Emergency declared: ${payload?.reason ?? "Safety interlock triggered"}. Flight systems responding.`;
          notifyAdmin = true;
          notifyCustomer = Boolean(customerRecipientId);
          break;

        case "EMERGENCY_CLEARED":
          type = "EMERGENCY";
          severity = "INFO";
          title = "Emergency Cleared";
          message = `Operational emergency status cleared. Systems normal.`;
          notifyAdmin = true;
          break;

        default:
          type = "SYSTEM";
          severity = "INFO";
          title = `Activity Update: ${eventType}`;
          message = `System recorded event ${eventType}.`;
          notifyAdmin = true;
          break;
      }

      // 1. Create customer notification if applicable
      if (notifyCustomer && customerRecipientId) {
        const custNotif = await notificationRepo.create({
          id: crypto.randomUUID(),
          organizationId,
          userId: customerRecipientId,
          type,
          severity,
          title,
          message,
          aggregateType,
          aggregateId,
          eventId,
          metadata: payload
        });
        createdNotifications.push(custNotif);
      }

      // 2. Create organization-wide admin notification if applicable
      if (notifyAdmin) {
        const adminNotif = await notificationRepo.create({
          id: crypto.randomUUID(),
          organizationId,
          userId: null, // null userId indicates organization-wide broadcast for operators/admins
          type,
          severity,
          title,
          message,
          aggregateType,
          aggregateId,
          eventId,
          metadata: payload
        });
        createdNotifications.push(adminNotif);
      }

      return createdNotifications;
    }
  };
}
