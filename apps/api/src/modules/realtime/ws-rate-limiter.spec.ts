import { WsRateLimiter } from "./ws-rate-limiter";

describe("WsRateLimiter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows up to the configured limit within a window", () => {
    const limiter = new WsRateLimiter(3, 10_000);
    expect(limiter.allow("socket-1")).toBe(true);
    expect(limiter.allow("socket-1")).toBe(true);
    expect(limiter.allow("socket-1")).toBe(true);
  });

  it("rejects once the limit is exceeded within the window", () => {
    const limiter = new WsRateLimiter(3, 10_000);
    limiter.allow("socket-1");
    limiter.allow("socket-1");
    limiter.allow("socket-1");
    expect(limiter.allow("socket-1")).toBe(false);
  });

  it("resets after the window elapses", () => {
    const limiter = new WsRateLimiter(1, 1_000);
    expect(limiter.allow("socket-1")).toBe(true);
    expect(limiter.allow("socket-1")).toBe(false);

    jest.advanceTimersByTime(1_001);

    expect(limiter.allow("socket-1")).toBe(true);
  });

  it("tracks each socket independently", () => {
    const limiter = new WsRateLimiter(1, 10_000);
    expect(limiter.allow("socket-1")).toBe(true);
    expect(limiter.allow("socket-2")).toBe(true);
    expect(limiter.allow("socket-1")).toBe(false);
    expect(limiter.allow("socket-2")).toBe(false);
  });

  it("clear() forgets a socket's bucket, freeing memory on disconnect", () => {
    const limiter = new WsRateLimiter(1, 10_000);
    limiter.allow("socket-1");
    expect(limiter.trackedSocketCount).toBe(1);

    limiter.clear("socket-1");

    expect(limiter.trackedSocketCount).toBe(0);
    expect(limiter.allow("socket-1")).toBe(true);
  });
});
