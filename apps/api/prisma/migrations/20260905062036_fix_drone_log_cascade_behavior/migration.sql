-- DropForeignKey
ALTER TABLE "battery_logs" DROP CONSTRAINT "battery_logs_drone_id_fkey";

-- DropForeignKey
ALTER TABLE "drone_health_logs" DROP CONSTRAINT "drone_health_logs_drone_id_fkey";

-- DropForeignKey
ALTER TABLE "telemetry_samples" DROP CONSTRAINT "telemetry_samples_drone_id_fkey";

-- DropIndex
DROP INDEX "geofences_polygon_gist_idx";

-- AlterTable
ALTER TABLE "battery_logs" ALTER COLUMN "drone_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "drone_health_logs" ALTER COLUMN "drone_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "telemetry_samples" ALTER COLUMN "drone_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "drone_health_logs" ADD CONSTRAINT "drone_health_logs_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_logs" ADD CONSTRAINT "battery_logs_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_samples" ADD CONSTRAINT "telemetry_samples_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
