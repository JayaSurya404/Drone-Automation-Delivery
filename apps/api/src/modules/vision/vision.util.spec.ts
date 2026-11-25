import {
  bestLandingZoneCandidate,
  deterministicUnit,
  frameSeed,
  hasHumanDetection,
  isObstructed,
  synthesizeDetections,
  synthesizeLandingZoneCandidates,
} from "./vision.util";

describe("deterministicUnit", () => {
  it("is deterministic for the same seed", () => {
    expect(deterministicUnit("a")).toBe(deterministicUnit("a"));
  });

  it("differs for different seeds", () => {
    expect(deterministicUnit("a")).not.toBe(deterministicUnit("b"));
  });

  it("is always in [0, 1)", () => {
    for (const seed of ["x", "y", "z", "drone-1:1.2345:3.4567:30"]) {
      const value = deterministicUnit(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("frameSeed", () => {
  it("is stable for the same inputs", () => {
    expect(frameSeed("drone-1", 1.23456, 3.45678, 30)).toBe(frameSeed("drone-1", 1.23456, 3.45678, 30));
  });

  it("changes when any input changes", () => {
    const base = frameSeed("drone-1", 1.23456, 3.45678, 30);
    expect(frameSeed("drone-2", 1.23456, 3.45678, 30)).not.toBe(base);
    expect(frameSeed("drone-1", 1.9999, 3.45678, 30)).not.toBe(base);
    expect(frameSeed("drone-1", 1.23456, 3.45678, 60)).not.toBe(base);
  });
});

describe("synthesizeDetections", () => {
  it("produces the same detections for the same seed", () => {
    const seed = frameSeed("drone-1", 12.9, 77.5, 30);
    expect(synthesizeDetections(seed)).toEqual(synthesizeDetections(seed));
  });

  it("produces at most 3 detections, each with a valid confidence and bounding box", () => {
    const seed = frameSeed("drone-1", 12.9, 77.5, 30);
    const detections = synthesizeDetections(seed);
    expect(detections.length).toBeLessThanOrEqual(3);
    for (const detection of detections) {
      expect(detection.confidence).toBeGreaterThanOrEqual(0.55);
      expect(detection.confidence).toBeLessThanOrEqual(0.99);
      expect(detection.boundingBox.xMax).toBeGreaterThan(detection.boundingBox.xMin);
      expect(detection.boundingBox.yMax).toBeGreaterThan(detection.boundingBox.yMin);
      expect(detection.boundingBox.xMax).toBeLessThanOrEqual(1);
      expect(detection.boundingBox.yMax).toBeLessThanOrEqual(1);
    }
  });

  it("can produce zero detections for a seed whose every slot rolls above the presence threshold", () => {
    // Search a small deterministic space for a seed with no detections, proving "no objects" is a reachable, honest outcome rather than something the function can never return.
    let foundEmpty = false;
    for (let i = 0; i < 200; i += 1) {
      const seed = frameSeed(`search-${i}`, 0, 0, 30);
      if (synthesizeDetections(seed).length === 0) {
        foundEmpty = true;
        break;
      }
    }
    expect(foundEmpty).toBe(true);
  });
});

describe("synthesizeLandingZoneCandidates", () => {
  it("produces between 1 and 3 candidates near the requested center", () => {
    const seed = frameSeed("drone-1", 12.9, 77.5, 30);
    const candidates = synthesizeLandingZoneCandidates(seed, 12.9, 77.5);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.length).toBeLessThanOrEqual(3);
    for (const candidate of candidates) {
      expect(Math.abs(candidate.lat - 12.9)).toBeLessThan(0.001);
      expect(Math.abs(candidate.lng - 77.5)).toBeLessThan(0.001);
      expect(candidate.radiusMeters).toBeGreaterThanOrEqual(3);
      expect(candidate.clearanceScore).toBeGreaterThanOrEqual(0);
      expect(candidate.clearanceScore).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic for the same seed and center", () => {
    const seed = frameSeed("drone-1", 12.9, 77.5, 30);
    expect(synthesizeLandingZoneCandidates(seed, 12.9, 77.5)).toEqual(synthesizeLandingZoneCandidates(seed, 12.9, 77.5));
  });
});

describe("isObstructed / hasHumanDetection", () => {
  it("flags an obstruction only for OBSTACLE/STRUCTURE/VEGETATION at or above 0.6 confidence", () => {
    expect(isObstructed([{ class: "OBSTACLE", confidence: 0.6, boundingBox: { xMin: 0, yMin: 0, xMax: 1, yMax: 1 } }])).toBe(true);
    expect(isObstructed([{ class: "OBSTACLE", confidence: 0.59, boundingBox: { xMin: 0, yMin: 0, xMax: 1, yMax: 1 } }])).toBe(false);
    expect(isObstructed([{ class: "PERSON", confidence: 0.9, boundingBox: { xMin: 0, yMin: 0, xMax: 1, yMax: 1 } }])).toBe(false);
  });

  it("flags a human detection only for the PERSON class", () => {
    expect(hasHumanDetection([{ class: "PERSON", confidence: 0.6, boundingBox: { xMin: 0, yMin: 0, xMax: 1, yMax: 1 } }])).toBe(true);
    expect(hasHumanDetection([{ class: "ANIMAL", confidence: 0.99, boundingBox: { xMin: 0, yMin: 0, xMax: 1, yMax: 1 } }])).toBe(false);
    expect(hasHumanDetection([])).toBe(false);
  });
});

describe("bestLandingZoneCandidate", () => {
  it("returns null for an empty list", () => {
    expect(bestLandingZoneCandidate([])).toBeNull();
  });

  it("returns the highest-clearance candidate", () => {
    const candidates = [
      { lat: 0, lng: 0, radiusMeters: 5, clearanceScore: 40 },
      { lat: 0, lng: 0, radiusMeters: 5, clearanceScore: 90 },
      { lat: 0, lng: 0, radiusMeters: 5, clearanceScore: 60 },
    ];
    expect(bestLandingZoneCandidate(candidates)?.clearanceScore).toBe(90);
  });
});
