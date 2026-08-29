import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RedisTelemetryPublisher, InMemoryTelemetryPublisher } from "../publisher.js";
import type { Telemetry } from "@skynav/contracts";

const sampleTelemetry: Telemetry = {
  version: "v1",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  droneId: "11111111-1111-1111-1111-111111111111",
  missionId: "22222222-2222-2222-2222-222222222222",
  observedAt: new Date().toISOString(),
  position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 60 },
  speedMetersPerSecond: 15,
  headingDegrees: 180,
  batteryPercent: 95,
  state: "EN_ROUTE"
};

describe("Telemetry Publisher / Redis & In-Memory Transport", () => {
  it("publishes telemetry with In-Memory publisher to subscribers", async () => {
    const publisher = new InMemoryTelemetryPublisher();
    const received: Telemetry[] = [];

    const unsubscribe = publisher.subscribe((t) => received.push(t));
    await publisher.publish(sampleTelemetry);

    assert.equal(received.length, 1);
    assert.equal(received[0].droneId, sampleTelemetry.droneId);
    assert.equal(received[0].organizationId, sampleTelemetry.organizationId);

    unsubscribe();
    await publisher.publish(sampleTelemetry);
    assert.equal(received.length, 1); // Unsubscribed
  });

  it("publishes to tenant-scoped channels in Redis publisher", async () => {
    const publishedCommands: Array<{ channel: string; message: string }> = [];

    const mockRedis: any = {
      pipeline() {
        const commands: Array<{ channel: string; message: string }> = [];
        return {
          publish(channel: string, message: string) {
            commands.push({ channel, message });
            return this;
          },
          async exec() {
            publishedCommands.push(...commands);
            return commands.map(() => [null, 1]);
          }
        };
      },
      on() {}
    };

    const publisher = new RedisTelemetryPublisher({ redisClient: mockRedis });
    await publisher.publish(sampleTelemetry);

    assert.equal(publishedCommands.length, 2);
    assert.equal(publishedCommands[0].channel, `telemetry:org:${sampleTelemetry.organizationId}`);
    assert.equal(
      publishedCommands[1].channel,
      `telemetry:drone:${sampleTelemetry.organizationId}:${sampleTelemetry.droneId}`
    );

    const parsedBody = JSON.parse(publishedCommands[0].message);
    assert.equal(parsedBody.droneId, sampleTelemetry.droneId);
    assert.equal(parsedBody.batteryPercent, 95);
  });

  it("handles malformed telemetry safely without crashing the publisher", async () => {
    let capturedError: Error | null = null;
    const publisher = new RedisTelemetryPublisher({
      redisClient: {} as any,
      onError: (err) => {
        capturedError = err;
      }
    });

    const malformed = {
      version: "v1",
      organizationId: "not-a-uuid",
      droneId: "not-a-uuid"
    } as any;

    await publisher.publish(malformed);
    assert.ok(capturedError);
  });
});
