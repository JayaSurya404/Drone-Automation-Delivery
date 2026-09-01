import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { Button } from "../primitives/button.js";
import { Badge } from "../primitives/badge.js";
import { Card, CardTitle } from "../primitives/card.js";
import { Alert } from "../primitives/alert.js";

describe("UI Design System / Primitives", () => {
  it("renders Button with primary and glass variants", () => {
    const primaryHtml = renderToString(<Button variant="primary">Launch Mission</Button>);
    assert.ok(primaryHtml.includes("Launch Mission"));
    assert.ok(primaryHtml.includes("bg-blue-600"));

    const glassHtml = renderToString(<Button variant="glass">HUD Action</Button>);
    assert.ok(glassHtml.includes("HUD Action"));
    assert.ok(glassHtml.includes("backdrop-blur-md"));
  });

  it("renders Badge with pulse dot and status variant", () => {
    const badgeHtml = renderToString(
      <Badge variant="success" dot pulse>
        In Flight
      </Badge>
    );
    assert.ok(badgeHtml.includes("In Flight"));
    assert.ok(badgeHtml.includes("animate-ping"));
    assert.ok(badgeHtml.includes("text-emerald-400"));
  });

  it("renders Card with glass and hud variants", () => {
    const cardHtml = renderToString(
      <Card variant="hud">
        <CardTitle>SKY-001</CardTitle>
      </Card>
    );
    assert.ok(cardHtml.includes("SKY-001"));
    assert.ok(cardHtml.includes("border-cyan-500/30"));
  });

  it("renders Alert with semantic warning and error variants", () => {
    const alertHtml = renderToString(
      <Alert variant="warning" title="Geofence Caution">
        UAV approaching restricted boundary.
      </Alert>
    );
    assert.ok(alertHtml.includes("Geofence Caution"));
    assert.ok(alertHtml.includes("UAV approaching restricted boundary."));
    assert.ok(alertHtml.includes("border-amber-500/30"));
  });
});
