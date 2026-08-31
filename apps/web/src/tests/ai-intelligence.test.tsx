import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { AiRouteScoringCard } from "../features/admin/ai-route-scoring-card.js";
import { PredictiveMaintenanceCard } from "../features/admin/predictive-maintenance-card.js";

describe("AI Advisory & Predictive Intelligence UI Components", () => {
  it("renders AiRouteScoringCard with advisory disclaimer and candidate routes", () => {
    const html = renderToString(<AiRouteScoringCard />);
    assert.ok(html.includes("AI Advisory Flight Scorer"));
    assert.ok(html.includes("ADVISORY ONLY"));
    assert.ok(html.includes("SAFETY RULE"));
    assert.ok(html.includes("Direct Flight Corridor Alpha") || html.includes("Candidate"));
    assert.ok(html.includes("94.5/100") || html.includes("Score"));
    assert.ok(html.includes("SAFE"));
  });

  it("renders PredictiveMaintenanceCard with component breakdown and risk indicators", () => {
    const html = renderToString(<PredictiveMaintenanceCard />);
    assert.ok(html.includes("Predictive UAV Health"));
    assert.ok(html.includes("AI DIAGNOSTICS"));
    assert.ok(html.includes("BATTERY"));
    assert.ok(html.includes("MOTORS"));
    assert.ok(html.includes("AIRFRAME"));
    assert.ok(html.includes("AVIONICS"));
    assert.ok(html.includes("NORMAL"));
  });
});
