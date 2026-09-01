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
  Textarea,
  Switch,
  UserIcon,
  MapPinIcon,
  CheckCircleIcon,
  ShieldIcon
} from "@skynav/ui";
import { useAuth } from "@/features/auth/auth-context";

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [instructions, setInstructions] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const displayName = user?.name || "Customer Account";
  const displayEmail = user?.email || "";
  const displayOrg = user?.organizationName || "SkyNav Network";

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Customer Profile & Verified Landing Pads
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your account credentials, verified landing pads, and drop safety instructions.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Account Details */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Your verified recipient identity for SkyNav autonomous drops.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500">Account Name:</span>
              <p className="text-slate-900 dark:text-white font-bold mt-0.5">{displayName}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500">Email Address:</span>
              <p className="text-slate-900 dark:text-white font-bold mt-0.5">{displayEmail}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500">Account Role:</span>
              <p className="text-cyan-600 dark:text-cyan-400 font-bold mt-0.5">{user?.role || "CUSTOMER"}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-500">Fleet Organization:</span>
              <p className="text-slate-900 dark:text-white font-bold mt-0.5">{displayOrg}</p>
            </div>
          </CardContent>
        </Card>

        {/* Primary Landing Pad Location */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Designated Landing Zone & Drop Instructions</CardTitle>
            <CardDescription>Exact rooftop or yard coordinates used by flight navigation algorithms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Street Address"
                  placeholder="e.g. 500 Howard St, Floor 4 Rooftop Pad"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Postal Code"
                  placeholder="94105"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
            </div>

            <Textarea
              label="Drop Zone Visual Landmarks & Obstacles"
              placeholder="e.g. Rooftop helipad marked with green LED perimeter lighting. Clear of overhead wires within 15m radius."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </CardContent>
          <CardFooter className="justify-between">
            {saved ? (
              <span className="text-xs text-emerald-500 flex items-center gap-1.5 font-medium">
                <CheckCircleIcon size={16} />
                Profile preferences saved successfully!
              </span>
            ) : (
              <div />
            )}
            <Button type="submit" variant="primary">
              Save Preferences
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
