import { Injectable } from "@nestjs/common";
import type { CustomerAddress } from "@prisma/client";

/**
 * Stub per `docs/prompts/phase-04-checkout-orders.md`: always passes. The
 * real check (point-in-polygon against an active `Geofence` of type
 * "service-area" for the nearest hub, blueprint Section P) lands in Phase 8
 * — this seam exists now so the checkout call site never has to change
 * shape when that lands, only this class's implementation.
 */
@Injectable()
export class ServiceAreaChecker {
  async check(_address: CustomerAddress): Promise<{ passed: true }> {
    return { passed: true };
  }
}
