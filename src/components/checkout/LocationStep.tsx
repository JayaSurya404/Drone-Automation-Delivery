import React, { useState } from 'react';
import { CustomerAddress, GeofenceCheckResult } from '../../types/address';
import { ClearanceRadiusOption, OverheadHazardChecklist } from '../../types/airspace';
import { LocationPickerMap } from '../map/LocationPickerMap';
import { GeofenceChecker } from '../map/GeofenceChecker';
import { ClearanceRadiusSelector } from '../map/ClearanceRadiusSelector';
import { Button } from '../common/Button';
import { TreePine, Building, Shield, Car, Check } from 'lucide-react';

interface LocationStepProps {
  address: CustomerAddress;
  initialClearanceRadius?: ClearanceRadiusOption;
  onLocationConfirmed: (lat: number, lng: number, dropZoneType: string, clearanceRadius?: ClearanceRadiusOption) => void;
  onBack: () => void;
}

const DROP_ZONES = [
  { id: 'Lawn', label: 'Backyard / Lawn', desc: 'Unobstructed grass landing area', icon: <TreePine size={20} /> },
  { id: 'Rooftop Pad', label: 'Rooftop Landing Pad', desc: 'Commercial or residential flat roof', icon: <Building size={20} /> },
  { id: 'Driveway', label: 'Private Driveway', desc: 'Flat concrete or paved surface', icon: <Car size={20} /> },
  { id: 'Balcony Landing', label: 'Spacious Balcony', desc: 'Minimum 2.0m tether clearance', icon: <Shield size={20} /> },
];

export const LocationStep: React.FC<LocationStepProps> = ({
  address,
  initialClearanceRadius = 3.5,
  onLocationConfirmed,
  onBack,
}) => {
  const [lat, setLat] = useState<number>(address.latitude || 37.7749);
  const [lng, setLng] = useState<number>(address.longitude || -122.4194);
  const [selectedDropZone, setSelectedDropZone] = useState<string>(address.dropZoneType || 'Lawn');
  const [clearanceRadius, setClearanceRadius] = useState<ClearanceRadiusOption>(
    ((address.clearanceRadiusMeters as any) || initialClearanceRadius) as ClearanceRadiusOption
  );
  const [hazardsChecklist, setHazardsChecklist] = useState<OverheadHazardChecklist>({
    noWires: true,
    levelGround: true,
    clearSkyView: true,
    petsProtected: true,
  });
  const [eligibility, setEligibility] = useState<GeofenceCheckResult | null>(null);

  const handleNext = () => {
    onLocationConfirmed(lat, lng, selectedDropZone, clearanceRadius);
  };

  return (
    <div>
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem' }}>
        <div>
          <h3 className="card-title">2. Set Precision Drone Drop-off Zone & Airspace Clearance</h3>
          <p className="section-subtitle">
            Every autonomous flight is validated against FAA No-Fly Zones, hospital corridors, and requires verified landing clearance.
          </p>
        </div>
      </div>

      {/* Geofence & Airspace Verification Status Box */}
      <div style={{ marginBottom: '1rem' }}>
        <GeofenceChecker
          latitude={lat}
          longitude={lng}
          clearanceRadiusMeters={clearanceRadius}
          onEligibilityChecked={(res) => setEligibility(res)}
        />
      </div>

      {/* Interactive Pin Dropper Map with NFZ overlays & Clearance Ring */}
      <div style={{ marginBottom: '1.5rem' }}>
        <LocationPickerMap
          initialLat={lat}
          initialLng={lng}
          clearanceRadius={clearanceRadius}
          isEligible={eligibility ? eligibility.isEligible : true}
          onLocationChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
          height="380px"
        />
      </div>

      {/* Clearance Radius & Overhead Safety Audit */}
      <div style={{ marginBottom: '1.75rem' }}>
        <ClearanceRadiusSelector
          selectedRadius={clearanceRadius}
          onRadiusChange={(radius) => setClearanceRadius(radius)}
          checklist={hazardsChecklist}
          onChecklistChange={(list) => setHazardsChecklist(list)}
        />
      </div>

      {/* Drop Zone Type Selection */}
      <div style={{ marginBottom: '2rem' }}>
        <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
          Select Landing Terrain Type:
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {DROP_ZONES.map((zone) => {
            const isSelected = selectedDropZone === zone.id;

            return (
              <div
                key={zone.id}
                onClick={() => setSelectedDropZone(zone.id)}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid var(--accent-cyan)' : '1.5px solid var(--border-default)',
                  background: isSelected ? 'rgba(14, 165, 233, 0.08)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: isSelected ? 'var(--accent-blue, #0284c7)' : 'var(--text-secondary)' }}>
                    {zone.icon}
                  </span>
                  {isSelected && <Check size={16} color="var(--accent-blue, #0284c7)" />}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {zone.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                  {zone.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="ghost" onClick={onBack}>
          &larr; Back
        </Button>

        <Button
          variant="primary"
          size="lg"
          disabled={!eligibility?.isEligible}
          onClick={handleNext}
        >
          {eligibility && !eligibility.isEligible ? 'Airspace Prohibited' : 'Confirm Drop Zone & Continue →'}
        </Button>
      </div>
    </div>
  );
};
