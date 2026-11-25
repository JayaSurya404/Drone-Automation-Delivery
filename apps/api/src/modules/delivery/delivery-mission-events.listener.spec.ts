import { DeliveryMissionEventsListener } from "./delivery-mission-events.listener";
import type { DeliveryService } from "./delivery.service";

describe("DeliveryMissionEventsListener", () => {
  let deliveryService: {
    markMissionPlanned: jest.Mock;
    markDroneDispatched: jest.Mock;
    markInTransit: jest.Mock;
    markDeliveredPendingVerification: jest.Mock;
    markReturnedToHubFromMission: jest.Mock;
  };
  let listener: DeliveryMissionEventsListener;

  beforeEach(() => {
    deliveryService = {
      markMissionPlanned: jest.fn().mockResolvedValue(undefined),
      markDroneDispatched: jest.fn().mockResolvedValue(undefined),
      markInTransit: jest.fn().mockResolvedValue(undefined),
      markDeliveredPendingVerification: jest.fn().mockResolvedValue(undefined),
      markReturnedToHubFromMission: jest.fn().mockResolvedValue(undefined),
    };
    listener = new DeliveryMissionEventsListener(deliveryService as unknown as DeliveryService);
  });

  it("routes each mission event to the matching DeliveryService transition", async () => {
    await listener.onMissionCreated({ missionId: "m1", deliveryId: "d1" });
    expect(deliveryService.markMissionPlanned).toHaveBeenCalledWith("d1");

    await listener.onMissionStarted({ missionId: "m1", deliveryId: "d1" });
    expect(deliveryService.markDroneDispatched).toHaveBeenCalledWith("d1");

    await listener.onMissionProgressed({ missionId: "m1", deliveryId: "d1" });
    expect(deliveryService.markInTransit).toHaveBeenCalledWith("d1");

    await listener.onMissionCompleted({ missionId: "m1", deliveryId: "d1" });
    expect(deliveryService.markDeliveredPendingVerification).toHaveBeenCalledWith("d1");

    await listener.onMissionAborted({ missionId: "m1", deliveryId: "d1", reason: "Low battery" });
    expect(deliveryService.markReturnedToHubFromMission).toHaveBeenCalledWith("d1", "Low battery");
  });
});
