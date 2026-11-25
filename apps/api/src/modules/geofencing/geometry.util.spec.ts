import { buildCircleApproxPolygon, buildLineStringWkt, buildPolygonWkt, parsePolygonWkt } from "./geometry.util";

describe("buildPolygonWkt", () => {
  it("closes the ring by repeating the first point", () => {
    const wkt = buildPolygonWkt([
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { lat: 5, lng: 6 },
    ]);
    expect(wkt).toBe("POLYGON((2 1, 4 3, 6 5, 2 1))");
  });

  it("rejects fewer than 3 points", () => {
    expect(() => buildPolygonWkt([{ lat: 1, lng: 2 }])).toThrow(/at least 3/);
  });
});

describe("buildLineStringWkt", () => {
  it("builds an open line", () => {
    const wkt = buildLineStringWkt([
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
    ]);
    expect(wkt).toBe("LINESTRING(2 1, 4 3)");
  });

  it("rejects fewer than 2 points", () => {
    expect(() => buildLineStringWkt([{ lat: 1, lng: 2 }])).toThrow(/at least 2/);
  });
});

describe("buildCircleApproxPolygon", () => {
  it("produces the requested number of points, all roughly radiusMeters from the center", () => {
    const center = { lat: 44.9778, lng: -93.265 };
    const radiusMeters = 500;
    const points = buildCircleApproxPolygon(center, radiusMeters, 16);

    expect(points).toHaveLength(16);
    for (const point of points) {
      const dLat = (point.lat - center.lat) * 111_320;
      const dLng = (point.lng - center.lng) * 111_320 * Math.cos((center.lat * Math.PI) / 180);
      const distance = Math.hypot(dLat, dLng);
      expect(distance).toBeGreaterThan(radiusMeters * 0.95);
      expect(distance).toBeLessThan(radiusMeters * 1.05);
    }
  });
});

describe("parsePolygonWkt", () => {
  it("round-trips through buildPolygonWkt, dropping the closing duplicate point", () => {
    const original = [
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { lat: 5, lng: 6 },
    ];
    const parsed = parsePolygonWkt(buildPolygonWkt(original));
    expect(parsed).toEqual(original);
  });

  it("parses real ST_AsText-shaped output", () => {
    const parsed = parsePolygonWkt("POLYGON((-93.27 44.97,-93.26 44.97,-93.26 44.98,-93.27 44.98,-93.27 44.97))");
    expect(parsed).toEqual([
      { lat: 44.97, lng: -93.27 },
      { lat: 44.97, lng: -93.26 },
      { lat: 44.98, lng: -93.26 },
      { lat: 44.98, lng: -93.27 },
    ]);
  });

  it("throws on unrecognized input", () => {
    expect(() => parsePolygonWkt("POINT(1 2)")).toThrow(/Unrecognized/);
  });
});
