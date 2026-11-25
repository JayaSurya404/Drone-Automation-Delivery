import { NotImplementedException } from "@nestjs/common";
import { MavlinkDroneAdapter } from "./mavlink-drone.adapter";

describe("MavlinkDroneAdapter", () => {
  it("throws NotImplementedException from every DroneAdapter method", async () => {
    const adapter = new MavlinkDroneAdapter();

    await expect(adapter.connect("d1")).rejects.toThrow(NotImplementedException);
    await expect(adapter.arm("d1")).rejects.toThrow(NotImplementedException);
    await expect(adapter.takeoff("d1", 60)).rejects.toThrow(NotImplementedException);
    await expect(adapter.gotoWaypoint("d1", { lat: 0, lng: 0, altitudeMeters: 60 })).rejects.toThrow(NotImplementedException);
    await expect(adapter.returnToHome("d1")).rejects.toThrow(NotImplementedException);
    await expect(adapter.land("d1")).rejects.toThrow(NotImplementedException);
    await expect(adapter.emergencyStop("d1")).rejects.toThrow(NotImplementedException);
    await expect(adapter.getTelemetry("d1")).rejects.toThrow(NotImplementedException);
    expect(() => adapter.subscribeTelemetry("d1", () => {})).toThrow(NotImplementedException);
  });
});
