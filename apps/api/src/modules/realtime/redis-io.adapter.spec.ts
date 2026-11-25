import { EventEmitter } from "node:events";

const mockCreateAdapter = jest.fn().mockReturnValue("fake-adapter-ctor");
jest.mock("@socket.io/redis-adapter", () => ({ createAdapter: (...args: unknown[]) => mockCreateAdapter(...args) }));

let allCreatedClients: FakeRedis[] = [];

class FakeRedis extends EventEmitter {
  connect = jest.fn().mockResolvedValue(undefined);
  quit = jest.fn().mockResolvedValue("OK");
  duplicate(): FakeRedis {
    const dup = new FakeRedis();
    allCreatedClients.push(dup);
    return dup;
  }
}

let lastCreatedClient: FakeRedis | undefined;
jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(function (this: FakeRedis) {
    const instance = new FakeRedis();
    lastCreatedClient = instance;
    allCreatedClients.push(instance);
    return instance;
  }),
}));

import { RedisIoAdapter } from "./redis-io.adapter";

describe("RedisIoAdapter (Phase 12 resilience)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastCreatedClient = undefined;
    allCreatedClients = [];
  });

  it("wires the Redis adapter when both clients connect successfully", async () => {
    const adapter = new RedisIoAdapter({} as never);
    await adapter.connectToRedis("redis://localhost:6379");
    expect(mockCreateAdapter).toHaveBeenCalled();
  });

  it("degrades gracefully instead of crashing when Redis is unreachable at startup", async () => {
    const OriginalRedis = jest.requireMock("ioredis").Redis as jest.Mock;
    OriginalRedis.mockImplementationOnce(() => {
      const instance = new FakeRedis();
      instance.connect = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
      return instance;
    });

    const adapter = new RedisIoAdapter({} as never);
    await expect(adapter.connectToRedis("redis://localhost:6379")).resolves.toBeUndefined();
    expect(mockCreateAdapter).not.toHaveBeenCalled();
  });

  it("does not crash the process when a connected client later emits a transient 'error' event", async () => {
    const adapter = new RedisIoAdapter({} as never);
    await adapter.connectToRedis("redis://localhost:6379");

    expect(() => lastCreatedClient?.emit("error", new Error("read ECONNRESET"))).not.toThrow();
  });

  describe("close (Phase 13 graceful-shutdown fix)", () => {
    it("quits both the pub and sub clients", async () => {
      const adapter = new RedisIoAdapter({} as never);
      await adapter.connectToRedis("redis://localhost:6379");
      expect(allCreatedClients).toHaveLength(2);

      await adapter.close();

      for (const client of allCreatedClients) {
        expect(client.quit).toHaveBeenCalledTimes(1);
      }
    });

    it("does not reject if one client's quit() throws (already disconnected)", async () => {
      const adapter = new RedisIoAdapter({} as never);
      await adapter.connectToRedis("redis://localhost:6379");
      allCreatedClients[0]!.quit = jest.fn().mockRejectedValue(new Error("Connection is closed."));

      await expect(adapter.close()).resolves.toBeUndefined();
      expect(allCreatedClients[1]!.quit).toHaveBeenCalledTimes(1);
    });

    it("is a no-op if connectToRedis was never called", async () => {
      const adapter = new RedisIoAdapter({} as never);
      await expect(adapter.close()).resolves.toBeUndefined();
    });
  });
});
