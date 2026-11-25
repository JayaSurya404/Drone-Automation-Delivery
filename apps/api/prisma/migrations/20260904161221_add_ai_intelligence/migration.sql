-- CreateEnum
CREATE TYPE "MissionRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AiDecisionType" AS ENUM ('ROUTE_OPTIMIZATION', 'ETA_PREDICTION', 'RISK_ASSESSMENT', 'DRONE_RECOMMENDATION', 'REROUTE');

-- AlterTable
ALTER TABLE "missions" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "requires_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "risk_level" "MissionRiskLevel",
ADD COLUMN     "risk_score" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ai_decision_logs" (
    "id" TEXT NOT NULL,
    "type" "AiDecisionType" NOT NULL,
    "delivery_id" TEXT,
    "mission_id" TEXT,
    "summary" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_decision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_decision_logs_delivery_id_created_at_idx" ON "ai_decision_logs"("delivery_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_decision_logs_mission_id_created_at_idx" ON "ai_decision_logs"("mission_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_decision_logs_type_created_at_idx" ON "ai_decision_logs"("type", "created_at");

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
