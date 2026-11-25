import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetryService: TelemetryService,
  ) {
    this.bridgeUrl = process.env.GAZEBO_BRIDGE_URL || "http://127.0.0.1:8085";
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") {
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
    try {
      const res = await fetch(`${this.bridgeUrl}/telemetry`, {
        signal: AbortSignal.timeout(800),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as GazeboTelemetryPayload;
      if (data && data.isNativeGazeboRunning && data.simulationMode === "REAL_GAZEBO_MODE") {
        // Resolve target drone (default to D-001 or serial SKN-DRN-001)
        const drone = await this.prisma.drone.findFirst({
          where: {
            OR: [
              { name: "D-001" },
              { serialNumber: "SKN-DRN-001" },
              { serialNumber: data.droneId || "" },
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
    try {
      const res = await fetch(`${this.bridgeUrl}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
