import { deriveNavigationHint } from "./visual-navigation.util";

describe("deriveNavigationHint", () => {
  it("recommends ABORT_LANDING when a human is detected, taking priority over everything else", () => {
    const hint = deriveNavigationHint({ obstructed: true, humanDetected: true, landingZoneVerdict: "SUITABLE" });
    expect(hint.recommendation).toBe("ABORT_LANDING");
    expect(hint.reasons[0]).toMatch(/person/i);
  });

  it("recommends ABORT_LANDING when the landing zone is UNSUITABLE", () => {
    const hint = deriveNavigationHint({ obstructed: false, humanDetected: false, landingZoneVerdict: "UNSUITABLE" });
    expect(hint.recommendation).toBe("ABORT_LANDING");
  });

  it("recommends HOLD when obstructed but not unsuitable", () => {
    const hint = deriveNavigationHint({ obstructed: true, humanDetected: false, landingZoneVerdict: "SUITABLE" });
    expect(hint.recommendation).toBe("HOLD");
  });

  it("recommends HOLD for a MARGINAL landing zone", () => {
    const hint = deriveNavigationHint({ obstructed: false, humanDetected: false, landingZoneVerdict: "MARGINAL" });
    expect(hint.recommendation).toBe("HOLD");
  });

  it("recommends PROCEED when clear with no landing-zone verdict at all", () => {
    const hint = deriveNavigationHint({ obstructed: false, humanDetected: false, landingZoneVerdict: null });
    expect(hint.recommendation).toBe("PROCEED");
  });
});
