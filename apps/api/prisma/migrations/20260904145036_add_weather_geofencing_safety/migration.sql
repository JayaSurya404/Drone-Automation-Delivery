-- CreateEnum
CREATE TYPE "GeofenceType" AS ENUM ('SERVICE_AREA', 'NO_FLY', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "WeatherCondition" AS ENUM ('CLEAR', 'CLOUDY', 'RAIN', 'STORM', 'SNOW', 'FOG');

-- CreateEnum
CREATE TYPE "WeatherProviderSource" AS ENUM ('LOCAL', 'OPEN_METEO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MissionSafetyState" ADD VALUE 'WEATHER_HOLD';
ALTER TYPE "MissionSafetyState" ADD VALUE 'GEOFENCE_BREACH';

-- CreateTable
CREATE TABLE "geofences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GeofenceType" NOT NULL,
    "description" TEXT,
    "polygon" geometry(Polygon,4326) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_snapshots" (
    "id" TEXT NOT NULL,
    "zone_key" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "wind_speed_mps" DOUBLE PRECISION NOT NULL,
    "wind_direction_degrees" DOUBLE PRECISION,
    "precipitation_mm" DOUBLE PRECISION NOT NULL,
    "temperature_celsius" DOUBLE PRECISION NOT NULL,
    "condition" "WeatherCondition" NOT NULL,
    "source" "WeatherProviderSource" NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geofences_type_is_active_idx" ON "geofences"("type", "is_active");

-- CreateIndex
CREATE INDEX "weather_snapshots_zone_key_fetched_at_idx" ON "weather_snapshots"("zone_key", "fetched_at");

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
