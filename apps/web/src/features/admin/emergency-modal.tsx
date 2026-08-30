"use client";

import React, { useState } from "react";
import { Modal, Button, AlertTriangleIcon, Input } from "@skynav/ui";

export interface EmergencyHaltModalProps {
  isOpen: boolean;
  onClose: () => void;
  droneCallsign: string;
  droneId: string;
  currentAltitude?: number;
  onConfirm: (reason: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function EmergencyHaltModal({
  isOpen,
  onClose,
  droneCallsign,
  droneId,
  currentAltitude,
  onConfirm,
  isLoading = false
}: EmergencyHaltModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      setError("Emergency reason is strictly required (minimum 3 characters).");
      return;
    }
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to execute Emergency command.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`CRITICAL: Emergency Halt / Land Command — ${droneCallsign}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-rose-950/60 border border-rose-500 rounded-lg p-4 flex gap-3 text-rose-200 text-xs leading-relaxed animate-pulse">
          <AlertTriangleIcon className="text-rose-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-rose-300 text-sm mb-1">EMERGENCY FAILSAFE OVERRIDE</p>
            <p>
              Executing this command will immediately disarm standard mission autonomy for <strong className="text-white font-mono">{droneCallsign}</strong> and force an emergency vertical descent / touchdown.
            </p>
            <p className="mt-2 text-rose-400 font-medium">
              This action will be logged in the immutable system audit trail and notify all regional operators.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-rose-300 mb-1.5">
            Mandatory Emergency Justification Reason <span className="text-rose-400">*</span>
          </label>
          <Input
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Rotor vibration telemetry anomaly / Airspace conflict detected"
            required
            autoFocus
            className="w-full text-xs border-rose-700/60 focus:border-rose-500"
          />
          {error && <p className="text-rose-400 text-xs mt-1.5 font-medium">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Abort Action
          </Button>
          <Button variant="destructive" size="sm" type="submit" isLoading={isLoading}>
            EXECUTE EMERGENCY HALT
          </Button>
        </div>
      </form>
    </Modal>
  );
}
