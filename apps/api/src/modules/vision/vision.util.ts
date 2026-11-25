import { createHash } from "node:crypto";
import type { DetectedObject, LandingZoneCandidate, VisionDetectionClass } from "./interfaces/computer-vision-adapter.interface";

const DETECTION_CLASSES: VisionDetectionClass[] = ["PERSON", "VEHICLE", "ANIMAL", "OBSTACLE", "STRUCTURE", "VEGETATION", "OPEN_GROUND"];
const MAX_DETECTION_SLOTS = 3;
const MAX_LANDING_CANDIDATES = 3;
/** A slot's presence-roll below this threshold produces a detection — tuned so a typical frame has 0-2 objects, not one in every slot every time. */
const DETECTION_PRESENCE_THRESHOLD = 0.55;

/** Deterministic pseudo-random value in [0, 1), seeded from `seed` alone — never `Math.random()`/wall-clock time, so the same seed always produces the same value (the same `resolveDeterministicDestination()` hash-seeding convention `route.util.ts` established in Phase 6). */
export function deterministicUnit(seed: string): number {
  const hash = createHash("sha256").update(seed).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

/** The one seed every synthetic frame is derived from — drone id + position + altitude, deliberately excluding wall-clock time so repeated analysis of the same frame is reproducible in a test. */
export function frameSeed(droneId: string, lat: number, lng: number, altitudeMeters: number): string {
  return `${droneId}:${lat.toFixed(4)}:${lng.toFixed(4)}:${altitudeMeters.toFixed(0)}`;
}

export function synthesizeDetections(seed: string): DetectedObject[] {
  const detections: DetectedObject[] = [];
  for (let slot = 0; slot < MAX_DETECTION_SLOTS; slot += 1) {
    const presenceRoll = deterministicUnit(`${seed}:slot${slot}:presence`);
    if (presenceRoll >= DETECTION_PRESENCE_THRESHOLD) {
      continue;
    }
    const classRoll = deterministicUnit(`${seed}:slot${slot}:class`);
    const classIndex = Math.min(DETECTION_CLASSES.length - 1, Math.floor(classRoll * DETECTION_CLASSES.length));
    const detectedClass = DETECTION_CLASSES[classIndex] as VisionDetectionClass;
    const confidence = Math.round((0.55 + deterministicUnit(`${seed}:slot${slot}:confidence`) * 0.44) * 100) / 100;
    const xMin = Math.round(deterministicUnit(`${seed}:slot${slot}:x`) * 0.7 * 100) / 100;
    const yMin = Math.round(deterministicUnit(`${seed}:slot${slot}:y`) * 0.7 * 100) / 100;
    const width = Math.round((0.1 + deterministicUnit(`${seed}:slot${slot}:w`) * 0.2) * 100) / 100;
    const height = Math.round((0.1 + deterministicUnit(`${seed}:slot${slot}:h`) * 0.2) * 100) / 100;
    detections.push({
      class: detectedClass,
      confidence,
      boundingBox: {
        xMin,
        yMin,
        xMax: Math.min(1, Math.round((xMin + width) * 100) / 100),
        yMax: Math.min(1, Math.round((yMin + height) * 100) / 100),
      },
    });
  }
  return detections;
}

export function synthesizeLandingZoneCandidates(seed: string, centerLat: number, centerLng: number): LandingZoneCandidate[] {
  const candidates: LandingZoneCandidate[] = [];
  const count = 1 + Math.floor(deterministicUnit(`${seed}:candidateCount`) * MAX_LANDING_CANDIDATES);
  for (let i = 0; i < count; i += 1) {
    const latJitter = (deterministicUnit(`${seed}:cand${i}:lat`) - 0.5) * 0.0004;
    const lngJitter = (deterministicUnit(`${seed}:cand${i}:lng`) - 0.5) * 0.0004;
    const radiusMeters = Math.round(3 + deterministicUnit(`${seed}:cand${i}:radius`) * 7);
    const clearanceScore = Math.round(deterministicUnit(`${seed}:cand${i}:clearance`) * 100);
    candidates.push({ lat: centerLat + latJitter, lng: centerLng + lngJitter, radiusMeters, clearanceScore });
  }
  return candidates;
}

export function isObstructed(detections: DetectedObject[]): boolean {
  return detections.some((d) => (d.class === "OBSTACLE" || d.class === "STRUCTURE" || d.class === "VEGETATION") && d.confidence >= 0.6);
}

export function hasHumanDetection(detections: DetectedObject[]): boolean {
  return detections.some((d) => d.class === "PERSON");
}

/** Highest-clearance candidate, or `null` when the (simulated) frame yielded none — callers must handle "no candidate" as a real, honest outcome, never default to a fabricated one. */
export function bestLandingZoneCandidate(candidates: LandingZoneCandidate[]): LandingZoneCandidate | null {
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((best, candidate) => (candidate.clearanceScore > best.clearanceScore ? candidate : best));
}
