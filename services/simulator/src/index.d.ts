/** Digital-twin boundary: this service emits simulated telemetry only; it never controls flight hardware. */
export type SimulationState = "IDLE" | "TAKEOFF" | "EN_ROUTE" | "ARRIVED" | "DELIVERING" | "RETURNING" | "EMERGENCY";
export interface SimulatorAdapter {
    registerDrone(droneId: string): Promise<void>;
    startMission(missionId: string): Promise<void>;
}
export declare const simulatorService = "simulator";
//# sourceMappingURL=index.d.ts.map