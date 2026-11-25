import { UnauthorizedException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hashToken } from "../../common/security/token.util";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../notifications/mail.service";
import { RbacService } from "../rbac/rbac.service";
import { RedisService } from "../../redis/redis.service";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";

describe("AuthService.refresh — rotation and reuse detection", () => {
  let service: AuthService;
  let prisma: {
    refreshToken: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let auditService: { log: jest.Mock };
  let redisClient: { get: jest.Mock; incr: jest.Mock; expire: jest.Mock; del: jest.Mock };

  const fakeUser = {
    id: "user-1",
    email: "customer@example.com",
    isActive: true,
    roles: [{ role: { name: "customer" } }],
  };

  beforeEach(async () => {
    prisma = {
      refreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    auditService = { log: jest.fn() };
    redisClient = { get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1), expire: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: { toPublicUser: (u: unknown) => u, findByEmail: jest.fn(), verifyPassword: jest.fn() } },
        { provide: RbacService, useValue: { resolvePermissions: jest.fn().mockResolvedValue(["cart.manage"]) } },
        { provide: AuditService, useValue: auditService },
        { provide: MailService, useValue: { send: jest.fn() } },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                JWT_ACCESS_TTL: "15m",
                REFRESH_TOKEN_TTL_DAYS: 30,
              })[key],
          },
        },
        { provide: RedisService, useValue: { client: redisClient } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("rotates a valid refresh token: revokes the old one and issues a new one in the same family", async () => {
    const rawToken = "valid-raw-token";
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      userId: fakeUser.id,
      familyId: "family-1",
      tokenHash: hashToken(rawToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user: fakeUser,
    });

    const result = await service.refresh(rawToken, { ip: "127.0.0.1" });

    expect(result.tokens.accessToken).toBe("signed.jwt.token");
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: fakeUser.id, familyId: "family-1" }),
      }),
    );
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-1" },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("detects reuse of an already-rotated token, revokes the whole family, and rejects", async () => {
    const rawToken = "reused-raw-token";
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-2",
      userId: fakeUser.id,
      familyId: "family-2",
      tokenHash: hashToken(rawToken),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user: fakeUser,
    });

    await expect(service.refresh(rawToken, { ip: "127.0.0.1" })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: "family-2", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.refresh.reuse_detected" }),
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("rejects an expired refresh token without rotating it", async () => {
    const rawToken = "expired-raw-token";
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-3",
      userId: fakeUser.id,
      familyId: "family-3",
      tokenHash: hashToken(rawToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: fakeUser,
    });

    await expect(service.refresh(rawToken, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown token hash", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh("unknown-token", {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a token belonging to a deactivated user", async () => {
    const rawToken = "inactive-user-token";
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-4",
      userId: fakeUser.id,
      familyId: "family-4",
      tokenHash: hashToken(rawToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user: { ...fakeUser, isActive: false },
    });

    await expect(service.refresh(rawToken, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("AuthService.login — account-level lockout (Phase 12)", () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock; verifyPassword: jest.Mock; toPublicUser: jest.Mock };
  let auditService: { log: jest.Mock };
  let redisClient: { get: jest.Mock; incr: jest.Mock; expire: jest.Mock; del: jest.Mock };

  const fakeUser = { id: "user-1", email: "customer@example.com", passwordHash: "hash", isActive: true, roles: [{ role: { name: "customer" } }] };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn().mockResolvedValue(fakeUser),
      verifyPassword: jest.fn().mockResolvedValue(true),
      toPublicUser: jest.fn((u: unknown) => u),
    };
    auditService = { log: jest.fn() };
    redisClient = { get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1), expire: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { refreshToken: { create: jest.fn().mockResolvedValue(undefined) } } },
        { provide: UsersService, useValue: usersService },
        { provide: RbacService, useValue: { resolvePermissions: jest.fn().mockResolvedValue(["cart.manage"]) } },
        { provide: AuditService, useValue: auditService },
        { provide: MailService, useValue: { send: jest.fn() } },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") } },
        { provide: ConfigService, useValue: { get: (key: string) => ({ JWT_ACCESS_TTL: "15m", REFRESH_TOKEN_TTL_DAYS: 30 })[key] } },
        { provide: RedisService, useValue: { client: redisClient } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("rejects with the generic message once the per-account failed-attempt threshold is reached, without even querying for the user", async () => {
    redisClient.get.mockResolvedValueOnce("10");

    await expect(service.login({ email: "customer@example.com", password: "wrong" }, {})).rejects.toBeInstanceOf(UnauthorizedException);

    expect(usersService.findByEmail).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.login.locked" }));
  });

  it("increments the failed-attempt counter (and sets a TTL on the first failure) on a wrong password", async () => {
    usersService.verifyPassword.mockResolvedValueOnce(false);

    await expect(service.login({ email: "customer@example.com", password: "wrong" }, {})).rejects.toBeInstanceOf(UnauthorizedException);

    expect(redisClient.incr).toHaveBeenCalledWith("auth:failed_login:customer@example.com");
    expect(redisClient.expire).toHaveBeenCalledWith("auth:failed_login:customer@example.com", 15 * 60);
  });

  it("applies the same lockout counter regardless of whether the email exists — no new enumeration signal", async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);

    await expect(service.login({ email: "nobody@example.com", password: "x" }, {})).rejects.toBeInstanceOf(UnauthorizedException);

    expect(redisClient.incr).toHaveBeenCalledWith("auth:failed_login:nobody@example.com");
  });

  it("clears the failed-attempt counter on a successful login", async () => {
    await service.login({ email: "customer@example.com", password: "correct" }, {});
    expect(redisClient.del).toHaveBeenCalledWith("auth:failed_login:customer@example.com");
  });

  it("normalizes the lockout key by trimming and lowercasing the email", async () => {
    usersService.verifyPassword.mockResolvedValueOnce(false);
    await expect(service.login({ email: "  Customer@Example.com  ", password: "wrong" }, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redisClient.incr).toHaveBeenCalledWith("auth:failed_login:customer@example.com");
  });

  it("Phase 12 resilience: still authenticates on a correct password when Redis is unavailable — the lockout check degrades, login does not", async () => {
    redisClient.get.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    redisClient.del.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    const result = await service.login({ email: "customer@example.com", password: "correct" }, {});

    expect(result.user).toBeDefined();
  });

  it("Phase 12 resilience: still rejects a wrong password when Redis is unavailable — the failed-attempt counter degrades, the password check does not", async () => {
    usersService.verifyPassword.mockResolvedValueOnce(false);
    redisClient.get.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    redisClient.incr.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    await expect(service.login({ email: "customer@example.com", password: "wrong" }, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
