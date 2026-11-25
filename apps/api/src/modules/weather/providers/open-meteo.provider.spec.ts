import { NotImplementedException } from "@nestjs/common";
import { OpenMeteoProvider } from "./open-meteo.provider";

describe("OpenMeteoProvider", () => {
  it("throws NotImplementedException rather than fabricating a reading", async () => {
    const provider = new OpenMeteoProvider();
    await expect(provider.getCurrentWeather(44.97, -93.26, "zone-1")).rejects.toBeInstanceOf(NotImplementedException);
  });
});
