import { LocalWeatherProvider } from "./local-weather.provider";

describe("LocalWeatherProvider", () => {
  it("applies an override on top of the deterministic baseline", async () => {
    const provider = new LocalWeatherProvider();
    const baseline = await provider.getCurrentWeather(0, 0, "zone-override");

    provider.setOverride("zone-override", { windSpeedMps: 25, condition: "STORM" });
    const overridden = await provider.getCurrentWeather(0, 0, "zone-override");

    expect(overridden.windSpeedMps).toBe(25);
    expect(overridden.condition).toBe("STORM");
    // Fields not included in the override keep the deterministic baseline.
    expect(overridden.temperatureCelsius).toBe(baseline.temperatureCelsius);
  });

  it("only affects the overridden zone, not others", async () => {
    const provider = new LocalWeatherProvider();
    provider.setOverride("zone-a", { condition: "STORM" });

    const other = await provider.getCurrentWeather(0, 0, "zone-b");
    expect(other.condition).not.toBe("STORM");
  });

  it("reverts to the deterministic baseline after clearOverride", async () => {
    const provider = new LocalWeatherProvider();
    const baseline = await provider.getCurrentWeather(0, 0, "zone-clear");

    provider.setOverride("zone-clear", { condition: "STORM" });
    provider.clearOverride("zone-clear");
    const reverted = await provider.getCurrentWeather(0, 0, "zone-clear");

    expect(reverted).toEqual(baseline);
  });
});
