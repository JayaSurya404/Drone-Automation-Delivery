import { buildStraightLineRoute, resolveDeterministicDestination } from "./route.util";

describe("route.util", () => {
  describe("buildStraightLineRoute", () => {
    it("produces 3 waypoints ending exactly at the destination", () => {
      const origin = { lat: 44.9778, lng: -93.265 };
      const destination = { lat: 45.0, lng: -93.25 };

      const route = buildStraightLineRoute(origin, destination);

      expect(route).toHaveLength(3);
      expect(route[2]).toMatchObject({ lat: destination.lat, lng: destination.lng });
    });

    it("moves monotonically closer to the destination with each waypoint", () => {
      const origin = { lat: 44.9778, lng: -93.265 };
      const destination = { lat: 45.05, lng: -93.2 };
      const route = buildStraightLineRoute(origin, destination);

      const distances = route.map((point) => Math.hypot(destination.lat - point.lat, destination.lng - point.lng));
      const [first, second, third] = distances;
      expect(first).toBeGreaterThan(second!);
      expect(second).toBeGreaterThan(third!);
      expect(third).toBe(0);
    });
  });

  describe("resolveDeterministicDestination", () => {
    it("is deterministic for the same delivery id", () => {
      const origin = { lat: 44.9778, lng: -93.265 };
      const first = resolveDeterministicDestination("delivery-1", origin);
      const second = resolveDeterministicDestination("delivery-1", origin);
      expect(first).toEqual(second);
    });

    it("resolves different delivery ids to different points", () => {
      const origin = { lat: 44.9778, lng: -93.265 };
      const a = resolveDeterministicDestination("delivery-1", origin);
      const b = resolveDeterministicDestination("delivery-2", origin);
      expect(a).not.toEqual(b);
    });

    it("stays within a small bounded offset of the origin", () => {
      const origin = { lat: 44.9778, lng: -93.265 };
      const destination = resolveDeterministicDestination("delivery-1", origin);
      expect(Math.abs(destination.lat - origin.lat)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(destination.lng - origin.lng)).toBeLessThanOrEqual(0.02);
    });
  });
});
