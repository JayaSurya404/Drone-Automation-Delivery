import { buildOffsetDetour, haversineMeters, pathLengthMeters } from "./route-geo.util";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters({ lat: 44.9778, lng: -93.265 }, { lat: 44.9778, lng: -93.265 })).toBe(0);
  });

  it("computes a known real-world distance within a small tolerance", () => {
    // Minneapolis downtown to roughly 1.5km northeast — hand-checked distance.
    const distance = haversineMeters({ lat: 44.9778, lng: -93.265 }, { lat: 44.99, lng: -93.25 });
    expect(distance).toBeGreaterThan(1700);
    expect(distance).toBeLessThan(2100);
  });

  it("is symmetric", () => {
    const a = { lat: 44.9778, lng: -93.265 };
    const b = { lat: 45.01, lng: -93.2 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe("pathLengthMeters", () => {
  it("returns 0 for a single point or empty path", () => {
    expect(pathLengthMeters([])).toBe(0);
    expect(pathLengthMeters([{ lat: 44.9778, lng: -93.265 }])).toBe(0);
  });

  it("sums consecutive segment distances rather than measuring point-to-point endpoints", () => {
    const origin = { lat: 44.9778, lng: -93.265 };
    const midpoint = { lat: 44.99, lng: -93.27 };
    const destination = { lat: 45.0, lng: -93.25 };

    const viaMidpoint = pathLengthMeters([origin, midpoint, destination]);
    const direct = haversineMeters(origin, destination);

    expect(viaMidpoint).toBeGreaterThan(direct);
    expect(viaMidpoint).toBeCloseTo(haversineMeters(origin, midpoint) + haversineMeters(midpoint, destination), 6);
  });
});

describe("buildOffsetDetour", () => {
  const origin = { lat: 44.9778, lng: -93.265 };
  const destination = { lat: 44.99, lng: -93.25 };

  it("returns exactly [origin, midpoint, destination]", () => {
    const detour = buildOffsetDetour(origin, destination, 0.01);
    expect(detour).toHaveLength(3);
    expect(detour[0]).toEqual(origin);
    expect(detour[2]).toEqual(destination);
  });

  it("is deterministic — the same inputs always produce the same midpoint", () => {
    const first = buildOffsetDetour(origin, destination, 0.01);
    const second = buildOffsetDetour(origin, destination, 0.01);
    expect(first).toEqual(second);
  });

  it("shifts the midpoint away from the direct line's own midpoint", () => {
    const detour = buildOffsetDetour(origin, destination, 0.01);
    const directMidpoint = { lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 };
    const midpoint = detour[1]!;
    expect(midpoint).not.toEqual(directMidpoint);
  });

  it("shifts opposite offsets to opposite sides of the direct line", () => {
    const positive = buildOffsetDetour(origin, destination, 0.01)[1]!;
    const negative = buildOffsetDetour(origin, destination, -0.01)[1]!;
    const directMidpoint = { lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 };

    // The two midpoints should be equidistant from, and on opposite sides of, the direct midpoint.
    expect(positive.lat - directMidpoint.lat).toBeCloseTo(-(negative.lat - directMidpoint.lat), 6);
    expect(positive.lng - directMidpoint.lng).toBeCloseTo(-(negative.lng - directMidpoint.lng), 6);
  });

  it("collapses to a zero-length offset when origin and destination coincide, without dividing by zero", () => {
    const detour = buildOffsetDetour(origin, origin, 0.01);
    expect(Number.isFinite(detour[1]!.lat)).toBe(true);
    expect(Number.isFinite(detour[1]!.lng)).toBe(true);
  });
});
