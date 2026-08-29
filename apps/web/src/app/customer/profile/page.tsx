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
  MapPinIcon,
  UserIcon,
  ShieldIcon,
  CheckCircleIcon
} from "@skynav/ui";

export default function CustomerProfilePage() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Customer Profile & Landing Pads</h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your verified drone drop locations, safety instructions, and alert preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Account Details */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Your verified recipient identity for SkyNav autonomous drops.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" defaultValue="Dr. Evelyn Reed" />
            <Input label="Email Address" defaultValue="evelyn.reed@biomedlabs.test" type="email" />
            <Input label="Phone (SMS Drop Codes)" defaultValue="+1 (415) 555-0192" />
            <Input label="Organization / Hospital" defaultValue="San Francisco Biomedical Institute" />
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
                <Input label="Street Address" defaultValue="742 Montgomery St, Floor 4 Rooftop Pad" />
              </div>
              <div>
                <Input label="Postal Code" defaultValue="94111" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Latitude (WGS84)" defaultValue="37.795200" />
              <Input label="Longitude (WGS84)" defaultValue="-122.402800" />
            </div>

            <Textarea
              label="Drop Zone Visual Landmarks & Obstacles"
              defaultValue="Rooftop helipad marked with green LED perimeter lighting. Clear of overhead wires within 15m radius."
            />
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Flight Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Switch label="SMS Departure & ETA Alerts" description="Receive text messages when drone ascends from depot" defaultChecked />
            <Switch label="Critical Weather & Corridor Reroute Alerts" description="Immediate notifications if headwind causes flight delay" defaultChecked />
            <Switch label="Require 4-digit OTP for Payload Release" description="Drone holds at 2m until physical code confirmation" defaultChecked />
          </CardContent>
          <CardFooter className="justify-between">
            {saved ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircleIcon size={16} />
                Profile preferences saved successfully!
              </span>
            ) : (
              <div />
            )}
            <Button type="submit" variant="primary" size="md">
              Save Preferences
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
