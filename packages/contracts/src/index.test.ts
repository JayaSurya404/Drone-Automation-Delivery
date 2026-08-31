import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  registerRequestSchema,
  loginRequestSchema,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  roleHasPermission,
  problemDetailsSchema,
  createOrderRequestSchema,
  updateOrderStatusRequestSchema,
  cancelOrderRequestSchema,
  orderResponseSchema,
  createDroneRequestSchema,
  updateDroneRequestSchema,
  createMissionRequestSchema,
  assignMissionRequestSchema,
  updateMissionStatusRequestSchema,
  telemetrySchema,
  wsClientMessageSchema,
  wsServerMessageSchema,
  domainEventEnvelopeSchema,
  notificationResponseSchema,
  notificationListQuerySchema,
  isValidCoordinate,
  haversineDistanceMeters,
  distance3DMeters,
  initialBearingDegrees,
  interpolateCoordinate,
  projectPosition,
  computeRouteDistanceMeters,
  computeRemainingRouteDistanceMeters,
  calculateDynamicEtaSeconds,
  formatDistance,
  formatDuration,
  computeBoundingBox,
  calculateTelemetryFreshness,
  aiRouteScoringRequestSchema,
  aiRouteScoringResponseSchema,
  aiEtaPredictionRequestSchema,
  aiBatteryPredictionRequestSchema,
  aiMaintenancePredictionRequestSchema,
  aiDemandForecastRequestSchema,
  deterministicSafetyGateResultSchema,
  missionPlanEvaluationResponseSchema
} from "./index.js";

describe("Contracts / Authentication & RBAC Schemas", () => {
  it("validates valid registration request", () => {
    const valid = {
      email: "operator@skynav.test",
      password: "StrongPassword123!",
      name: "John Operator",
      organizationName: "SkyNav West"
    };
    const parsed = registerRequestSchema.parse(valid);
    assert.equal(parsed.email, "operator@skynav.test");
  });

  it("rejects weak password on registration", () => {
    assert.throws(() => {
      registerRequestSchema.parse({
        email: "test@example.com",
        password: "short"
      });
    });
  });

  it("validates login request with optional orgId", () => {
    const login = {
      email: "admin@skynav.test",
      password: "Password123!",
      organizationId: "11111111-1111-1111-1111-111111111111"
    };
    const parsed = loginRequestSchema.parse(login);
    assert.equal(parsed.organizationId, "11111111-1111-1111-1111-111111111111");
  });

  it("checks RBAC permissions correctly", () => {
    assert.ok(roleHasPermission("ADMIN", "missions:authorize"));
    assert.ok(roleHasPermission("ADMIN", "audit:read"));
    assert.ok(roleHasPermission("OPERATOR", "missions:command"));
    assert.ok(!roleHasPermission("CUSTOMER", "missions:authorize"));
    assert.ok(roleHasPermission("CUSTOMER", "orders:create"));
    assert.ok(roleHasPermission("OPERATOR", "orders:update"));

    const operatorPerms = getPermissionsForRole("OPERATOR");
    assert.ok(operatorPerms.includes("missions:authorize"));
    assert.ok(!operatorPerms.includes("org:manage" as any));
  });

  it("validates RFC 7807 problem details envelope", () => {
    const problem = {
      type: "https://skynav.io/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials provided.",
      timestamp: new Date().toISOString(),
      code: "INVALID_CREDENTIALS"
    };
    const parsed = problemDetailsSchema.parse(problem);
    assert.equal(parsed.status, 401);
  });
});

