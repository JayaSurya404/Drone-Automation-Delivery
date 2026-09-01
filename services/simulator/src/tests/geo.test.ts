import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  haversineDistanceMeters,
  distance3DMeters,
  initialBearingDegrees,
  projectPosition,
  interpolateCoordinate
} from "../geo.js";
import type { GeoCoordinate } from "../types.js";

describe("Simulator / Geospatial Math", () => {
  const warehouse: GeoCoordinate = { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 };
  // Point ~111 meters directly North (0.001 deg latitude ≈ 111.2m)
  const northPoint: GeoCoordinate = { latitude: 37.7759, longitude: -122.4194, altitudeMeters: 0 };
  // Point ~88 meters directly East (0.001 deg longitude at lat 37.77 ≈ 88m)
  const eastPoint: GeoCoordinate = { latitude: 37.7749, longitude: -122.4184, altitudeMeters: 0 };

  it("calculates haversine distance accurately", () => {
    const distNorth = haversineDistanceMeters(warehouse, northPoint);
    assert.ok(distNorth > 110 && distNorth < 112, `Expected ~111m, got ${distNorth}`);

    const distEast = haversineDistanceMeters(warehouse, eastPoint);
    assert.ok(distEast > 87 && distEast < 89, `Expected ~88m, got ${distEast}`);

    const zeroDist = haversineDistanceMeters(warehouse, warehouse);
    assert.equal(zeroDist, 0);
  });

  it("calculates 3D distance with altitude delta", () => {
    const p1: GeoCoordinate = { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 };
    const p2: GeoCoordinate = { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 50 };

    const dist = distance3DMeters(p1, p2);
    assert.equal(Math.round(dist), 50);
  });

  it("computes initial cardinal bearings accurately", () => {
    const bearingNorth = initialBearingDegrees(warehouse, northPoint);
    assert.ok(Math.abs(bearingNorth - 0) < 0.5 || Math.abs(bearingNorth - 360) < 0.5, `Bearing North expected ~0, got ${bearingNorth}`);

    const bearingEast = initialBearingDegrees(warehouse, eastPoint);
    assert.ok(Math.abs(bearingEast - 90) < 0.5, `Bearing East expected ~90, got ${bearingEast}`);
  });

  it("projects new position along bearing and distance", () => {
    const distanceMeters = 500;
    const projectedNorth = projectPosition(warehouse, 0, distanceMeters);

    assert.ok(projectedNorth.latitude > warehouse.latitude);
    assert.ok(Math.abs(projectedNorth.longitude - warehouse.longitude) < 0.00001);

    const actualDist = haversineDistanceMeters(warehouse, projectedNorth);
    assert.ok(Math.abs(actualDist - distanceMeters) < 0.1, `Projected distance deviation: ${actualDist - distanceMeters}`);
  });

  it("interpolates coordinate along 3D path", () => {
    const start: GeoCoordinate = { latitude: 10, longitude: 20, altitudeMeters: 0 };
    const end: GeoCoordinate = { latitude: 20, longitude: 40, altitudeMeters: 100 };

    const mid = interpolateCoordinate(start, end, 0.5);
    assert.equal(mid.latitude, 15);
    assert.equal(mid.longitude, 30);
    assert.equal(mid.altitudeMeters, 50);
  });
});
