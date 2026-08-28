import type { ColumnType, Generated } from "kysely";

export interface OrganizationTable {
  id: string;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface UserTable {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OrganizationMemberTable {
  organization_id: string;
  user_id: string;
  role: string;
}

export interface RefreshTokenTable {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: ColumnType<Date, string, string>;
  revoked_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  replaced_by_token_id: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AuditLogTable {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: ColumnType<unknown, string | object | null | undefined, string | object | null | undefined>;
  correlation_id: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface DroneModelTable {
  id: string;
  manufacturer: string;
  name: string;
  max_payload_grams: number;
}

export interface DroneTable {
  id: string;
  organization_id: string;
  model_id: string | null;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface BatteryTable {
  id: string;
  organization_id: string;
  drone_id: string | null;
  cycle_count: number;
}

export interface OrderTable {
  id: string;
  organization_id: string;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PackageTable {
  id: string;
  organization_id: string;
  order_id: string;
  weight_grams: number;
}

export interface MissionTable {
  id: string;
  organization_id: string;
  drone_id: string | null;
  order_id: string | null;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface MissionWaypointTable {
  id: string;
  mission_id: string;
  sequence: number;
  position: string; // geometry(PointZ, 4326)
}

export interface RecipientTable {
  id: string;
  organization_id: string;
  order_id: string;
}

export interface DeliveryTable {
  id: string;
  organization_id: string;
  mission_id: string | null;
  recipient_id: string | null;
  status: string;
}

export interface TelemetryMetadataTable {
  id: string;
  organization_id: string;
  drone_id: string;
  observed_at: ColumnType<Date, string, never>;
  source: string;
}

export interface GeofenceTable {
  id: string;
  organization_id: string;
  name: string;
  boundary: string; // geometry(Polygon, 4326)
}

export interface WeatherSnapshotTable {
  id: string;
  organization_id: string;
  observed_at: ColumnType<Date, string, never>;
  payload: ColumnType<unknown, string | object, string | object>;
}

export interface AlertTable {
  id: string;
  organization_id: string;
  mission_id: string | null;
  severity: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface IncidentTable {
  id: string;
  organization_id: string;
  mission_id: string | null;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface NotificationTable {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface SchemaMigrationsTable {
  name: string;
  applied_at: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  organizations: OrganizationTable;
  users: UserTable;
  organization_members: OrganizationMemberTable;
  refresh_tokens: RefreshTokenTable;
  audit_logs: AuditLogTable;
  drone_models: DroneModelTable;
  drones: DroneTable;
  batteries: BatteryTable;
  orders: OrderTable;
  packages: PackageTable;
  missions: MissionTable;
  mission_waypoints: MissionWaypointTable;
  recipients: RecipientTable;
  deliveries: DeliveryTable;
  telemetry_metadata: TelemetryMetadataTable;
  geofences: GeofenceTable;
  weather_snapshots: WeatherSnapshotTable;
  alerts: AlertTable;
  incidents: IncidentTable;
  notifications: NotificationTable;
  _schema_migrations: SchemaMigrationsTable;
}
