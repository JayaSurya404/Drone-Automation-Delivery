import { EventCoalescer } from "./event-coalescer";

describe("EventCoalescer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires the first call for a key immediately (leading edge)", () => {
    const coalescer = new EventCoalescer();
    const run = jest.fn();

    coalescer.schedule("drone:1:location", run, 500);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("coalesces calls within the window into one trailing call with the latest data", () => {
    const coalescer = new EventCoalescer();
    const calls: number[] = [];

    coalescer.schedule("drone:1:location", () => calls.push(1), 500);
    coalescer.schedule("drone:1:location", () => calls.push(2), 500);
    coalescer.schedule("drone:1:location", () => calls.push(3), 500);

    expect(calls).toEqual([1]);

    jest.advanceTimersByTime(500);

    // Only the latest (3) fires as the trailing call, not every intermediate one.
    expect(calls).toEqual([1, 3]);
  });

  it("cleans up its window when nothing is pending", () => {
    const coalescer = new EventCoalescer();
    coalescer.schedule("drone:1:location", () => undefined, 500);
    expect(coalescer.pendingKeyCount).toBe(1);

    jest.advanceTimersByTime(500);

    expect(coalescer.pendingKeyCount).toBe(0);
  });

  it("keeps separate windows per key", () => {
    const coalescer = new EventCoalescer();
    const runA = jest.fn();
    const runB = jest.fn();

    coalescer.schedule("drone:1:location", runA, 500);
    coalescer.schedule("drone:2:location", runB, 500);

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledTimes(1);
  });

  it("allows a new leading call once a prior window has fully closed", () => {
    const coalescer = new EventCoalescer();
    const run = jest.fn();

    coalescer.schedule("drone:1:location", run, 500);
    jest.advanceTimersByTime(500);
    coalescer.schedule("drone:1:location", run, 500);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("clear() cancels pending timers without firing them", () => {
    const coalescer = new EventCoalescer();
    const run = jest.fn();
    coalescer.schedule("drone:1:location", run, 500);
    coalescer.schedule("drone:1:location", run, 500); // queued as trailing

    coalescer.clear();
    jest.advanceTimersByTime(1000);

    expect(run).toHaveBeenCalledTimes(1); // only the leading call, trailing never fired
    expect(coalescer.pendingKeyCount).toBe(0);
  });
});
