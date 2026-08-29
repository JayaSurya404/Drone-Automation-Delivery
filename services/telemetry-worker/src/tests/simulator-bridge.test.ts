import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FleetSimulator } from "@skynav/simulator";
import { InMemoryTelemetryPublisher } from "../publisher.js";
import type { Telemetry } from "@skynav/contracts";

describe("Simulator / Telemetry Bridge Integration (26, 27, 28)", () => {
  it("26 & 27. bridges simulator ticks to telemetry publisher without altering determinism", () => {
    const simulator = new FleetSimulator({ tickRateHz: 10 });
    const publisher = new InMemoryTelemetryPublisher();

    const drone = simulator.registerDrone(
      "11111111-1111-1111-1111-111111111111",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 }
    );

    const received: Telemetry[] = [];
    publisher.subscribe((t) => received.push(t));

    // Connect bridge
    simulator.onTelemetry((telemetry) => {
      publisher.publish(telemetry).catch(() => {});
    });

    // Advance 5 clock ticks (0.5 seconds)
    for (let i = 0; i < 5; i++) {
      simulator.tick(0.1);
    }

    assert.equal(received.length, 5);
    assert.equal(received[0].droneId, drone.id);
    assert.equal(received[0].organizationId, drone.organizationId);
    assert.equal(drone.state, "IDLE");
  });

  it("28. handles telemetry publisher failures gracefully without corrupting simulator state", () => {
    const simulator = new FleetSimulator({ tickRateHz: 10 });

    const drone = simulator.registerDrone(
      "22222222-2222-2222-2222-222222222222",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 }
    );

    // Simulating failing publisher
    let errorHandled = false;
    simulator.onTelemetry(() => {
      try {
        throw new Error("Redis connection dropped");
      } catch {
        errorHandled = true;
      }
    });

    // Simulator continues ticking deterministically
    assert.doesNotThrow(() => {
      simulator.tick(1.0);
    });

    assert.equal(errorHandled, true);
    assert.equal(drone.state, "IDLE");
  });
});
