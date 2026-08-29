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
  call_sign: string;
  model: string;
  serial_number: string | null;
  status: string;
  battery_percent: number;
  max_payload_grams: number;
  current_latitude: number;
  current_longitude: number;
  current_altitude_meters: number;
  home_latitude: number;
  home_longitude: number;
  home_altitude_meters: number;
  is_active: boolean;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface BatteryTable {
  id: string;
  organization_id: string;
  drone_id: string | null;
  cycle_count: number;
}

export interface OrderTable {
  id: string;
  order_number: string;
  organization_id: string;
  customer_id: string;
  status: string;
  priority: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_altitude_meters: number;
  pickup_address: string | null;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_altitude_meters: number;
  delivery_address: string | null;
  package_weight_grams: number;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  package_description: string | null;
  delivery_notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  cancelled_by_user_id: string | null;
  failure_reason: string | null;
  failed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  confirmed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  assigned_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  delivered_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface PackageTable {
  id: string;
  organization_id: string;
  order_id: string;
  weight_grams: number;
}

export interface MissionTable {
  id: string;
  mission_number: string;
  organization_id: string;
  drone_id: string | null;
  order_id: string;
  status: string;
  origin_latitude: number;
  origin_longitude: number;
  origin_altitude_meters: number | null;
  origin_address: string | null;
  destination_latitude: number;
  destination_longitude: number;
  destination_altitude_meters: number | null;
  destination_address: string | null;
  assigned_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  launched_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  completed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  cancelled_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  cancellation_reason: string | null;
  failed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  failure_reason: string | null;
  emergency_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  emergency_reason: string | null;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
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
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  aggregate_type: string | null;
  aggregate_id: string | null;
  event_id: string | null;
  metadata: ColumnType<unknown, string | object | null | undefined, string | object | null | undefined>;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface OutboxEventTable {
  id: string;
  organization_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_id: string | null;
  payload: ColumnType<unknown, string | object | null | undefined, string | object | null | undefined>;
  occurred_at: ColumnType<Date, Date | string | undefined, never>;
  processed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null | undefined>;
  attempts: number;
  last_error: string | null;
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
  outbox_events: OutboxEventTable;
  _schema_migrations: SchemaMigrationsTable;
}
