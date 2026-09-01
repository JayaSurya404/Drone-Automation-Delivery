import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";
import type {
  NotificationResponse,
  NotificationType,
  NotificationSeverity
} from "@skynav/contracts";

export interface CreateNotificationData {
  id: string;
  organizationId: string;
  userId?: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListNotificationsParams {
  organizationId: string;
  userId?: string | null;
  isRead?: boolean;
  type?: NotificationType;
  severity?: NotificationSeverity;
  limit: number;
  offset: number;
}

export interface NotificationRepository {
  create(data: CreateNotificationData, executor?: Kysely<Database> | Transaction<Database>): Promise<NotificationResponse>;
  findById(id: string, organizationId: string, userId?: string | null): Promise<NotificationResponse | null>;
  list(params: ListNotificationsParams): Promise<{ data: NotificationResponse[]; unreadCount: number; total: number }>;
  markRead(id: string, organizationId: string, userId?: string | null): Promise<NotificationResponse | null>;
  markAllRead(organizationId: string, userId?: string | null): Promise<number>;
}

export function createNotificationRepository(db: Kysely<Database>): NotificationRepository {
  function mapRowToResponse(row: any): NotificationResponse {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      type: row.type as NotificationType,
      severity: row.severity as NotificationSeverity,
      title: row.title,
      message: row.message,
      isRead: Boolean(row.is_read),
      readAt: row.read_at instanceof Date ? row.read_at.toISOString() : (row.read_at ? String(row.read_at) : null),
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventId: row.event_id,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata as Record<string, unknown> | null),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
    };
  }

  return {
    async create(data: CreateNotificationData, executor: Kysely<Database> | Transaction<Database> = db): Promise<NotificationResponse> {
      // Idempotent insertion using ON CONFLICT DO NOTHING when event_id and user_id match
      const [inserted] = await executor
        .insertInto("notifications")
        .values({
          id: data.id,
          organization_id: data.organizationId,
          user_id: data.userId ?? null,
          type: data.type,
          severity: data.severity,
          title: data.title,
          message: data.message,
          is_read: false,
          read_at: null,
          aggregate_type: data.aggregateType ?? null,
          aggregate_id: data.aggregateId ?? null,
          event_id: data.eventId ?? null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          updated_at: new Date()
        })
        .onConflict((oc) =>
          oc.columns(["event_id", "user_id"]).doUpdateSet({
            updated_at: new Date()
          })
        )
        .returningAll()
        .execute();

      return mapRowToResponse(inserted);
    },

    async findById(id: string, organizationId: string, userId?: string | null): Promise<NotificationResponse | null> {
      let query = db
        .selectFrom("notifications")
        .selectAll()
        .where("id", "=", id)
        .where("organization_id", "=", organizationId);

      if (userId !== undefined && userId !== null) {
        const targetUserId = userId;
        query = query.where((eb) =>
          eb.or([
            eb("user_id", "=", targetUserId),
            eb("user_id", "is", null)
          ])
        );
      }

      const row = await query.executeTakeFirst();
      return row ? mapRowToResponse(row) : null;
    },

    async list(params: ListNotificationsParams): Promise<{ data: NotificationResponse[]; unreadCount: number; total: number }> {
      let baseQuery = db
        .selectFrom("notifications")
        .where("organization_id", "=", params.organizationId);

      if (params.userId !== undefined && params.userId !== null) {
        const targetUserId = params.userId;
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb("user_id", "=", targetUserId),
            eb("user_id", "is", null)
          ])
        );
      }

      if (params.type !== undefined) {
        baseQuery = baseQuery.where("type", "=", params.type);
      }

      if (params.severity !== undefined) {
        baseQuery = baseQuery.where("severity", "=", params.severity);
      }

      // Count unread notifications
      const unreadRow = await baseQuery
        .select((eb) => eb.fn.count("id").as("count"))
        .where("is_read", "=", false)
        .executeTakeFirst();
      const unreadCount = Number(unreadRow?.count ?? 0);

      // Filter by isRead if specified
      if (params.isRead !== undefined) {
        baseQuery = baseQuery.where("is_read", "=", params.isRead);
      }

      // Total count matching query
      const totalRow = await baseQuery
        .select((eb) => eb.fn.count("id").as("count"))
        .executeTakeFirst();
      const total = Number(totalRow?.count ?? 0);

      // Fetch paginated data
      const rows = await baseQuery
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(params.limit)
        .offset(params.offset)
        .execute();

      return {
        data: rows.map(mapRowToResponse),
        unreadCount,
        total
      };
    },

    async markRead(id: string, organizationId: string, userId?: string | null): Promise<NotificationResponse | null> {
      let query = db
        .updateTable("notifications")
        .set({
          is_read: true,
          read_at: new Date(),
          updated_at: new Date()
        })
        .where("id", "=", id)
        .where("organization_id", "=", organizationId);

      if (userId !== undefined && userId !== null) {
        const targetUserId = userId;
        query = query.where((eb) =>
          eb.or([
            eb("user_id", "=", targetUserId),
            eb("user_id", "is", null)
          ])
        );
      }

      const [updated] = await query.returningAll().execute();
      return updated ? mapRowToResponse(updated) : null;
    },

    async markAllRead(organizationId: string, userId?: string | null): Promise<number> {
      let query = db
        .updateTable("notifications")
        .set({
          is_read: true,
          read_at: new Date(),
          updated_at: new Date()
        })
        .where("organization_id", "=", organizationId)
        .where("is_read", "=", false);

      if (userId !== undefined && userId !== null) {
        const targetUserId = userId;
        query = query.where((eb) =>
          eb.or([
            eb("user_id", "=", targetUserId),
            eb("user_id", "is", null)
          ])
        );
      }

      const result = await query.execute();
      return Number(result[0]?.numUpdatedRows ?? 0);
    }
  };
}
