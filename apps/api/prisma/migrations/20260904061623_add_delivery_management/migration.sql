-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING_ASSIGNMENT', 'HUB_ASSIGNED', 'MISSION_PLANNED', 'DRONE_DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DELIVERED_PENDING_VERIFICATION', 'COMPLETED', 'VERIFICATION_FAILED', 'REDELIVERY_SCHEDULED', 'CANCELLED', 'RETURNED_TO_HUB');

-- CreateEnum
CREATE TYPE "DeliveryPriority" AS ENUM ('STANDARD', 'EXPRESS');

-- CreateEnum
CREATE TYPE "DeliveryVerificationMethod" AS ENUM ('OTP', 'QR');

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "hub_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    "priority" "DeliveryPriority" NOT NULL DEFAULT 'STANDARD',
    "delivery_address" JSONB NOT NULL,
    "special_instructions" TEXT,
    "scheduled_window_start" TIMESTAMP(3),
    "scheduled_window_end" TIMESTAMP(3),
    "estimated_delivery_at" TIMESTAMP(3),
    "verification_code_hash" TEXT,
    "verification_expires_at" TIMESTAMP(3),
    "verification_attempts" INTEGER NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "from_status" "DeliveryStatus",
    "to_status" "DeliveryStatus" NOT NULL,
    "note" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_deliveries" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "method" "DeliveryVerificationMethod" NOT NULL,
    "image_storage_key" TEXT,
    "recipient_note" TEXT,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_order_id_key" ON "deliveries"("order_id");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_hub_id_idx" ON "deliveries"("hub_id");

-- CreateIndex
CREATE INDEX "delivery_events_delivery_id_created_at_idx" ON "delivery_events"("delivery_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_deliveries_delivery_id_key" ON "proof_of_deliveries"("delivery_id");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_hub_id_fkey" FOREIGN KEY ("hub_id") REFERENCES "fulfillment_hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
