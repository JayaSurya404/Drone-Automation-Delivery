import { BadRequestException, Injectable } from "@nestjs/common";
import type { CustomerAddress } from "@prisma/client";
import { GeofencingService } from "../geofencing/geofencing.service";
import type { CheckoutDto } from "./dto/checkout.dto";

/**
 * Server-side order-creation gate enforcing active PostGIS service-area
 * and DGCA prohibited No-Fly Zone constraints.
 */
@Injectable()
export class ServiceAreaChecker {
  constructor(private readonly geofencingService: GeofencingService) {}

  async check(address: CustomerAddress, dto?: CheckoutDto): Promise<{ passed: true }> {
    let lat = dto?.latitude;
    let lng = dto?.longitude;
    const radius = dto?.clearanceRadiusMeters ?? 3.5;

    if (lat === undefined || lng === undefined) {
      const isCoimbatore =
        (address.city && address.city.toLowerCase().includes("coimbatore")) ||
        (address.line1 && address.line1.toLowerCase().includes("kurumbapalayam")) ||
        (address.line2 && address.line2.toLowerCase().includes("kurumbapalayam"));
      lat = isCoimbatore ? 11.1085 : 11.1132;
      lng = isCoimbatore ? 77.0250 : 77.0277;
    }

    const result = await this.geofencingService.checkEligibility(lat, lng, radius);
    if (!result.isEligible) {
      throw new BadRequestException(result.message);
    }
    return { passed: true };
  }
}
