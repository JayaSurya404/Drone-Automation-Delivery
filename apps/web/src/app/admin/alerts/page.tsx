"use client";

import React, { useState } from "react";
import {
  AlertCard,
  Card,
  Tabs,
  Button,
  AlertTriangleIcon,
  CheckCircleIcon
} from "@skynav/ui";
import { DEMO_ALERTS } from "@/lib/demo-data";

export default function AdminAlertsPage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [alerts, setAlerts] = useState(DEMO_ALERTS);

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  const filtered = alerts.filter((a) => {
    if (activeTab === "UNACKNOWLEDGED") return !a.acknowledged;
    if (activeTab === "CRITICAL") return a.severity === "CRITICAL";
    if (activeTab === "WARNING") return a.severity === "WARNING";
    return true;
  });

  const tabs = [
    { id: "ALL", label: "All Incidents", count: alerts.length },
    { id: "UNACKNOWLEDGED", label: "Pending Review", count: alerts.filter((a) => !a.acknowledged).length },
    { id: "CRITICAL", label: "Critical Failsafes", count: alerts.filter((a) => a.severity === "CRITICAL").length },
    { id: "WARNING", label: "Advisories", count: alerts.filter((a) => a.severity === "WARNING").length }
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Airspace & Flight Incident Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time geofence proximity alerts, critical battery failsafe triggers, and weather warnings.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })))}
        >
          Acknowledge All
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              id={alert.id}
              severity={alert.severity}
              title={alert.title}
              message={alert.message}
              timestamp={alert.timestamp}
              droneId={alert.droneId}
              missionId={alert.missionId}
              onAcknowledge={!alert.acknowledged ? () => handleAcknowledge(alert.id) : undefined}
            />
          ))
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-800">
            Zero active incidents matching the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
