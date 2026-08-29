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
  wsServerMessageSchema
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
});
