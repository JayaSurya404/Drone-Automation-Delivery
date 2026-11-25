-- CreateIndex
CREATE INDEX "deliveries_created_at_idx" ON "deliveries"("created_at");

-- CreateIndex
CREATE INDEX "mission_events_type_created_at_idx" ON "mission_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "missions_created_at_idx" ON "missions"("created_at");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
