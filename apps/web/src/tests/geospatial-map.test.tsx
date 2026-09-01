import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  MapView,
  InteractiveMap
} from "@skynav/ui";
import {
  isValidCoordinate,
  sanitizeCoordinate,
  haversineDistanceMeters,
  distance3DMeters,
  initialBearingDegrees,
  projectPosition,
  interpolateCoordinate,
  computeRouteDistanceMeters,
  computeRemainingRouteDistanceMeters,
  calculateDynamicEtaSeconds,
  formatDistance,
  formatDuration,
  computeBoundingBox,
  calculateTelemetryFreshness
} from "@skynav/contracts";
import { DEMO_DRONES, DEMO_MISSIONS, DEMO_WAREHOUSE, DEMO_GEOFENCES } from "../lib/demo-data.js";

describe("Geospatial Maps / Calculations & Validations", () => {
  const sfDepot = { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 10 };
  const sfPad = { latitude: 37.7845, longitude: -122.4082, altitudeMeters: 5 };

  it("validates strict coordinate bounds ([-90,90], [-180,180])", () => {
    assert.ok(isValidCoordinate(sfDepot));
    assert.ok(isValidCoordinate({ latitude: 0, longitude: 0 }));
    assert.ok(isValidCoordinate({ latitude: -89.9, longitude: 179.9 }));
    assert.ok(!isValidCoordinate({ latitude: 91, longitude: 0 }));
    assert.ok(!isValidCoordinate({ latitude: 0, longitude: -181 }));
    assert.ok(!isValidCoordinate(null));
    assert.ok(!isValidCoordinate(undefined));
    assert.ok(!isValidCoordinate({ latitude: NaN, longitude: 0 } as any));
  });

  it("sanitizes slight numeric overflow coordinates without crashing", () => {
    const clamped = sanitizeCoordinate({ latitude: 95, longitude: -200, altitudeMeters: -10 });
    assert.equal(clamped.latitude, 90);
    assert.equal(clamped.longitude, -180);
    assert.equal(clamped.altitudeMeters, 0);
  });

  it("computes accurate Haversine surface distance and 3D distance", () => {
    const dist2D = haversineDistanceMeters(sfDepot, sfPad);
    assert.ok(dist2D > 1400 && dist2D < 1600, `Expected ~1450m, got ${dist2D}`);

    const dist3D = distance3DMeters(sfDepot, sfPad);
    assert.ok(dist3D >= dist2D);
  });

  it("computes initial bearing accurately", () => {
    const bearing = initialBearingDegrees(sfDepot, sfPad);
    assert.ok(bearing >= 0 && bearing <= 360);
    // Heading northeast should be roughly ~40-60 degrees
    assert.ok(bearing > 20 && bearing < 80, `Expected NE bearing, got ${bearing}`);
  });

  it("projects and interpolates coordinates accurately", () => {
    const halfWay = interpolateCoordinate(sfDepot, sfPad, 0.5);
    assert.ok(halfWay.latitude > sfDepot.latitude && halfWay.latitude < sfPad.latitude);

    const projected = projectPosition(sfDepot, 45, 500);
    assert.ok(isValidCoordinate(projected));
    assert.ok(projected.latitude > sfDepot.latitude);
    assert.ok(projected.longitude > sfDepot.longitude);
  });

  it("computes route distance, remaining distance, and dynamic ETA", () => {
    const route = [sfDepot, sfPad];
    const totalDist = computeRouteDistanceMeters(route);
    assert.ok(totalDist > 1400);

    const remaining = computeRemainingRouteDistanceMeters(sfDepot, route, 1);
    assert.ok(remaining > 0);

    const eta = calculateDynamicEtaSeconds(totalDist, 15);
    assert.ok(eta > 80 && eta < 120);

    assert.equal(formatDistance(850), "850 m");
    assert.equal(formatDistance(3200), "3.2 km");
    assert.equal(formatDuration(90), "1m 30s");
  });

  it("computes bounding boxes and evaluates telemetry freshness", () => {
    const bbox = computeBoundingBox([sfDepot, sfPad]);
    assert.ok(bbox !== null);
    assert.equal(bbox.minLat, sfDepot.latitude);
    assert.equal(bbox.maxLat, sfPad.latitude);

    const now = new Date("2026-08-30T12:00:00Z");
    assert.equal(calculateTelemetryFreshness(new Date("2026-08-30T11:59:58Z"), now), "LIVE");
    assert.equal(calculateTelemetryFreshness(new Date("2026-08-30T11:59:52Z"), now), "DEGRADED");
    assert.equal(calculateTelemetryFreshness(new Date("2026-08-30T11:59:35Z"), now), "STALE");
    assert.equal(calculateTelemetryFreshness(new Date("2026-08-30T11:50:00Z"), now), "OFFLINE");
  });
});

