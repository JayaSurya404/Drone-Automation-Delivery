import type {
  RouteCandidate,
  ScoredRouteCandidate,
  DeterministicSafetyGateResult,
  Coordinate,
  AiWeatherConditions
} from "@skynav/contracts";

export interface SafetyGateEvaluationParams {
  candidate: RouteCandidate | ScoredRouteCandidate;
  packageWeightGrams: number;
  droneMaxPayloadGrams: number;
  droneBatteryPercent: number;
  estimatedConsumptionPercent?: number;
  minRequiredReservePercent?: number;
  weather?: AiWeatherConditions;
  maxAllowedWindMps?: number;
  maxLegalAltitudeMeters?: number;
  minLegalAltitudeMeters?: number;
  geofences?: Array<{
    id: string;
    name: string;
    type: "NO_FLY" | "ALTITUDE_RESTRICTION" | "PRIORITY_CORRIDOR";
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }>;
}

export class DeterministicSafetyGate {
  private readonly defaultMinReservePercent = 20.0;
  private readonly defaultMaxAllowedWindMps = 15.0;
  private readonly defaultMaxAltitudeMeters = 120.0;
  private readonly defaultMinAltitudeMeters = 15.0;

  /**
   * Deterministically validates a route candidate against mandatory physical and operational constraints.
   * AI output is advisory; this gate is authoritative.
   */
  public evaluateCandidate(params: SafetyGateEvaluationParams): DeterministicSafetyGateResult {
    const minReserve = params.minRequiredReservePercent ?? selfDefault(params.minRequiredReservePercent, this.defaultMinReservePercent);
    const maxWind = params.maxAllowedWindMps ?? this.defaultMaxAllowedWindMps;
    const maxAlt = params.maxLegalAltitudeMeters ?? this.defaultMaxAltitudeMeters;
    const minAlt = params.minLegalAltitudeMeters ?? this.defaultMinAltitudeMeters;

    const rejectionReasons: string[] = [];

    // 1. Payload Capacity Check
    const payloadPassed = params.packageWeightGrams <= params.droneMaxPayloadGrams;
    const payloadReason = payloadPassed
      ? `Payload (${params.packageWeightGrams}g) within drone limit (${params.droneMaxPayloadGrams}g).`
      : `Payload (${params.packageWeightGrams}g) exceeds maximum drone capacity (${params.droneMaxPayloadGrams}g).`;
    if (!payloadPassed) {
      rejectionReasons.push(payloadReason);
    }

    // 2. Battery Reserve Check
    const estConsumption = params.estimatedConsumptionPercent ?? 15.0;
    const expectedReserve = Math.max(0, params.droneBatteryPercent - estConsumption);
    const batteryPassed = expectedReserve >= minReserve;
    const batteryReason = batteryPassed
      ? `Expected landing reserve (${expectedReserve.toFixed(1)}%) satisfies mandatory policy threshold (>= ${minReserve}%).`
      : `Expected landing reserve (${expectedReserve.toFixed(1)}%) violates mandatory reserve threshold (>= ${minReserve}%).`;
    if (!batteryPassed) {
      rejectionReasons.push(batteryReason);
    }

    // 3. Weather Safety Check
    const windSpeed = params.weather?.windSpeedMps ?? 0;
    const isGustCritical = (params.weather?.windGustMps ?? 0) > 20.0;
    const isPrecipCritical = (params.weather?.precipitationMmPerHour ?? 0) > 10.0;
    const isThunderstorm = Boolean((params.weather as any)?.thunderstormRisk);

    const weatherPassed = windSpeed <= maxWind && !isGustCritical && !isPrecipCritical && !isThunderstorm;
    let weatherReason = `Wind (${windSpeed.toFixed(1)} m/s) within maximum permissible envelope (<= ${maxWind} m/s).`;
    if (!weatherPassed) {
      if (windSpeed > maxWind) weatherReason = `Wind (${windSpeed.toFixed(1)} m/s) exceeds maximum allowed (${maxWind} m/s).`;
      else if (isGustCritical) weatherReason = `Wind gusts exceed airframe structural limit (20 m/s).`;
      else if (isPrecipCritical) weatherReason = `Precipitation exceeds maximum operational envelope (10 mm/h).`;
      else if (isThunderstorm) weatherReason = `Active thunderstorm / convective activity detected in flight sector.`;
      rejectionReasons.push(weatherReason);
    }

    // 4. Altitude Flight Envelope Check
    const cruiseAlt = ("cruiseAltitudeMeters" in params.candidate && typeof (params.candidate as any).cruiseAltitudeMeters === "number" && (params.candidate as any).cruiseAltitudeMeters > 0)
      ? (params.candidate as any).cruiseAltitudeMeters
      : 60.0;
    const altitudePassed = cruiseAlt >= minAlt && cruiseAlt <= maxAlt;
    const altitudeReason = altitudePassed
      ? `Cruise altitude (${cruiseAlt}m) within corridor envelope [${minAlt}m - ${maxAlt}m].`
      : `Cruise altitude (${cruiseAlt}m) outside permissible corridor envelope [${minAlt}m - ${maxAlt}m].`;
    if (!altitudePassed) {
      rejectionReasons.push(altitudeReason);
    }

    // 5. Geofence Boundary Check
    let geofencePassed = true;
    let geofenceReason = "No geofence airspace conflicts detected.";
    if (params.geofences && params.geofences.length > 0) {
      for (const gf of params.geofences) {
        if (gf.type === "NO_FLY") {
          for (const wp of params.candidate.waypoints) {
            if (
              wp.latitude >= gf.minLat &&
              wp.latitude <= gf.maxLat &&
              wp.longitude >= gf.minLon &&
              wp.longitude <= gf.maxLon
            ) {
              geofencePassed = false;
              geofenceReason = `Waypoint (${wp.latitude.toFixed(4)}, ${wp.longitude.toFixed(4)}) intersects prohibited NO_FLY zone '${gf.name}'.`;
              rejectionReasons.push(geofenceReason);
              break;
            }
          }
        }
        if (!geofencePassed) break;
      }
    }

    const overallPassed = payloadPassed && batteryPassed && weatherPassed && altitudePassed && geofencePassed;

    return {
      passed: overallPassed,
      geofenceCheck: { passed: geofencePassed, reason: geofenceReason },
      batteryReserveCheck: {
        passed: batteryPassed,
        expectedReservePercent: Math.round(expectedReserve * 10) / 10,
        minRequiredReservePercent: minReserve,
        reason: batteryReason
      },
      payloadCheck: {
        passed: payloadPassed,
        packageWeightGrams: params.packageWeightGrams,
        maxPayloadGrams: params.droneMaxPayloadGrams,
        reason: payloadReason
      },
      weatherCheck: {
        passed: weatherPassed,
        windSpeedMps: windSpeed,
        maxAllowedWindMps: maxWind,
        reason: weatherReason
      },
      altitudeEnvelopeCheck: {
        passed: altitudePassed,
        cruiseAltitudeMeters: cruiseAlt,
        maxAltitudeMeters: maxAlt,
        reason: altitudeReason
      },
      rejectionReasons
    };
  }
}

function selfDefault<T>(val: T | undefined, fallback: T): T {
  return val !== undefined ? val : fallback;
}
