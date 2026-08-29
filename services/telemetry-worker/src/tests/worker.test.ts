import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TelemetryWorker } from "../worker.js";
import type { Telemetry } from "@skynav/contracts";

const validTelemetry: Telemetry = {
  version: "v1",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  droneId: "11111111-1111-1111-1111-111111111111",
  observedAt: new Date(Date.now() - 1000).toISOString(),
  position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 60 },
  speedMetersPerSecond: 15,
  headingDegrees: 180,
  batteryPercent: 95,
  state: "EN_ROUTE"
};

describe("Telemetry Worker / Processing, Validation & Ordering", () => {
  it("processes valid incoming Redis telemetry frames", () => {
    const received: Array<{ channel: string; telemetry: Telemetry }> = [];
    const mockRedis: any = {
      on() {}
    };

    const worker = new TelemetryWorker({
      redisSubscriber: mockRedis,
      onTelemetry: (channel, telemetry) => {
        received.push({ channel, telemetry });
      }
    });

    const channel = "telemetry:org:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const result = worker.handleIncomingMessage(channel, JSON.stringify(validTelemetry));

    assert.ok(result);
    assert.equal(result.droneId, validTelemetry.droneId);
    assert.equal(received.length, 1);
    assert.equal(received[0].channel, channel);
    assert.equal(worker.metrics.messagesValid, 1);
    assert.equal(worker.metrics.messagesInvalid, 0);
  });

  it("handles malformed JSON or schema violations safely without crashing", () => {
    let errorCaught = false;
    const mockRedis: any = { on() {} };

    const worker = new TelemetryWorker({
      redisSubscriber: mockRedis,
      onError: () => {
        errorCaught = true;
      }
    });

    // 1. Invalid JSON
    const res1 = worker.handleIncomingMessage("telemetry:test", "NOT_VALID_JSON{");
    assert.equal(res1, null);
    assert.equal(worker.metrics.messagesInvalid, 1);
    assert.equal(errorCaught, true);

    // 2. Schema violation
    const res2 = worker.handleIncomingMessage("telemetry:test", JSON.stringify({ version: "v1", foo: "bar" }));
    assert.equal(res2, null);
    assert.equal(worker.metrics.messagesInvalid, 2);
  });

  it("tracks drone timestamp and detects out-of-order / stale frames", () => {
    const mockRedis: any = { on() {} };
    const worker = new TelemetryWorker({ redisSubscriber: mockRedis });

    const time1 = new Date(2026, 0, 1, 12, 0, 10).toISOString();
    const time2 = new Date(2026, 0, 1, 12, 0, 20).toISOString();
    const timeOld = new Date(2026, 0, 1, 12, 0, 5).toISOString();

    // First frame (t1 = 12:00:10)
    worker.handleIncomingMessage("test", JSON.stringify({ ...validTelemetry, observedAt: time1 }));
    assert.equal(worker.getLastObservedTimestamp(validTelemetry.droneId), time1);
    assert.equal(worker.metrics.messagesOutOfOrder, 0);

    // Second newer frame (t2 = 12:00:20)
    worker.handleIncomingMessage("test", JSON.stringify({ ...validTelemetry, observedAt: time2 }));
    assert.equal(worker.getLastObservedTimestamp(validTelemetry.droneId), time2);
    assert.equal(worker.metrics.messagesOutOfOrder, 0);

    // Third older frame arrives late (tOld = 12:00:05)
    worker.handleIncomingMessage("test", JSON.stringify({ ...validTelemetry, observedAt: timeOld }));
    // Last observed remains time2
    assert.equal(worker.getLastObservedTimestamp(validTelemetry.droneId), time2);
    assert.equal(worker.metrics.messagesOutOfOrder, 1);
  });
});
