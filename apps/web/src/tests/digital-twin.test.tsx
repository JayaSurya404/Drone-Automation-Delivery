import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { DigitalTwinCockpit } from "../features/admin/digital-twin-cockpit.js";

describe("Digital Twin Cockpit UI Component Tests", () => {
  it("renders DigitalTwinCockpit with synchronized operations hub and fleet metrics", () => {
    const html = renderToString(<DigitalTwinCockpit />);
    assert.ok(html.includes("Digital Twin Synchronized Operations Hub"));
    assert.ok(html.includes("SYNCHRONIZED TWIN"));
    assert.ok(html.includes("DIGITAL TWIN OBSERVATION"));
    assert.ok(html.includes("Total Drones"));
    assert.ok(html.includes("In-Flight / Active"));
    assert.ok(html.includes("Avg Battery"));
    assert.ok(html.includes("Telemetry Live"));
    assert.ok(html.includes("Reconciliation Alerts"));
  });

  it("renders UAV state twins table with live kinematics and telemetry freshness", () => {
    const html = renderToString(<DigitalTwinCockpit />);
    assert.ok(html.includes("Synchronized UAV State Twins"));
    assert.ok(html.includes("SKY-001"));
    assert.ok(html.includes("EN_ROUTE"));
    assert.ok(html.includes("LIVE"));
    assert.ok(html.includes("HEALTHY"));
  });

  it("renders reconciliation and diagnostic inconsistencies when issues exist", () => {
    const customHealth = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      overallStatus: "CRITICAL" as const,
      totalDronesTracked: 1,
      totalMissionsTracked: 1,
      activeDiscrepanciesCount: 1,
      issues: [
        {
          code: "ALTITUDE_ANOMALY",
          message: "[SKY-001] Status is DELIVERING but altitude is 85m",
          severity: "CRITICAL" as const,
          timestamp: new Date().toISOString()
        }
      ],
      evaluatedAt: new Date().toISOString()
    };

    const html = renderToString(<DigitalTwinCockpit health={customHealth} />);
    assert.ok(html.includes("Reconciliation &amp; Diagnostic Inconsistencies") || html.includes("Reconciliation & Diagnostic Inconsistencies"));
    assert.ok(html.includes("ALTITUDE_ANOMALY") || html.includes("Status is DELIVERING but altitude is 85m"));
    assert.ok(html.includes("CRITICAL"));
  });
});
