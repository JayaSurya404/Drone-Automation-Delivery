import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import type { EnvConfig } from "../../config/env.validation";
import { OpsGateway } from "./ops.gateway";

function fakeSocket(overrides: Partial<Socket> = {}): Socket {
  return {
    id: "socket-1",
    handshake: { auth: {}, query: {} },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  } as unknown as Socket;
}

const coordinator = { sub: "u1", email: "c@example.com", roles: ["delivery_coordinator"], permissions: ["missions.read"] };
const customer = { sub: "u2", email: "cust@example.com", roles: ["customer"], permissions: ["orders.read_own"] };

describe("OpsGateway", () => {
  let jwtService: { verifyAsync: jest.Mock };
  let gateway: OpsGateway;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    const configService = { get: jest.fn((key: string) => (key === "WS_SUBSCRIBE_RATE_LIMIT" ? 30 : 10_000)) } as unknown as ConfigService<EnvConfig, true>;
    gateway = new OpsGateway(jwtService as unknown as JwtService, configService);
  });

  it("accepts a staff user with an ops permission and auto-joins ops:fleet", async () => {
    jwtService.verifyAsync.mockResolvedValue(coordinator);
    const socket = fakeSocket({ handshake: { auth: { token: "good" }, query: {} } as never });

    await gateway.handleConnection(socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith("ops:fleet");
    expect(socket.data.user).toEqual(coordinator);
  });

  it("refuses a plain customer — no ops permission at all", async () => {
    jwtService.verifyAsync.mockResolvedValue(customer);
    const socket = fakeSocket({ handshake: { auth: { token: "good" }, query: {} } as never });

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated connection", async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error("invalid"));
    const socket = fakeSocket();

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("subscribe:mission joins the scoped mission room for an authenticated ops user", async () => {
    const socket = fakeSocket({ data: { user: coordinator } });
    const result = await gateway.onSubscribeMission(socket, { missionId: "m1" });

    expect(socket.join).toHaveBeenCalledWith("mission:m1");
    expect(result).toEqual({ ok: true, room: "mission:m1" });
  });

  it("subscribe:drone joins the scoped drone room", async () => {
    const socket = fakeSocket({ data: { user: coordinator } });
    const result = await gateway.onSubscribeDrone(socket, { droneId: "d1" });

    expect(socket.join).toHaveBeenCalledWith("drone:d1");
    expect(result).toEqual({ ok: true, room: "drone:d1" });
  });

  it("rejects scoped subscribe from a socket with no authenticated user", async () => {
    const socket = fakeSocket({ data: {} });
    const result = await gateway.onSubscribeMission(socket, { missionId: "m1" });
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects a malformed subscribe payload", async () => {
    const socket = fakeSocket({ data: { user: coordinator } });
    const result = await gateway.onSubscribeDrone(socket, {});
    expect(result).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("unsubscribe:mission leaves the scoped room", async () => {
    const socket = fakeSocket();
    await gateway.onUnsubscribeMission(socket, { missionId: "m1" });
    expect(socket.leave).toHaveBeenCalledWith("mission:m1");
  });
});
