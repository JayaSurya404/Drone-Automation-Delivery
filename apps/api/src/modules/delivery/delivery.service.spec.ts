import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { hashVerificationCode } from "../../common/security/verification-code.util";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { StorageService } from "../../storage/storage.service";
import { AuditService } from "../audit/audit.service";
import { AiService } from "../ai/ai.service";
import { DronesService } from "../drones/drones.service";
import { WeatherService } from "../weather/weather.service";
import { DeliveryService } from "./delivery.service";

const CONFIG_VALUES: Record<string, number> = {
  DELIVERY_VERIFICATION_MAX_ATTEMPTS: 5,
  DELIVERY_VERIFICATION_TTL_MINUTES: 30,
  DEFAULT_DELIVERY_ETA_MINUTES: 45,
};

const CORRECT_CODE = "123456";
const now = new Date("2026-01-01T00:00:00.000Z");

function baseDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: "delivery-1",
    orderId: "order-1",
    hubId: null,
    status: "DELIVERED_PENDING_VERIFICATION",
    priority: "STANDARD",
    deliveryAddress: {},
    specialInstructions: null,
    scheduledWindowStart: null,
    scheduledWindowEnd: null,
    estimatedDeliveryAt: null,
    verificationCodeHash: hashVerificationCode(CORRECT_CODE),
    verificationExpiresAt: new Date(Date.now() + 10 * 60_000),
    verificationAttempts: 0,
    verifiedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
    order: { id: "order-1", orderNumber: "SN-1", userId: "customer-1", items: [{ productName: "Widget", quantity: 1 }] },
    hub: null,
    events: [],
    proofOfDelivery: null,
    ...overrides,
  };
}

const customerActor = { sub: "customer-1", email: "c@example.com", roles: ["customer"], permissions: ["orders.read_own"] };
const otherCustomerActor = { sub: "someone-else", email: "o@example.com", roles: ["customer"], permissions: ["orders.read_own"] };
const staffActor = { sub: "coordinator-1", email: "ops@example.com", roles: ["delivery_coordinator"], permissions: ["delivery.read", "delivery.manage"] };

function baseHub(overrides: Record<string, unknown> = {}) {
  return { id: "hub-1", name: "Downtown Hub", lat: 44.9778, lng: -93.265, isActive: true, ...overrides };
}

