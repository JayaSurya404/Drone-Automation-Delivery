import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { Request, Response } from "express";

describe("AuthController — Refresh Cookie Isolation & Header Resolution", () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    register: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    logoutAll: jest.Mock;
  };

  const mockTokens = {
    accessToken: "mock.access.token",
    accessTokenExpiresInSeconds: 900,
    refreshToken: "mock.refresh.token",
    refreshTokenExpiresAt: new Date(Date.now() + 3600_000),
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: {} },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "NODE_ENV") return "test";
              if (key === "REFRESH_COOKIE_NAME") return "skynav_refresh_token";
              return undefined;
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("sets only skynav_admin_refresh_token when x-client-app is admin", async () => {
    const user = {
      id: "admin-1",
      email: "admin@skynav.local",
      roles: ["super_admin"],
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    authService.login.mockResolvedValue({ user, tokens: mockTokens });

    const req = {
      headers: { "x-client-app": "admin", origin: "http://localhost:5173" }, // Origin deliberately opposes header
    } as unknown as Request;

    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    await controller.login({ email: "admin@skynav.local", password: "Password123!" }, "127.0.0.1", req, res);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      "skynav_admin_refresh_token",
      mockTokens.refreshToken,
      expect.objectContaining({ path: "/api/v1/auth", httpOnly: true }),
    );
  });

  it("sets only skynav_customer_refresh_token when x-client-app is customer", async () => {
    const user = {
      id: "cust-1",
      email: "cust@skynav.local",
      roles: ["customer"],
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    authService.login.mockResolvedValue({ user, tokens: mockTokens });

    const req = {
      headers: { "x-client-app": "customer", origin: "http://localhost:5174" }, // Origin deliberately opposes header
    } as unknown as Request;

    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    await controller.login({ email: "cust@skynav.local", password: "Password123!" }, "127.0.0.1", req, res);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      "skynav_customer_refresh_token",
      mockTokens.refreshToken,
      expect.objectContaining({ path: "/api/v1/auth", httpOnly: true }),
    );
  });

  it("resolves cookie by user role when x-client-app header is absent", async () => {
    const staffUser = {
      id: "staff-1",
      email: "dispatcher@skynav.local",
      roles: ["dispatcher"],
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    authService.login.mockResolvedValue({ user: staffUser, tokens: mockTokens });

    const req = { headers: {} } as unknown as Request;
    const res = { cookie: jest.fn() } as unknown as Response;

    await controller.login({ email: "dispatcher@skynav.local", password: "Password123!" }, "127.0.0.1", req, res);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith("skynav_admin_refresh_token", mockTokens.refreshToken, expect.anything());
  });

  it("never sets the shared default refresh cookie in addition to dedicated cookie", async () => {
    const custUser = {
      id: "cust-2",
      email: "cust2@skynav.local",
      roles: ["customer"],
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    authService.login.mockResolvedValue({ user: custUser, tokens: mockTokens });

    const req = { headers: { "x-client-app": "customer" } } as unknown as Request;
    const res = { cookie: jest.fn() } as unknown as Response;

    await controller.login({ email: "cust2@skynav.local", password: "Password123!" }, "127.0.0.1", req, res);

    // Must be called exactly once for skynav_customer_refresh_token, NEVER for skynav_refresh_token
    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).not.toHaveBeenCalledWith("skynav_refresh_token", expect.anything(), expect.anything());
  });
});
