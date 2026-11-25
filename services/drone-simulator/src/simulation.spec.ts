import { createInitialState, injectFault, tick } from "./simulation";

describe("drone-simulator simulation", () => {
  it("moves deterministically toward the current patrol target", () => {
    const state = createInitialState("d1", 44.9778, -93.265);
    const a = tick(state);
    const b = tick(state);
    expect(a).toEqual(b);
    expect(a.lat).toBeGreaterThan(state.lat);
  });

  it("drains battery by a fixed amount per tick, then recharges once critically low", () => {
    let state = createInitialState("d1", 44.9778, -93.265);
    for (let i = 0; i < 12; i += 1) {
      state = tick(state);
    }
    expect(state.batteryPercent).toBe(88);

    let recharged = false;
    for (let i = 0; i < 100; i += 1) {
      state = tick(state);
      if (state.batteryPercent === 100) {
        recharged = true;
        break;
      }
    }
    expect(recharged).toBe(true);
  });

  it("reverses direction once it reaches a patrol endpoint", () => {
    let state = createInitialState("d1", 44.9778, -93.265);
    const initialTarget = state.targetLat;
    for (let i = 0; i < 10; i += 1) {
      state = tick(state);
    }
    expect(state.targetLat).not.toBe(initialTarget);
  });

  it("forces a low battery reading for exactly one tick after a LOW_BATTERY fault", () => {
    const faulted = injectFault(createInitialState("d1", 44.9778, -93.265), "LOW_BATTERY");
    const duringFault = tick(faulted);
    expect(duringFault.batteryPercent).toBeLessThanOrEqual(15);

    const afterFault = tick(duringFault);
    expect(afterFault.batteryPercent).toBeLessThanOrEqual(duringFault.batteryPercent);
  });

  it("reports zero signal for exactly one tick after a SIGNAL_LOSS fault", () => {
    const faulted = injectFault(createInitialState("d1", 44.9778, -93.265), "SIGNAL_LOSS");
    const duringFault = tick(faulted);
    const afterFault = tick(duringFault);

    expect(duringFault.signalStrengthPercent).toBe(0);
    expect(afterFault.signalStrengthPercent).toBeGreaterThan(0);
  });

  it("enters an unrecoverable crashed state on a CRASH fault", () => {
    const faulted = injectFault(createInitialState("d1", 44.9778, -93.265), "CRASH");
    const crashed = tick(faulted);
    const stillCrashed = tick(crashed);

    expect(crashed.crashed).toBe(true);
    expect(crashed.speedMps).toBe(0);
    expect(stillCrashed).toEqual(crashed);
  });
});
