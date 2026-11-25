import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DronesService } from "../drones/drones.service";
import type { IngestTelemetryDto } from "./dto/ingest-telemetry.dto";

export interface TelemetrySampleView {
  id: string;
  /** Nullable since Phase 12: `TelemetrySample.droneId` is `SetNull` on drone deletion (preserving telemetry history for a since-removed drone) rather than cascading it away. A freshly-ingested sample (`ingest()`'s own return value) always has a real drone id — only a historical read (`getLatest`/`getHistory`) could ever see `null` here, and only for a drone that no longer exists. */
  droneId: string | null;
  missionId: string | null;
  lat: number;
  lng: number;
  altitudeMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  batteryPercent: number;
  signalStrengthPercent: number | null;
  recordedAt: string;
}

/**
 * The single ingest path for drone telemetry, regardless of source — the
 * in-process mission engine (`MissionsService`, same NestJS process) and the
 * standalone `services/drone-simulator` process (via the service-authenticated
 * `POST /internal/telemetry` endpoint) both funnel through `ingest()`, so a
 * `TelemetrySample`/`Drone`/`BatteryLog` row looks identical either way.
 */
@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dronesService: DronesService,
  ) {}

  async ingest(dto: IngestTelemetryDto): Promise<TelemetrySampleView> {
    const drone = await this.prisma.drone.findUnique({ where: { id: dto.droneId } });
    if (!drone) {
      throw new NotFoundException("Drone not found");
    }

    await this.dronesService.applyTelemetryUpdate(dto.droneId, {
      lat: dto.lat,
      lng: dto.lng,
      altitudeMeters: dto.altitudeMeters,
      speedMps: dto.speedMps,
      headingDegrees: dto.headingDegrees,
      batteryPercent: dto.batteryPercent,
      signalStrengthPercent: dto.signalStrengthPercent,
    });

    const sample = await this.prisma.telemetrySample.create({
      data: {
        droneId: dto.droneId,
        missionId: dto.missionId,
        lat: dto.lat,
        lng: dto.lng,
        altitudeMeters: dto.altitudeMeters,
        speedMps: dto.speedMps,
        headingDegrees: dto.headingDegrees,
        batteryPercent: dto.batteryPercent,
        signalStrengthPercent: dto.signalStrengthPercent,
      },
    });

    return this.toView(sample);
  }

  async getLatest(droneId: string): Promise<TelemetrySampleView | null> {
    const sample = await this.prisma.telemetrySample.findFirst({
      where: { droneId },
      orderBy: { recordedAt: "desc" },
    });
    return sample ? this.toView(sample) : null;
  }

  async getHistory(droneId: string, limit = 100): Promise<TelemetrySampleView[]> {
    const samples = await this.prisma.telemetrySample.findMany({
      where: { droneId },
      orderBy: { recordedAt: "desc" },
      take: Math.min(limit, 500),
    });
    return samples.map((s) => this.toView(s));
  }

  private toView(sample: {
    id: string;
    droneId: string | null;
    missionId: string | null;
    lat: number;
    lng: number;
    altitudeMeters: number | null;
    speedMps: number | null;
    headingDegrees: number | null;
    batteryPercent: number;
    signalStrengthPercent: number | null;
    recordedAt: Date;
  }): TelemetrySampleView {
    return {
      id: sample.id,
      droneId: sample.droneId,
      missionId: sample.missionId,
      lat: sample.lat,
      lng: sample.lng,
      altitudeMeters: sample.altitudeMeters,
      speedMps: sample.speedMps,
      headingDegrees: sample.headingDegrees,
      batteryPercent: sample.batteryPercent,
      signalStrengthPercent: sample.signalStrengthPercent,
      recordedAt: sample.recordedAt.toISOString(),
    };
  }
}
