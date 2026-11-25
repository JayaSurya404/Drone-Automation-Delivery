import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { TelemetryService } from "./telemetry.service";

export interface GazeboTelemetryPayload {
  isNativeGazeboRunning?: boolean;
  simulationMode?: string;
  droneId?: string;
  latitude: number;
  longitude: number;
  altitudeAgl: number;
  speedKmh: number;
  attitude?: { yawDeg?: number };
  sensors?: { battery?: number };
  flightPhase?: string;
}

@Injectable()
export class GazeboBridgeService implements OnModuleInit, OnModuleDestroy {
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly bridgeUrl: string;
  private readonly isEnabled: boolean;
  private readonly serviceKey: string;
  private readonly configuredDroneId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetryService: TelemetryService,
    private readonly configService: ConfigService,
  ) {
    this.bridgeUrl =
      this.configService.get<string>("GAZEBO_BRIDGE_URL", { infer: true }) ||
      process.env.GAZEBO_BRIDGE_URL ||
      "http://127.0.0.1:8085";

    this.serviceKey =
      this.configService.get<string>("SKYNAV_INTERNAL_SERVICE_KEY", { infer: true }) ||
      process.env.SKYNAV_INTERNAL_SERVICE_KEY ||
      "";

    this.configuredDroneId =
      this.configService.get<string>("GAZEBO_DRONE_ID", { infer: true }) ||
      process.env.GAZEBO_DRONE_ID ||
      "";

    const isProduction =
      (this.configService.get<string>("NODE_ENV", { infer: true }) || process.env.NODE_ENV) === "production";
    const bridgeEnabledFlag =
      (this.configService.get<string>("GAZEBO_BRIDGE_ENABLED", { infer: true }) ||
        process.env.GAZEBO_BRIDGE_ENABLED) === "true";

    // Enable ONLY when GAZEBO_BRIDGE_ENABLED=true (default false, forced off in production)
    this.isEnabled = !isProduction && bridgeEnabledFlag;
  }

  onModuleInit(): void {
    if (!this.isEnabled) {
      return;
    }
    // Poll Gazebo bridge every 2s
    this.pollInterval = setInterval(() => {
      this.pollGazebo().catch(() => undefined);
    }, 2000);
  }

  onModuleDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async pollGazebo(): Promise<void> {
    if (!this.isEnabled) return;
    try {
      const headers: Record<string, string> = {};
      if (this.serviceKey) {
        headers["x-service-key"] = this.serviceKey;
      }

      const res = await fetch(`${this.bridgeUrl}/telemetry`, {
        headers,
        signal: AbortSignal.timeout(800),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as GazeboTelemetryPayload;
      if (data && data.isNativeGazeboRunning && data.simulationMode === "REAL_GAZEBO_MODE") {
        const droneIdentifier = this.configuredDroneId || data.droneId;
        if (!droneIdentifier) {
          return;
        }

        const drone = await this.prisma.drone.findFirst({
          where: {
            OR: [
              { id: droneIdentifier },
              { name: droneIdentifier },
              { serialNumber: droneIdentifier },
            ],
          },
        });
        if (!drone) {
          return;
        }

        await this.telemetryService.ingest({
          droneId: drone.id,
          lat: data.latitude,
          lng: data.longitude,
          altitudeMeters: data.altitudeAgl,
          speedMps: (data.speedKmh || 0) / 3.6,
          headingDegrees: data.attitude?.yawDeg ?? 0,
          batteryPercent: Math.round(data.sensors?.battery ?? 100),
          signalStrengthPercent: 98,
        });
      }
    } catch {
      // Bridge is offline or unreachable — non-fatal, fallback simulation continues
    }
  }

  async sendCommand(command: Record<string, unknown>): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.serviceKey) {
        headers["x-service-key"] = this.serviceKey;
      }
      const res = await fetch(`${this.bridgeUrl}/command`, {
        method: "POST",
        headers,
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
