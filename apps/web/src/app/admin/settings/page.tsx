"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Select,
  Switch,
  CheckCircleIcon,
  WarehouseIcon,
  ShieldIcon,
  SlidersIcon
} from "@skynav/ui";
import { DEMO_WAREHOUSE } from "@/lib/demo-data";

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Depot & Airspace Safety Configuration</h2>
        <p className="text-xs text-slate-400 mt-1">
          Operational flight envelope limits, geofence safety margins, and simulator clock multipliers.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Depot Base Location */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Launch Depot Coordinates & Origin</CardTitle>
            <CardDescription>Primary dispatch hub for all autonomous delivery UAV flights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Hub Designation Name" defaultValue={DEMO_WAREHOUSE.name} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Depot Latitude (WGS84)" defaultValue={DEMO_WAREHOUSE.latitude.toString()} />
              <Input label="Depot Longitude (WGS84)" defaultValue={DEMO_WAREHOUSE.longitude.toString()} />
            </div>
          </CardContent>
        </Card>

        {/* Flight Envelope Safety Thresholds */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Deterministic Safety & Battery Failsafes</CardTitle>
            <CardDescription>Immutable safety constraints validated before every mission dispatch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Cruise Speed Limit (m/s)" defaultValue="15.0" type="number" step="0.5" />
              <Input label="Max Cruise Altitude (m AGL)" defaultValue="60.0" type="number" />
              <Input label="Delivery Drop Altitude (m)" defaultValue="2.0" type="number" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Low Battery Warning Threshold (%)" defaultValue="25" type="number" />
              <Input label="Critical Battery Auto-RTH (%)" defaultValue="15" type="number" />
            </div>

            <div className="pt-2 space-y-3">
              <Switch
                label="Enforce Mandatory Human Operator Authorization"
                description="AI route optimizer generates recommendations, but cannot dispatch without operator sign-off"
                defaultChecked
              />
              <Switch
                label="Strict Geofence Buffer Validation (50m safety margin)"
                description="Automatically reject flight corridors traversing active temporary flight restrictions"
                defaultChecked
              />
            </div>
          </CardContent>
        </Card>

        {/* Simulator Acceleration */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Digital Twin Simulator Clock Multiplier</CardTitle>
            <CardDescription>Controls tick acceleration factor for development and scenario stress testing.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              label="Simulation Speed Multiplier"
              defaultValue="1.0"
              options={[
                { value: "1.0", label: "1.0x (Realtime 1s = 1s)" },
                { value: "2.0", label: "2.0x (Accelerated Testing)" },
                { value: "5.0", label: "5.0x (High-Speed Stress)" },
                { value: "10.0", label: "10.0x (Fast Batch Evaluation)" }
              ]}
            />
          </CardContent>
          <CardFooter className="justify-between">
            {saved ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircleIcon size={16} />
                Safety parameters committed to platform!
              </span>
            ) : (
              <div />
            )}
            <Button type="submit" variant="primary" size="md">
              Save Configuration
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
