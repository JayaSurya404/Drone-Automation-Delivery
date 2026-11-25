import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { Settings, Sliders, Shield, Bell, Bot, ShoppingBag, Save } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'delivery' | 'drone' | 'safety' | 'notifications'>('general');

  // General Settings State
  const [platformName, setPlatformName] = useState('SkyNav Autonomous Delivery');
  const [timezone, setTimezone] = useState('UTC-07:00 (Pacific Standard Time)');
  const [currency, setCurrency] = useState('USD ($)');

  // Delivery Settings State
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('15.0');
  const [baseDeliveryFee, setBaseDeliveryFee] = useState('12.50');

  // Drone Safety Threshold State
  const [maxPayloadKg, setMaxPayloadKg] = useState('8.5');
  const [minBatteryThreshold, setMinBatteryThreshold] = useState('20');
  const [emergencyBatteryThreshold, setEmergencyBatteryThreshold] = useState('10');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addToast('success', 'Settings Saved', 'Platform operational parameters updated successfully.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan-400" /> Platform Operational Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure safety thresholds, delivery radius, drone hardware limits, and system parameters
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800 gap-4 text-xs font-bold text-slate-400">
        {[
          { key: 'general', label: 'General System' },
          { key: 'delivery', label: 'Delivery Rules' },
          { key: 'drone', label: 'Drone Hardware' },
          { key: 'safety', label: 'Safety & Emergency' },
          { key: 'notifications', label: 'Alert Dispatch' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-2.5 transition-colors ${
              activeTab === tab.key ? 'text-cyan-400 border-b-2 border-cyan-400' : 'hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form Body */}
      <form onSubmit={handleSave} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md space-y-6">
        {activeTab === 'general' && (
          <div className="space-y-4 text-xs text-slate-200 max-w-lg">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Platform Brand Name</label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Default Operations Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="space-y-4 text-xs text-slate-200 max-w-lg">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Maximum Autonomous Delivery Radius (km)</label>
              <input
                type="number"
                value={deliveryRadiusKm}
                onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Base Flight Dispatch Fee ($)</label>
              <input
                type="number"
                value={baseDeliveryFee}
                onChange={(e) => setBaseDeliveryFee(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="space-y-4 text-xs text-slate-200 max-w-lg">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Minimum Mission Dispatch Battery Threshold (%)</label>
              <input
                type="number"
                value={minBatteryThreshold}
                onChange={(e) => setMinBatteryThreshold(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Emergency Trigger Battery Threshold (%)</label>
              <input
                type="number"
                value={emergencyBatteryThreshold}
                onChange={(e) => setEmergencyBatteryThreshold(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-bold text-rose-400"
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xl shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500"
          >
            <Save className="h-4 w-4" /> Save System Settings
          </button>
        </div>
      </form>
    </div>
  );
};
