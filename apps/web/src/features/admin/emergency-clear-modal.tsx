"use client";

import React, { useState } from "react";
import { Modal, Button, CheckCircleIcon, Input } from "@skynav/ui";

export interface EmergencyClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  droneCallsign: string;
  droneId: string;
  onConfirm: (reason: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function EmergencyClearModal({
  isOpen,
  onClose,
  droneCallsign,
  droneId,
  onConfirm,
  isLoading = false
}: EmergencyClearModalProps) {
  const [reason, setReason] = useState("Maintenance and field safety inspection completed");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to clear Emergency status.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Clear Emergency State — ${droneCallsign}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-4 flex gap-3 text-emerald-200 text-xs leading-relaxed">
          <CheckCircleIcon className="text-emerald-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-emerald-300 mb-1">Operational Reset Protocol</p>
            <p>
              Clearing emergency condition will re-enable <strong className="text-white font-mono">{droneCallsign}</strong> and reset its operational status to <span className="text-cyan-300 font-bold">IDLE / AVAILABLE</span> for future dispatch.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Clearance Verification Notes
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Mechanical inspection cleared, battery recharged"
            className="w-full text-xs"
          />
          {error && <p className="text-rose-400 text-xs mt-1.5">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            Confirm & Reset UAV
          </Button>
        </div>
      </form>
    </Modal>
  );
}