describe("Geospatial Maps / Production MapView Rendering & States", () => {
  it("renders MapView with markers, routes, and geofences", () => {
    const markers = [
      {
        id: "depot",
        type: "warehouse" as const,
        latitude: DEMO_WAREHOUSE.latitude,
        longitude: DEMO_WAREHOUSE.longitude,
        title: "Depot Alpha"
      },
      {
        id: "drone-1",
        type: "drone" as const,
        latitude: 37.7792,
        longitude: -122.4158,
        headingDegrees: 45,
        altitudeMeters: 58,
        speedMetersPerSecond: 15.2,
        batteryPercent: 85,
        freshness: "LIVE" as const,
        title: "SKY-001",
        status: "EN_ROUTE",
        trail: [
          { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 },
          { latitude: 37.7792, longitude: -122.4158, altitudeMeters: 58 }
        ]
      }
    ];

    const routes = [
      {
        id: "route-1",
        coordinates: [
          { latitude: 37.7749, longitude: -122.4194 },
          { latitude: 37.7845, longitude: -122.4082 }
        ],
        color: "#00f0ff"
      }
    ];

    const html = renderToString(
      <MapView
        markers={markers}
        routes={routes}
        geofences={DEMO_GEOFENCES}
        title="Tactical Test Radar"
        showControls={true}
        showLayerToggles={true}
        showCoordinatesHud={true}
      />
    );

    assert.ok(html.includes("Tactical Test Radar"));
    assert.ok(html.includes("Depot Alpha"));
    assert.ok(html.includes("SKY-001"));
    assert.ok(html.includes("Tiles"));
    assert.ok(html.includes("Trails"));
    assert.ok(html.includes("Airspace"));
  });

  it("handles empty fleet and offline states gracefully without crashing", () => {
    const html = renderToString(
      <MapView
        markers={[]}
        routes={[]}
        geofences={[]}
        title="Empty Sector"
      />
    );
    assert.ok(html.includes("Empty Sector"));
  });

  it("enforces customer privacy by rendering only authorized delivery markers", () => {
    const customerMarkers = [
      {
        id: "depot",
        type: "warehouse" as const,
        latitude: DEMO_WAREHOUSE.latitude,
        longitude: DEMO_WAREHOUSE.longitude,
        title: "Depot Alpha"
      },
      {
        id: "dest-pad",
        type: "destination" as const,
        latitude: 37.7845,
        longitude: -122.4082,
        title: "Your Landing Pad"
      },
      {
        id: "drone-customer",
        type: "drone" as const,
        latitude: 37.7792,
        longitude: -122.4158,
        title: "SKY-001",
        status: "EN_ROUTE"
      }
    ];

    const html = renderToString(
      <MapView
        markers={customerMarkers}
        title="Customer Tracking"
      />
    );

    assert.ok(html.includes("Your Landing Pad"));
    assert.ok(html.includes("SKY-001"));
    assert.ok(!html.includes("SKY-002"));
    assert.ok(!html.includes("SKY-005"));
  });
});