describe("Contracts / Order Domain Schemas", () => {
  it("validates valid order creation payload", () => {
    const orderPayload = {
      pickup: {
        latitude: 37.7749,
        longitude: -122.4194,
        altitudeMeters: 10,
        address: "Depot West"
      },
      delivery: {
        latitude: 37.7833,
        longitude: -122.4167,
        altitudeMeters: 15,
        address: "Customer Pad"
      },
      package: {
        weightGrams: 1200,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
        description: "Medical Box"
      },
      priority: "EXPRESS",
      deliveryNotes: "Rooftop drop"
    };
    const parsed = createOrderRequestSchema.parse(orderPayload);
    assert.equal(parsed.priority, "EXPRESS");
    assert.equal(parsed.package.weightGrams, 1200);
  });

  it("rejects invalid geographic coordinates and negative package weights", () => {
    assert.throws(() => {
      createOrderRequestSchema.parse({
        pickup: { latitude: 95.0, longitude: 0 },
        delivery: { latitude: 0, longitude: 0 },
        package: { weightGrams: 500 }
      });
    });

    assert.throws(() => {
      createOrderRequestSchema.parse({
        pickup: { latitude: 0, longitude: -190.0 },
        delivery: { latitude: 0, longitude: 0 },
        package: { weightGrams: 500 }
      });
    });

    assert.throws(() => {
      createOrderRequestSchema.parse({
        pickup: { latitude: 0, longitude: 0 },
        delivery: { latitude: 0, longitude: 0 },
        package: { weightGrams: -100 }
      });
    });
  });

  it("validates status update and cancellation payloads", () => {
    const update = updateOrderStatusRequestSchema.parse({
      status: "ASSIGNED",
      reason: "Drone allocated"
    });
    assert.equal(update.status, "ASSIGNED");

    const cancel = cancelOrderRequestSchema.parse({
      reason: "Weather grounding"
    });
    assert.equal(cancel.reason, "Weather grounding");
  });

  it("validates full order response schema", () => {
    const response = {
      id: "11111111-1111-1111-1111-111111111111",
      orderNumber: "ORD-TEST-001",
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      customerId: "22222222-2222-2222-2222-222222222222",
      status: "CREATED",
      priority: "STANDARD",
      pickup: { latitude: 37.77, longitude: -122.41 },
      delivery: { latitude: 37.78, longitude: -122.42 },
      package: { weightGrams: 300 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const parsed = orderResponseSchema.parse(response);
    assert.equal(parsed.id, response.id);
    assert.equal(parsed.status, "CREATED");
  });
});

describe("Contracts / Fleet & Mission Schemas", () => {
  it("validates drone creation and update schemas", () => {
    const validDrone = {
      callSign: "SKY-001",
      model: "SkyNav Hexacopter Alpha",
      maxPayloadGrams: 5000,
      batteryPercent: 100,
      currentLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 },
      homeLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 }
    };
    const parsed = createDroneRequestSchema.parse(validDrone);
    assert.equal(parsed.callSign, "SKY-001");

    const validUpdate = updateDroneRequestSchema.parse({
      status: "ASSIGNED",
      batteryPercent: 95
    });
    assert.equal(validUpdate.status, "ASSIGNED");
    assert.equal(validUpdate.batteryPercent, 95);
  });

  it("rejects invalid drone call sign format", () => {
    assert.throws(() => {
      createDroneRequestSchema.parse({
        callSign: "SKY!@#", // invalid characters
        maxPayloadGrams: 5000
      });
    });
  });

  it("validates mission creation, assignment, and status update schemas", () => {
    const validMission = {
      orderId: "11111111-1111-1111-1111-111111111111",
      origin: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 },
      destination: { latitude: 37.7833, longitude: -122.4167, altitudeMeters: 15 }
    };
    const parsed = createMissionRequestSchema.parse(validMission);
    assert.equal(parsed.orderId, validMission.orderId);

    const assign = assignMissionRequestSchema.parse({
      droneId: "22222222-2222-2222-2222-222222222222"
    });
    assert.equal(assign.droneId, "22222222-2222-2222-2222-222222222222");

    const statusUpdate = updateMissionStatusRequestSchema.parse({
      status: "IN_PROGRESS",
      reason: "Takeoff completed"
    });
    assert.equal(statusUpdate.status, "IN_PROGRESS");
  });

  it("validates extended telemetry and WebSocket protocol message schemas", () => {
    const validTelemetry = {
      version: "v1" as const,
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      droneId: "11111111-1111-1111-1111-111111111111",
      missionId: "22222222-2222-2222-2222-222222222222",
      observedAt: new Date().toISOString(),
      position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 50 },
      speedMetersPerSecond: 12.5,
      headingDegrees: 90,
      batteryPercent: 88,
      state: "EN_ROUTE" as const,
      currentWaypointIndex: 2,
      totalWaypoints: 5,
      distanceToTargetMeters: 450,
      totalDistanceFlownMeters: 1200,
      flightTimeSeconds: 150
    };
    const parsedTelemetry = telemetrySchema.parse(validTelemetry);
    assert.equal(parsedTelemetry.state, "EN_ROUTE");
    assert.equal(parsedTelemetry.droneId, validTelemetry.droneId);

    // Client WS messages
    const authMsg = wsClientMessageSchema.parse({ type: "AUTH", token: "jwt-token-xyz" });
    assert.equal(authMsg.type, "AUTH");

    const subMsg = wsClientMessageSchema.parse({
      type: "SUBSCRIBE",
      channel: "telemetry:drone",
      id: "11111111-1111-1111-1111-111111111111"
    });
    assert.equal(subMsg.type, "SUBSCRIBE");

    const pingMsg = wsClientMessageSchema.parse({ type: "PING" });
    assert.equal(pingMsg.type, "PING");

    // Server WS messages
    const telemServerMsg = wsServerMessageSchema.parse({
      type: "TELEMETRY",
      channel: "telemetry:drone:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:11111111-1111-1111-1111-111111111111",
      telemetry: validTelemetry,
      timestamp: new Date().toISOString()
    });
    assert.equal(telemServerMsg.type, "TELEMETRY");
  });

  it("validates domain event envelope schema and rejects malformed events (1, 2, 3, 4)", () => {
    const validEvent = {
      id: "11111111-1111-1111-1111-111111111111",
      version: "v1" as const,
      eventType: "ORDER_CREATED" as const,
      occurredAt: new Date().toISOString(),
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      aggregateType: "ORDER" as const,
      aggregateId: "22222222-2222-2222-2222-222222222222",
      actorId: "33333333-3333-3333-3333-333333333333",
      payload: {
        orderNumber: "ORD-2026-001",
        customerId: "33333333-3333-3333-3333-333333333333"
      }
    };
    const parsed = domainEventEnvelopeSchema.parse(validEvent);
    assert.equal(parsed.eventType, "ORDER_CREATED");
    assert.equal(parsed.organizationId, validEvent.organizationId);

    // Reject unknown event type
    assert.throws(() => {
      domainEventEnvelopeSchema.parse({
        ...validEvent,
        eventType: "UNRECOGNIZED_EVENT"
      });
    });

    // Reject invalid organization ID
    assert.throws(() => {
      domainEventEnvelopeSchema.parse({
        ...validEvent,
        organizationId: "not-a-uuid"
      });
    });
  });

  it("validates notification response, list query, and WebSocket notification envelopes", () => {
    const notification = {
      id: "11111111-1111-1111-1111-111111111111",
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      userId: "22222222-2222-2222-2222-222222222222",
      type: "ORDER_UPDATE" as const,
      severity: "INFO" as const,
      title: "Order Confirmed",
      message: "Your order ORD-2026-001 has been confirmed and queued for UAV dispatch.",
      isRead: false,
      aggregateType: "ORDER",
      aggregateId: "33333333-3333-3333-3333-333333333333",
      eventId: "44444444-4444-4444-4444-444444444444",
      metadata: { orderNumber: "ORD-2026-001" },
      createdAt: new Date().toISOString()
    };
    const parsedNotification = notificationResponseSchema.parse(notification);
    assert.equal(parsedNotification.title, "Order Confirmed");
    assert.equal(parsedNotification.isRead, false);

    const query = notificationListQuerySchema.parse({
      isRead: "false",
      type: "ORDER_UPDATE",
      limit: "10",
      offset: "0"
    });
    assert.equal(query.isRead, false);
    assert.equal(query.limit, 10);

    const wsNotifMsg = wsServerMessageSchema.parse({
      type: "NOTIFICATION",
      channel: "notifications:user:22222222-2222-2222-2222-222222222222",
      notification: parsedNotification,
      timestamp: new Date().toISOString()
    });
    assert.equal(wsNotifMsg.type, "NOTIFICATION");
  });
});

