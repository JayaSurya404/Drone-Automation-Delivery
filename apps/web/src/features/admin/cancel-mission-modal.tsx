"use client";

import React, { useState } from "react";
import { Modal, Button, AlertTriangleIcon, Input } from "@skynav/ui";

export interface CancelMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionCode: string;
  missionId: string;
  droneCallsign?: string | null;
  onConfirm: (reason: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function CancelMissionModal({
  isOpen,
  onClose,
  missionCode,
  missionId,
  droneCallsign,
  onConfirm,
  isLoading = false
}: CancelMissionModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      setError("Cancellation reason is required (minimum 3 characters).");
      return;
    }
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to cancel mission.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cancel Mission — ${missionCode}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-4 flex gap-3 text-amber-200 text-xs leading-relaxed">
          <AlertTriangleIcon className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-amber-300 mb-1">Mission Abort Notice</p>
            <p>
              Cancelling mission <strong className="text-white font-mono">{missionCode}</strong> will update the linked order to <span className="text-rose-300 font-bold">CANCELLED</span>.
              {droneCallsign && (
                <> The assigned UAV (<strong className="text-white font-mono">{droneCallsign}</strong>) will be commanded to Return-To-Home safely.</>
              )}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Cancellation Reason <span className="text-rose-400">*</span>
          </label>
          <Input
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Customer requested immediate cancellation / Airspace closure"
            required
            autoFocus
            className="w-full text-xs"
          />
          {error && <p className="text-rose-400 text-xs mt-1.5">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Keep Mission
          </Button>
          <Button variant="destructive" size="sm" type="submit" isLoading={isLoading}>
            Confirm Cancellation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
