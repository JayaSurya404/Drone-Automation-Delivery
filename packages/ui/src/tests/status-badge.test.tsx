import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { DroneStatusBadge, OrderStatusBadge, MissionStatusBadge } from "../primitives/status-badge.js";
import { BatteryIndicator } from "../domain/battery-indicator.js";
import { MapView } from "../map/map-view.js";

describe("UI Design System / Domain Statuses & Map", () => {
  it("renders DroneStatusBadge for all flight states", () => {
    const states = [
      { state: "IDLE", label: "Idle / Ground" },
      { state: "TAKEOFF", label: "Ascending" },
      { state: "EN_ROUTE", label: "En Route" },
      { state: "ARRIVED", label: "At Destination" },
      { state: "DELIVERING", label: "Delivering Drop" },
      { state: "RETURNING", label: "Returning to Base" },
      { state: "LANDED", label: "Landed Complete" },
      { state: "EMERGENCY", label: "Emergency Hold" }
    ];

    for (const { state, label } of states) {
      const html = renderToString(<DroneStatusBadge status={state} />);
      assert.ok(html.includes(label), `Expected ${state} badge to render '${label}'`);
    }
  });

  it("renders OrderStatusBadge and MissionStatusBadge", () => {
    const orderHtml = renderToString(<OrderStatusBadge status="IN_TRANSIT" />);
    assert.ok(orderHtml.includes("In Flight"));

    const missionHtml = renderToString(<MissionStatusBadge status="AUTHORIZED" />);
    assert.ok(missionHtml.includes("Authorized"));
  });

  it("renders BatteryIndicator with color shifts across thresholds", () => {
    const fullHtml = renderToString(<BatteryIndicator percent={95} voltage={25.1} />);
    assert.ok(fullHtml.includes("95%"));
    assert.ok(fullHtml.includes("25.1"));
    assert.ok(fullHtml.includes("bg-emerald-400"));

    const criticalHtml = renderToString(<BatteryIndicator percent={12} />);
    assert.ok(criticalHtml.includes("12%"));
    assert.ok(criticalHtml.includes("bg-red-500"));
  });

  it("renders MapView with radar markers and routes", () => {
    const markers = [
      {
        id: "drone-1",
        type: "drone" as const,
        latitude: 37.7749,
        longitude: -122.4194,
        headingDegrees: 45,
        title: "SKY-001"
      }
    ];

    const routes = [
      {
        id: "route-1",
        coordinates: [
          { latitude: 37.7749, longitude: -122.4194 },
          { latitude: 37.7780, longitude: -122.4194 }
        ]
      }
    ];

    const mapHtml = renderToString(<MapView markers={markers} routes={routes} title="Tactical Radar" />);
    assert.ok(mapHtml.includes("Tactical Radar"));
    assert.ok(mapHtml.includes("SKY-001"));
    assert.ok(mapHtml.includes("tacticalGrid"));
  });
});