describe("Contracts / Geospatial Utilities & Calculations", () => {
  const sfDepot = { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 10 };
  const sfDelivery = { latitude: 37.7833, longitude: -122.4167, altitudeMeters: 25 };

  it("validates coordinate boundaries accurately", () => {
    assert.ok(isValidCoordinate({ latitude: 37.7749, longitude: -122.4194 }));
    assert.ok(isValidCoordinate({ latitude: -90, longitude: 180 }));
    assert.ok(isValidCoordinate({ latitude: 90, longitude: -180 }));
    assert.ok(!isValidCoordinate({ latitude: 90.1, longitude: 0 }));
    assert.ok(!isValidCoordinate({ latitude: 0, longitude: 180.1 }));
    assert.ok(!isValidCoordinate(null));
    assert.ok(!isValidCoordinate({ latitude: NaN, longitude: 0 } as any));
  });

  it("calculates accurate Haversine surface distance and 3D distance", () => {
    const dist2D = haversineDistanceMeters(sfDepot, sfDelivery);
    assert.ok(dist2D > 900 && dist2D < 1100, `Expected ~960m, got ${dist2D}`);

    const dist3D = distance3DMeters(sfDepot, sfDelivery);
    assert.ok(dist3D >= dist2D, "3D distance must be greater than or equal to 2D surface distance");
  });

  it("computes initial forward bearing accurately", () => {
    const northPt1 = { latitude: 0, longitude: 0 };
    const northPt2 = { latitude: 1, longitude: 0 };
    const bearingNorth = initialBearingDegrees(northPt1, northPt2);
    assert.ok(Math.abs(bearingNorth - 0) < 0.1 || Math.abs(bearingNorth - 360) < 0.1);

    const eastPt = { latitude: 0, longitude: 1 };
    const bearingEast = initialBearingDegrees(northPt1, eastPt);
    assert.ok(Math.abs(bearingEast - 90) < 0.1);
  });

  it("interpolates and projects positions accurately", () => {
    const midpoint = interpolateCoordinate(sfDepot, sfDelivery, 0.5);
    assert.ok(Math.abs(midpoint.latitude - (sfDepot.latitude + sfDelivery.latitude) / 2) < 0.0001);
    assert.ok(Math.abs(midpoint.longitude - (sfDepot.longitude + sfDelivery.longitude) / 2) < 0.0001);
    assert.equal(midpoint.altitudeMeters, 17.5);

    const projected = projectPosition(sfDepot, 90, 1000);
    assert.ok(isValidCoordinate(projected));
    assert.ok(projected.longitude > sfDepot.longitude);
  });

  it("computes cumulative route distance and remaining distance", () => {
    const route = [
      sfDepot,
      { latitude: 37.778, longitude: -122.418, altitudeMeters: 50 },
      sfDelivery
    ];
    const totalDist = computeRouteDistanceMeters(route);
    assert.ok(totalDist > 0);

    const remaining = computeRemainingRouteDistanceMeters(sfDepot, route, 1);
    assert.ok(remaining > 0 && remaining <= totalDist);
  });

  it("calculates dynamic ETA and formats distance/duration", () => {
    const etaSecs = calculateDynamicEtaSeconds(1500, 15);
    assert.equal(etaSecs, 100);

    assert.equal(formatDistance(450), "450 m");
    assert.equal(formatDistance(2400), "2.4 km");
    assert.equal(formatDuration(45), "45s");
    assert.equal(formatDuration(125), "2m 5s");
    assert.equal(formatDuration(3660), "1h 1m");
  });

  it("computes bounding boxes accurately", () => {
    const bbox = computeBoundingBox([sfDepot, sfDelivery]);
    assert.ok(bbox !== null);
    assert.equal(bbox.minLat, sfDepot.latitude);
    assert.equal(bbox.maxLat, sfDelivery.latitude);
    assert.ok(bbox.center.latitude > sfDepot.latitude && bbox.center.latitude < sfDelivery.latitude);
  });

  it("evaluates telemetry freshness correctly based on observation time", () => {
    const now = new Date("2026-08-30T12:00:00Z");
    const liveTime = new Date("2026-08-30T11:59:58Z"); // 2s old
    const degradedTime = new Date("2026-08-30T11:59:54Z"); // 6s old
    const staleTime = new Date("2026-08-30T11:59:40Z"); // 20s old
    const offlineTime = new Date("2026-08-30T11:58:00Z"); // 120s old

    assert.equal(calculateTelemetryFreshness(liveTime, now), "LIVE");
    assert.equal(calculateTelemetryFreshness(degradedTime, now), "DEGRADED");
    assert.equal(calculateTelemetryFreshness(staleTime, now), "STALE");
    assert.equal(calculateTelemetryFreshness(offlineTime, now), "OFFLINE");
    assert.equal(calculateTelemetryFreshness(null, now), "OFFLINE");
  });
});

