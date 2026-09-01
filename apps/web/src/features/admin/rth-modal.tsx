"use client";

import React, { useState } from "react";
import { Modal, Button, AlertTriangleIcon, Input } from "@skynav/ui";

export interface ReturnToHomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  droneCallsign: string;
  droneId: string;
  currentAltitude?: number;
  batteryPercent?: number;
  onConfirm: (reason: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function ReturnToHomeModal({
  isOpen,
  onClose,
  droneCallsign,
  droneId,
  currentAltitude,
  batteryPercent,
  onConfirm,
  isLoading = false
}: ReturnToHomeModalProps) {
  const [reason, setReason] = useState("Operator commanded Return-To-Home");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      setError("Please specify a reason (at least 3 characters).");
      return;
    }
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to issue Return-To-Home command.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Command Return-To-Home (RTH) — ${droneCallsign}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-4 flex gap-3 text-amber-200 text-xs leading-relaxed">
          <AlertTriangleIcon className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-amber-300 mb-1">Return-To-Home Protocol Advisory</p>
            <p>
              Initiating RTH will command <strong className="text-white font-mono">{droneCallsign}</strong> to abort its active waypoint navigation and follow the safest return corridor back to Depot Alpha.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400">Current Altitude:</span>
            <p className="font-mono text-cyan-400 font-bold">{currentAltitude !== undefined ? `${currentAltitude.toFixed(0)} m` : "Active in-flight"}</p>
          </div>
          <div>
            <span className="text-slate-400">Battery Level:</span>
            <p className="font-mono text-cyan-400 font-bold">{batteryPercent !== undefined ? `${batteryPercent}%` : "Nominal"}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Operational Reason / Justification <span className="text-rose-400">*</span>
          </label>
          <Input
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Inclement weather / High wind warning"
            required
            className="w-full text-xs"
          />
          {error && <p className="text-rose-400 text-xs mt-1.5">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            Confirm RTH Command
          </Button>
        </div>
      </form>
    </Modal>
  );
}
