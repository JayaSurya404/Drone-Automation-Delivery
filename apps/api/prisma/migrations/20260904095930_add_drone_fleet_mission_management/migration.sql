-- CreateEnum
CREATE TYPE "DroneAdapterType" AS ENUM ('SIMULATED', 'MAVLINK');

-- CreateEnum
CREATE TYPE "DroneStatus" AS ENUM ('IDLE', 'ASSIGNED', 'ARMED', 'IN_FLIGHT', 'RETURNING', 'LANDED', 'CHARGING', 'MAINTENANCE', 'EMERGENCY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('DELIVERY', 'RETURN_TO_HOME');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('PLANNED', 'DISPATCHED', 'IN_PROGRESS', 'RETURNING', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "MissionSafetyState" AS ENUM ('NOMINAL', 'LOW_BATTERY', 'SIGNAL_LOSS', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "WaypointStatus" AS ENUM ('PENDING', 'REACHED', 'SKIPPED');

-- CreateTable
CREATE TABLE "drones" (
    "id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "adapter_type" "DroneAdapterType" NOT NULL DEFAULT 'SIMULATED',
    "status" "DroneStatus" NOT NULL DEFAULT 'IDLE',
    "home_hub_id" TEXT,
    "battery_percent" INTEGER NOT NULL DEFAULT 100,
    "battery_health_percent" INTEGER NOT NULL DEFAULT 100,
    "battery_cycles" INTEGER NOT NULL DEFAULT 0,
    "current_lat" DOUBLE PRECISION,
    "current_lng" DOUBLE PRECISION,
    "altitude_meters" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "heading_degrees" DOUBLE PRECISION,
    "signal_strength_percent" INTEGER,
    "max_payload_kg" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "max_range_km" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "max_speed_mps" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "max_altitude_meters" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "is_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_note" TEXT,
    "last_maintenance_at" TIMESTAMP(3),
    "last_telemetry_at" TIMESTAMP(3),
    "total_flight_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_missions_completed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drone_health_logs" (
    "id" TEXT NOT NULL,
    "drone_id" TEXT NOT NULL,
    "status" "DroneStatus" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battery_logs" (
    "id" TEXT NOT NULL,
    "drone_id" TEXT NOT NULL,
    "battery_percent" INTEGER NOT NULL,
    "event" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "drone_id" TEXT,
    "operator_id" TEXT,
    "type" "MissionType" NOT NULL DEFAULT 'DELIVERY',
    "status" "MissionStatus" NOT NULL DEFAULT 'PLANNED',
    "safety_state" "MissionSafetyState" NOT NULL DEFAULT 'NOMINAL',
    "origin_lat" DOUBLE PRECISION NOT NULL,
    "origin_lng" DOUBLE PRECISION NOT NULL,
    "destination_lat" DOUBLE PRECISION NOT NULL,
    "destination_lng" DOUBLE PRECISION NOT NULL,
    "rth_triggered" BOOLEAN NOT NULL DEFAULT false,
    "abort_reason" TEXT,
    "planned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "arrived_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "aborted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waypoints" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "altitude_meters" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "status" "WaypointStatus" NOT NULL DEFAULT 'PENDING',
    "reached_at" TIMESTAMP(3),

    CONSTRAINT "waypoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_events" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "from_status" "MissionStatus",
    "to_status" "MissionStatus",
    "actor_id" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_samples" (
    "id" TEXT NOT NULL,
    "drone_id" TEXT NOT NULL,
    "mission_id" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "altitude_meters" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "heading_degrees" DOUBLE PRECISION,
    "battery_percent" INTEGER NOT NULL,
    "signal_strength_percent" INTEGER,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drones_serial_number_key" ON "drones"("serial_number");

-- CreateIndex
CREATE INDEX "drones_status_idx" ON "drones"("status");

-- CreateIndex
CREATE INDEX "drones_home_hub_id_idx" ON "drones"("home_hub_id");

-- CreateIndex
CREATE INDEX "drone_health_logs_drone_id_recorded_at_idx" ON "drone_health_logs"("drone_id", "recorded_at");

-- CreateIndex
CREATE INDEX "battery_logs_drone_id_recorded_at_idx" ON "battery_logs"("drone_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "missions_delivery_id_key" ON "missions"("delivery_id");

-- CreateIndex
CREATE INDEX "missions_status_idx" ON "missions"("status");

-- CreateIndex
CREATE INDEX "missions_drone_id_idx" ON "missions"("drone_id");

-- CreateIndex
CREATE UNIQUE INDEX "waypoints_mission_id_sequence_key" ON "waypoints"("mission_id", "sequence");

-- CreateIndex
CREATE INDEX "mission_events_mission_id_created_at_idx" ON "mission_events"("mission_id", "created_at");

-- CreateIndex
CREATE INDEX "telemetry_samples_drone_id_recorded_at_idx" ON "telemetry_samples"("drone_id", "recorded_at");

-- CreateIndex
CREATE INDEX "telemetry_samples_mission_id_recorded_at_idx" ON "telemetry_samples"("mission_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "drones" ADD CONSTRAINT "drones_home_hub_id_fkey" FOREIGN KEY ("home_hub_id") REFERENCES "fulfillment_hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drone_health_logs" ADD CONSTRAINT "drone_health_logs_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_logs" ADD CONSTRAINT "battery_logs_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waypoints" ADD CONSTRAINT "waypoints_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_samples" ADD CONSTRAINT "telemetry_samples_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_samples" ADD CONSTRAINT "telemetry_samples_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
