import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { ReturnToHomeModal } from "../features/admin/rth-modal.js";
import { EmergencyHaltModal } from "../features/admin/emergency-modal.js";
import { EmergencyClearModal } from "../features/admin/emergency-clear-modal.js";
import { CancelMissionModal } from "../features/admin/cancel-mission-modal.js";
import { EmergencyBanner } from "../features/admin/emergency-banner.js";

describe("Admin Operations & Emergency Controls UI", () => {
  it("renders ReturnToHomeModal with drone callsign and advisory text", () => {
    const html = renderToString(
      <ReturnToHomeModal
        isOpen={true}
        onClose={() => {}}
        droneCallsign="SKY-001"
        droneId="drone-1"
        currentAltitude={60}
        batteryPercent={85}
        onConfirm={() => {}}
      />
    );
    assert.ok(html.includes("Return-To-Home"));
    assert.ok(html.includes("SKY-001"));
    assert.ok(html.includes("60 m"));
    assert.ok(html.includes("85%"));
  });

  it("renders EmergencyHaltModal with mandatory reason prompt and emergency styling", () => {
    const html = renderToString(
      <EmergencyHaltModal
        isOpen={true}
        onClose={() => {}}
        droneCallsign="SKY-002"
        droneId="drone-2"
        currentAltitude={45}
        onConfirm={() => {}}
      />
    );
    assert.ok(html.includes("Emergency Halt"));
    assert.ok(html.includes("SKY-002"));
    assert.ok(html.includes("FAILSAFE OVERRIDE") || html.includes("EMERGENCY"));
  });

  it("renders EmergencyClearModal with reset verification", () => {
    const html = renderToString(
      <EmergencyClearModal
        isOpen={true}
        onClose={() => {}}
        droneCallsign="SKY-003"
        droneId="drone-3"
        onConfirm={() => {}}
      />
    );
    assert.ok(html.includes("Clear Emergency"));
    assert.ok(html.includes("SKY-003"));
    assert.ok(html.includes("Operational Reset Protocol") || html.includes("Reset"));
  });

  it("renders CancelMissionModal with mission code and reason input", () => {
    const html = renderToString(
      <CancelMissionModal
        isOpen={true}
        onClose={() => {}}
        missionCode="MIS-401"
        missionId="mis-1"
        droneCallsign="SKY-001"
        onConfirm={() => {}}
      />
    );
    assert.ok(html.includes("Cancel Mission"));
    assert.ok(html.includes("MIS-401"));
    assert.ok(html.includes("SKY-001"));
  });

  it("renders EmergencyBanner when emergency drones exist and hides when empty", () => {
    const emptyHtml = renderToString(<EmergencyBanner emergencyDrones={[]} />);
    assert.equal(emptyHtml, "");

    const activeHtml = renderToString(
      <EmergencyBanner
        emergencyDrones={[
          { id: "drone-1", callsign: "SKY-001", reason: "Motor failure" }
        ]}
      />
    );
    assert.ok(activeHtml.includes("ACTIVE UAV EMERGENCY INCIDENT DETECTED"));
    assert.ok(activeHtml.includes("SKY-001"));
  });
});
