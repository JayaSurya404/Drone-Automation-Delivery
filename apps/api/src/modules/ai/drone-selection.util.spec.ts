import { rankDroneCandidates, scoreDroneCandidate, type DroneCandidateInput } from "./drone-selection.util";

const BASE: DroneCandidateInput = {
  droneId: "drone-1",
  droneName: "Falcon One",
  batteryPercent: 100,
  batteryHealthPercent: 100,
  maxPayloadKg: 5,
  distanceFromOriginMeters: 0,
  droneMaxRangeKm: 10,
  batteryFeasibilityLevel: "SUFFICIENT",
  payloadKg: 1,
};

describe("scoreDroneCandidate", () => {
  it("scores 100 for a maxed-out, already-at-origin candidate", () => {
    const result = scoreDroneCandidate(BASE);
    expect(result.eligible).toBe(true);
    expect(result.score).toBe(100);
  });

  it("is deterministic for identical inputs", () => {
    expect(scoreDroneCandidate(BASE)).toEqual(scoreDroneCandidate(BASE));
  });

  it("marks a drone ineligible (score 0) when the payload exceeds its capacity, regardless of everything else", () => {
    const result = scoreDroneCandidate({ ...BASE, payloadKg: 10, maxPayloadKg: 5 });
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons[0]).toMatch(/exceeds this drone's/);
  });

  it("marks a drone ineligible (score 0) when battery feasibility is INSUFFICIENT, regardless of everything else", () => {
    const result = scoreDroneCandidate({ ...BASE, batteryFeasibilityLevel: "INSUFFICIENT", batteryPercent: 100, batteryHealthPercent: 100 });
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons[0]).toMatch(/Battery reserve is insufficient/);
  });

  it("scores lower battery percent lower", () => {
    const full = scoreDroneCandidate(BASE);
    const half = scoreDroneCandidate({ ...BASE, batteryPercent: 50 });
    expect(half.score).toBeLessThan(full.score);
  });

  it("scores lower battery health lower", () => {
    const healthy = scoreDroneCandidate(BASE);
    const worn = scoreDroneCandidate({ ...BASE, batteryHealthPercent: 50 });
    expect(worn.score).toBeLessThan(healthy.score);
  });

  it("scores a MARGINAL battery feasibility lower than SUFFICIENT", () => {
    const sufficient = scoreDroneCandidate(BASE);
    const marginal = scoreDroneCandidate({ ...BASE, batteryFeasibilityLevel: "MARGINAL" });
    expect(marginal.score).toBeLessThan(sufficient.score);
    expect(marginal.eligible).toBe(true);
  });

  it("scores a drone farther from the mission origin lower than one already there", () => {
    const atOrigin = scoreDroneCandidate(BASE);
    const far = scoreDroneCandidate({ ...BASE, distanceFromOriginMeters: 20_000 });
    expect(far.score).toBeLessThan(atOrigin.score);
  });

  it("scores a tighter payload margin lower than a generous one", () => {
    const generousMargin = scoreDroneCandidate({ ...BASE, payloadKg: 0.5, maxPayloadKg: 5 });
    const tightMargin = scoreDroneCandidate({ ...BASE, payloadKg: 4.5, maxPayloadKg: 5 });
    expect(tightMargin.score).toBeLessThan(generousMargin.score);
  });

  it("never scores below 0 or above 100", () => {
    const result = scoreDroneCandidate({ ...BASE, batteryPercent: 1, batteryHealthPercent: 1, distanceFromOriginMeters: 1_000_000, payloadKg: 4.99, maxPayloadKg: 5 });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("rankDroneCandidates", () => {
  it("sorts candidates by score descending", () => {
    const strong = { ...BASE, droneId: "drone-strong" };
    const weak = { ...BASE, droneId: "drone-weak", batteryPercent: 20, distanceFromOriginMeters: 15_000 };
    const ranked = rankDroneCandidates([weak, strong]);
    expect(ranked.map((r) => r.droneId)).toEqual(["drone-strong", "drone-weak"]);
  });

  it("places ineligible candidates last (score 0) without excluding them from the list", () => {
    const eligible = { ...BASE, droneId: "drone-eligible" };
    const ineligible = { ...BASE, droneId: "drone-ineligible", batteryFeasibilityLevel: "INSUFFICIENT" as const };
    const ranked = rankDroneCandidates([ineligible, eligible]);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.droneId).toBe("drone-eligible");
    expect(ranked[1]!.droneId).toBe("drone-ineligible");
    expect(ranked[1]!.eligible).toBe(false);
  });

  it("returns an empty array for no candidates", () => {
    expect(rankDroneCandidates([])).toEqual([]);
  });
});