describe("DeliveryService", () => {
  let service: DeliveryService;
  let prisma: {
    delivery: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; create: jest.Mock };
    fulfillmentHub: { findUnique: jest.Mock };
    proofOfDelivery: { create: jest.Mock };
    deliveryEvent: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let redisService: { client: { get: jest.Mock; set: jest.Mock; del: jest.Mock } };
  let auditService: { log: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let dronesService: { getHubCoordinates: jest.Mock };
  let weatherService: { zoneKeyFor: jest.Mock; getCurrentWeather: jest.Mock; evaluateSafety: jest.Mock };
  let aiService: { predictEta: jest.Mock };

  beforeEach(async () => {
    prisma = {
      delivery: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      fulfillmentHub: { findUnique: jest.fn() },
      proofOfDelivery: { create: jest.fn().mockResolvedValue({}) },
      deliveryEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([{}, {}]),
    };
    redisService = { client: { get: jest.fn(), set: jest.fn(), del: jest.fn() } };
    auditService = { log: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    dronesService = { getHubCoordinates: jest.fn().mockResolvedValue({ lat: 44.9778, lng: -93.265 }) };
    weatherService = {
      zoneKeyFor: jest.fn().mockReturnValue("geo:44.98:-93.27"),
      getCurrentWeather: jest.fn().mockResolvedValue({ windSpeedMps: 3, precipitationMm: 0, condition: "CLEAR" }),
      evaluateSafety: jest.fn().mockReturnValue({ level: "SAFE", reasons: [] }),
    };
    aiService = { predictEta: jest.fn().mockResolvedValue({ etaAt: now, durationSeconds: 600, confidence: "HIGH", factors: [], predictedAt: now }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => CONFIG_VALUES[key] } },
        { provide: AuditService, useValue: auditService },
        { provide: RedisService, useValue: redisService },
        { provide: StorageService, useValue: {} },
        { provide: DronesService, useValue: dronesService },
        { provide: WeatherService, useValue: weatherService },
        { provide: AiService, useValue: aiService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(DeliveryService);
  });

  describe("verify", () => {
    it("hides the delivery (404) from a customer who doesn't own it", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery());
      await expect(
        service.verify("delivery-1", { code: CORRECT_CODE, method: "OTP" }, otherCustomerActor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects verification when the delivery isn't awaiting it", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery({ status: "IN_TRANSIT", verificationCodeHash: null }));
      await expect(
        service.verify("delivery-1", { code: CORRECT_CODE, method: "OTP" }, customerActor),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("fails a wrong code without completing the delivery, and reports remaining attempts", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery());
      await expect(service.verify("delivery-1", { code: "000000", method: "OTP" }, customerActor)).rejects.toThrow(
        /4 attempt/,
      );
      expect(prisma.delivery.update).toHaveBeenCalledWith({
        where: { id: "delivery-1" },
        data: { verificationAttempts: 1 },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("moves to VERIFICATION_FAILED once max attempts are exceeded", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery({ verificationAttempts: 4 }));
      await expect(service.verify("delivery-1", { code: "000000", method: "OTP" }, customerActor)).rejects.toThrow(
        /maximum attempts/i,
      );
      expect(prisma.delivery.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "VERIFICATION_FAILED" }) }),
      );
      expect(redisService.client.del).toHaveBeenCalled();
    });

    it("rejects and fails an expired code", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(
        baseDelivery({ verificationExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.verify("delivery-1", { code: CORRECT_CODE, method: "OTP" }, customerActor)).rejects.toThrow(
        /expired/i,
      );
      expect(prisma.delivery.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "VERIFICATION_FAILED" }) }),
      );
    });

    it("completes the delivery and records proof of delivery on a correct code", async () => {
      prisma.delivery.findUnique
        .mockResolvedValueOnce(baseDelivery())
        .mockResolvedValueOnce(baseDelivery({ status: "COMPLETED" }));

      await service.verify("delivery-1", { code: CORRECT_CODE, method: "QR" }, customerActor);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(redisService.client.del).toHaveBeenCalledWith("delivery:verification-code:delivery-1");
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: "delivery.verified" }));
    });
  });

  describe("assignHub", () => {
    it("predicts the ETA via AiService using the hub's coordinates and stores it on the delivery", async () => {
      prisma.delivery.findUnique
        .mockResolvedValueOnce(baseDelivery({ status: "PENDING_ASSIGNMENT" })) // getOwnedByIdOrThrow
        .mockResolvedValueOnce(baseDelivery({ status: "HUB_ASSIGNED", hubId: "hub-1" })); // getDeliveryForViewer
      prisma.fulfillmentHub.findUnique.mockResolvedValueOnce(baseHub());
      const etaAt = new Date("2026-01-01T00:30:00.000Z");
      aiService.predictEta.mockResolvedValueOnce({ etaAt, durationSeconds: 600, confidence: "HIGH", factors: [], predictedAt: now });

      await service.assignHub("delivery-1", { hubId: "hub-1" }, staffActor);

      expect(dronesService.getHubCoordinates).toHaveBeenCalledWith("hub-1");
      expect(weatherService.getCurrentWeather).toHaveBeenCalledWith(44.9778, -93.265, "geo:44.98:-93.27");
      expect(aiService.predictEta).toHaveBeenCalledWith(
        expect.objectContaining({ windSpeedMps: 3, weatherCondition: "CLEAR", weatherSafetyLevel: "SAFE" }),
        { deliveryId: "delivery-1" },
      );
      expect(prisma.delivery.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "delivery-1" }, data: expect.objectContaining({ estimatedDeliveryAt: etaAt, hubId: "hub-1" }) }),
      );
    });

    it("falls back to a flat ETA estimate when the hub has no resolvable coordinates, without calling the AI service", async () => {
      prisma.delivery.findUnique
        .mockResolvedValueOnce(baseDelivery({ status: "PENDING_ASSIGNMENT" }))
        .mockResolvedValueOnce(baseDelivery({ status: "HUB_ASSIGNED", hubId: "hub-1" }));
      prisma.fulfillmentHub.findUnique.mockResolvedValueOnce(baseHub());
      dronesService.getHubCoordinates.mockResolvedValueOnce(null);

      const before = Date.now();
      await service.assignHub("delivery-1", { hubId: "hub-1" }, staffActor);
      const after = Date.now();

      expect(aiService.predictEta).not.toHaveBeenCalled();
      const updateCall = prisma.delivery.update.mock.calls.find((call) => call[0].data?.estimatedDeliveryAt);
      const estimatedDeliveryAt: Date = updateCall![0].data.estimatedDeliveryAt;
      expect(estimatedDeliveryAt.getTime()).toBeGreaterThanOrEqual(before + 44 * 60_000);
      expect(estimatedDeliveryAt.getTime()).toBeLessThanOrEqual(after + 46 * 60_000);
    });

    it("rejects assigning an inactive or unknown hub", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery({ status: "PENDING_ASSIGNMENT" }));
      prisma.fulfillmentHub.findUnique.mockResolvedValueOnce(baseHub({ isActive: false }));

      await expect(service.assignHub("delivery-1", { hubId: "hub-1" }, staffActor)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects assigning a hub once the delivery has moved past the assignable window", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery({ status: "IN_TRANSIT" }));
      await expect(service.assignHub("delivery-1", { hubId: "hub-1" }, staffActor)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("getVerificationCode", () => {
    it("returns the code from Redis while the verification window is active", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery());
      redisService.client.get.mockResolvedValueOnce(CORRECT_CODE);

      const result = await service.getVerificationCode("delivery-1", customerActor);

      expect(result.code).toBe(CORRECT_CODE);
      expect(result.qrPayload).toContain(CORRECT_CODE);
    });

    it("throws if Redis no longer has the code (expired/evicted)", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery());
      redisService.client.get.mockResolvedValueOnce(null);

      await expect(service.getVerificationCode("delivery-1", customerActor)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("hides the code from a non-owning customer", async () => {
      prisma.delivery.findUnique.mockResolvedValueOnce(baseDelivery());
      await expect(service.getVerificationCode("delivery-1", otherCustomerActor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