describe("Contracts / AI Advisory & Safety Gate Schemas", () => {
  it("validates valid route scoring request and candidate ranking schema", () => {
    const validRequest = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      packageWeightGrams: 1500,
      droneMaxPayloadGrams: 4500,
      droneBatteryPercent: 95,
      weather: {
        windSpeedMps: 4.5,
        windDirectionDegrees: 180,
        windGustMps: 6.0,
        precipitationMmPerHour: 0,
        visibilityMeters: 10000,
        temperatureCelsius: 18
      },
      candidates: [
        {
          id: "route-direct",
          name: "Direct Route A",
          waypoints: [
            { latitude: 37.7749, longitude: -122.4194 },
            { latitude: 37.7845, longitude: -122.4082 }
          ],
          cruiseAltitudeMeters: 60,
          targetSpeedMps: 15
        }
      ],
      priority: "STANDARD"
    };

    const parsed = aiRouteScoringRequestSchema.parse(validRequest);
    assert.equal(parsed.candidates.length, 1);
    assert.equal(parsed.packageWeightGrams, 1500);

    const validResponse = {
      modelVersion: "advisory-v1.0.0",
      generatedAt: new Date().toISOString(),
      recommendedRouteId: "route-direct",
      candidates: [
        {
          id: "route-direct",
          name: "Direct Route A",
          rank: 1,
          score: 92.5,
          totalDistanceMeters: 1450,
          estimatedFlightTimeSeconds: 96,
          predictedEta: new Date(Date.now() + 96000).toISOString(),
          estimatedBatteryConsumptionPercent: 8.5,
          batteryFeasibility: "SAFE",
          weatherRiskLevel: "NORMAL",
          compositeRiskScore: 12.0,
          isRecommended: true,
          recommendationReason: "Shortest route with optimal wind profile and low airspace congestion.",
          riskFactors: ["Mild crosswind near delivery point"],
          scoreBreakdown: {
            distanceScore: 95,
            timeScore: 90,
            batteryScore: 95,
            weatherScore: 90,
            priorityBonus: 0
          },
          waypoints: [
            { latitude: 37.7749, longitude: -122.4194 },
            { latitude: 37.7845, longitude: -122.4082 }
          ]
        }
      ],
      advisoryDisclaimer: "AI recommendations are advisory only and must pass deterministic safety validation."
    };

    const parsedRes = aiRouteScoringResponseSchema.parse(validResponse);
    assert.equal(parsedRes.recommendedRouteId, "route-direct");
    assert.equal(parsedRes.candidates[0].batteryFeasibility, "SAFE");
  });

  it("validates ETA and Battery prediction schemas", () => {
    const etaReq = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      currentPosition: { latitude: 37.7749, longitude: -122.4194 },
      currentSpeedMps: 12.5,
      destination: { latitude: 37.7845, longitude: -122.4082 }
    };
    const parsedEtaReq = aiEtaPredictionRequestSchema.parse(etaReq);
    assert.equal(parsedEtaReq.cruiseSpeedMps, 15);

    const battReq = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      droneId: "00000000-0000-0000-0000-000000000011",
      currentBatteryPercent: 85,
      routeDistanceMeters: 3000,
      packageWeightGrams: 2000
    };
    const parsedBatt = aiBatteryPredictionRequestSchema.parse(battReq);
    assert.equal(parsedBatt.currentBatteryPercent, 85);
  });

  it("validates Predictive Maintenance and Demand Forecasting schemas", () => {
    const maintReq = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      droneId: "00000000-0000-0000-0000-000000000011",
      callSign: "SKY-001",
      model: "AeroHex V4",
      flightHours: 120.5,
      batteryCycles: 45,
      batteryHealthPercent: 94
    };
    const parsedMaint = aiMaintenancePredictionRequestSchema.parse(maintReq);
    assert.equal(parsedMaint.flightHours, 120.5);

    const forecastReq = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      forecastHorizonHours: 12
    };
    const parsedForecast = aiDemandForecastRequestSchema.parse(forecastReq);
    assert.equal(parsedForecast.forecastHorizonHours, 12);
  });

  it("validates Deterministic Safety Gate and Evaluated Mission Plan schemas", () => {
    const gateResult = {
      passed: true,
      geofenceCheck: { passed: true, reason: "No geofence intersection detected." },
      batteryReserveCheck: { passed: true, expectedReservePercent: 65, minRequiredReservePercent: 20, reason: "Adequate landing reserve." },
      payloadCheck: { passed: true, packageWeightGrams: 1500, maxPayloadGrams: 4500, reason: "Payload within operational limits." },
      weatherCheck: { passed: true, windSpeedMps: 4.5, maxAllowedWindMps: 15, reason: "Wind speed within limits." },
      altitudeEnvelopeCheck: { passed: true, cruiseAltitudeMeters: 60, maxAltitudeMeters: 120, reason: "Altitude within corridor bounds." },
      rejectionReasons: []
    };

    const parsedGate = deterministicSafetyGateResultSchema.parse(gateResult);
    assert.ok(parsedGate.passed);

    const evalPlan = {
      orderId: "ord-123",
      evaluatedAt: new Date().toISOString(),
      deterministicSafetyGate: gateResult,
      isMissionAuthorized: true,
      operatorDecisionRationale: "AI recommended Route A and passed all deterministic safety constraints."
    };

    const parsedPlan = missionPlanEvaluationResponseSchema.parse(evalPlan);
    assert.ok(parsedPlan.isMissionAuthorized);
  });
});

