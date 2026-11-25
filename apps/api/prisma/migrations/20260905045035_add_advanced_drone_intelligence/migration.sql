-- CreateEnum
CREATE TYPE "VisionDetectionClass" AS ENUM ('PERSON', 'VEHICLE', 'ANIMAL', 'OBSTACLE', 'STRUCTURE', 'VEGETATION', 'OPEN_GROUND');

-- CreateEnum
CREATE TYPE "LandingZoneVerdict" AS ENUM ('SUITABLE', 'MARGINAL', 'UNSUITABLE');

-- CreateEnum
CREATE TYPE "SwarmStatus" AS ENUM ('ACTIVE', 'DISBANDED');

-- CreateEnum
CREATE TYPE "SwarmMemberRole" AS ENUM ('LEADER', 'FOLLOWER');

-- CreateEnum
CREATE TYPE "SwarmPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SimulationRiskCategory" AS ENUM ('LOW_BATTERY', 'UNSAFE_LANDING_ZONE', 'ROUTE_OBSTRUCTION', 'GEOFENCE_CONFLICT', 'WEATHER_CONFLICT', 'PAYLOAD_CONSTRAINT', 'DRONE_AVAILABILITY_CONFLICT');

-- CreateEnum
CREATE TYPE "SimulationRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "vision_analyses" (
    "id" TEXT NOT NULL,
    "drone_id" TEXT,
    "mission_id" TEXT,
    "delivery_id" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "altitude_meters" DOUBLE PRECISION NOT NULL,
    "objects" JSONB NOT NULL,
    "landing_zone_candidate_count" INTEGER NOT NULL DEFAULT 0,
    "obstructed" BOOLEAN NOT NULL DEFAULT false,
    "human_detected" BOOLEAN NOT NULL DEFAULT false,
    "model_provider" TEXT NOT NULL DEFAULT 'SIMULATED',
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vision_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_zone_evaluations" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT,
    "delivery_id" TEXT,
    "vision_analysis_id" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius_meters" DOUBLE PRECISION NOT NULL,
    "size_score" INTEGER NOT NULL,
    "obstruction_score" INTEGER NOT NULL,
    "safety_score" INTEGER NOT NULL,
    "proximity_score" INTEGER NOT NULL,
    "suitability_score" INTEGER NOT NULL,
    "verdict" "LandingZoneVerdict" NOT NULL,
    "reasons" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_zone_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swarms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SwarmStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swarms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swarm_members" (
    "id" TEXT NOT NULL,
    "swarm_id" TEXT NOT NULL,
    "drone_id" TEXT NOT NULL,
    "role" "SwarmMemberRole" NOT NULL DEFAULT 'FOLLOWER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swarm_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swarm_plans" (
    "id" TEXT NOT NULL,
    "swarm_id" TEXT NOT NULL,
    "status" "SwarmPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "objective" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swarm_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swarm_assignments" (
    "id" TEXT NOT NULL,
    "swarm_plan_id" TEXT NOT NULL,
    "drone_id" TEXT,
    "delivery_id" TEXT,
    "sequence" INTEGER NOT NULL,
    "estimated_distance_meters" DOUBLE PRECISION NOT NULL,
    "estimated_duration_seconds" INTEGER NOT NULL,
    "battery_feasibility" TEXT NOT NULL,
    "payload_suitable" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swarm_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_scenarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by_id" TEXT,
    "origin_lat" DOUBLE PRECISION NOT NULL,
    "origin_lng" DOUBLE PRECISION NOT NULL,
    "destination_lat" DOUBLE PRECISION NOT NULL,
    "destination_lng" DOUBLE PRECISION NOT NULL,
    "drone_id" TEXT,
    "payload_kg" DOUBLE PRECISION NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'STANDARD',
    "weather_override" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL,
    "route_selected" BOOLEAN NOT NULL,
    "distance_meters" DOUBLE PRECISION,
    "duration_seconds" INTEGER,
    "estimated_battery_used_percent" DOUBLE PRECISION,
    "risk_score" DOUBLE PRECISION,
    "risk_level" TEXT,
    "summary" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_risk_findings" (
    "id" TEXT NOT NULL,
    "simulation_run_id" TEXT NOT NULL,
    "category" "SimulationRiskCategory" NOT NULL,
    "severity" "SimulationRiskSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_risk_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vision_analyses_drone_id_created_at_idx" ON "vision_analyses"("drone_id", "created_at");

-- CreateIndex
CREATE INDEX "vision_analyses_mission_id_created_at_idx" ON "vision_analyses"("mission_id", "created_at");

-- CreateIndex
CREATE INDEX "landing_zone_evaluations_mission_id_created_at_idx" ON "landing_zone_evaluations"("mission_id", "created_at");

-- CreateIndex
CREATE INDEX "landing_zone_evaluations_delivery_id_created_at_idx" ON "landing_zone_evaluations"("delivery_id", "created_at");

-- CreateIndex
CREATE INDEX "swarm_members_drone_id_idx" ON "swarm_members"("drone_id");

-- CreateIndex
CREATE UNIQUE INDEX "swarm_members_swarm_id_drone_id_key" ON "swarm_members"("swarm_id", "drone_id");

-- CreateIndex
CREATE INDEX "swarm_plans_swarm_id_created_at_idx" ON "swarm_plans"("swarm_id", "created_at");

-- CreateIndex
CREATE INDEX "swarm_assignments_swarm_plan_id_sequence_idx" ON "swarm_assignments"("swarm_plan_id", "sequence");

-- CreateIndex
CREATE INDEX "simulation_scenarios_created_at_idx" ON "simulation_scenarios"("created_at");

-- CreateIndex
CREATE INDEX "simulation_runs_scenario_id_created_at_idx" ON "simulation_runs"("scenario_id", "created_at");

-- CreateIndex
CREATE INDEX "simulation_risk_findings_simulation_run_id_idx" ON "simulation_risk_findings"("simulation_run_id");

-- AddForeignKey
ALTER TABLE "vision_analyses" ADD CONSTRAINT "vision_analyses_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_zone_evaluations" ADD CONSTRAINT "landing_zone_evaluations_vision_analysis_id_fkey" FOREIGN KEY ("vision_analysis_id") REFERENCES "vision_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarms" ADD CONSTRAINT "swarms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarm_members" ADD CONSTRAINT "swarm_members_swarm_id_fkey" FOREIGN KEY ("swarm_id") REFERENCES "swarms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarm_members" ADD CONSTRAINT "swarm_members_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarm_plans" ADD CONSTRAINT "swarm_plans_swarm_id_fkey" FOREIGN KEY ("swarm_id") REFERENCES "swarms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarm_plans" ADD CONSTRAINT "swarm_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarm_assignments" ADD CONSTRAINT "swarm_assignments_swarm_plan_id_fkey" FOREIGN KEY ("swarm_plan_id") REFERENCES "swarm_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarm_assignments" ADD CONSTRAINT "swarm_assignments_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "simulation_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_risk_findings" ADD CONSTRAINT "simulation_risk_findings_simulation_run_id_fkey" FOREIGN KEY ("simulation_run_id") REFERENCES "simulation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
