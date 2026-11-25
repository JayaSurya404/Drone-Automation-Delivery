import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import type { EnvConfig } from "../../config/env.validation";
import type { DeliveryService } from "../delivery/delivery.service";
import { TrackingGateway } from "./tracking.gateway";

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

const user = { sub: "cust-1", email: "c@example.com", roles: ["customer"], permissions: ["orders.read_own"] };

describe("TrackingGateway", () => {
  let jwtService: { verifyAsync: jest.Mock };
  let deliveryService: { getDeliveryForViewer: jest.Mock };
  let gateway: TrackingGateway;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    deliveryService = { getDeliveryForViewer: jest.fn() };
    const configService = { get: jest.fn((key: string) => (key === "WS_SUBSCRIBE_RATE_LIMIT" ? 30 : 10_000)) } as unknown as ConfigService<EnvConfig, true>;
    gateway = new TrackingGateway(jwtService as unknown as JwtService, deliveryService as unknown as DeliveryService, configService);
  });

  it("disconnects a socket with no/invalid token", async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error("invalid"));
    const socket = fakeSocket();

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.user).toBeUndefined();
  });

  it("accepts a socket with a valid token and attaches the decoded user", async () => {
    jwtService.verifyAsync.mockResolvedValue(user);
    const socket = fakeSocket({ handshake: { auth: { token: "good" }, query: {} } as never });

    await gateway.handleConnection(socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.data.user).toEqual(user);
  });

  it("subscribe:delivery joins the room only after an ownership check passes", async () => {
    deliveryService.getDeliveryForViewer.mockResolvedValue({ id: "del1" });
    const socket = fakeSocket({ data: { user } });

    const result = await gateway.onSubscribeDelivery(socket, { deliveryId: "del1" });

    expect(deliveryService.getDeliveryForViewer).toHaveBeenCalledWith("del1", user);
    expect(socket.join).toHaveBeenCalledWith("delivery:del1");
    expect(result).toEqual({ ok: true, room: "delivery:del1" });
  });

  it("subscribe:delivery refuses to join when the delivery is not owned (service throws NotFound)", async () => {
    deliveryService.getDeliveryForViewer.mockRejectedValue(new Error("not found"));
    const socket = fakeSocket({ data: { user } });

    const result = await gateway.onSubscribeDelivery(socket, { deliveryId: "someone-elses-delivery" });

    expect(socket.join).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("subscribe:delivery rejects an unauthenticated socket", async () => {
    const socket = fakeSocket({ data: {} });
    const result = await gateway.onSubscribeDelivery(socket, { deliveryId: "del1" });
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("subscribe:delivery rejects a malformed payload", async () => {
    const socket = fakeSocket({ data: { user } });
    const result = await gateway.onSubscribeDelivery(socket, { nope: true });
    expect(result).toEqual({ ok: false, error: "invalid_payload" });
    expect(deliveryService.getDeliveryForViewer).not.toHaveBeenCalled();
  });

  it("enforces the per-socket subscribe rate limit", async () => {
    const strictConfig = { get: jest.fn((key: string) => (key === "WS_SUBSCRIBE_RATE_LIMIT" ? 1 : 10_000)) } as unknown as ConfigService<EnvConfig, true>;
    const strictGateway = new TrackingGateway(jwtService as unknown as JwtService, deliveryService as unknown as DeliveryService, strictConfig);
    deliveryService.getDeliveryForViewer.mockResolvedValue({ id: "del1" });
    const socket = fakeSocket({ data: { user } });

    await strictGateway.onSubscribeDelivery(socket, { deliveryId: "del1" });
    const second = await strictGateway.onSubscribeDelivery(socket, { deliveryId: "del2" });

    expect(second).toEqual({ ok: false, error: "rate_limited" });
  });

  it("unsubscribe:delivery leaves the room", async () => {
    const socket = fakeSocket();
    await gateway.onUnsubscribeDelivery(socket, { deliveryId: "del1" });
    expect(socket.leave).toHaveBeenCalledWith("delivery:del1");
  });
});
