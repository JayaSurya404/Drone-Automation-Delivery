import React, { useState } from 'react';
import { CustomerAddress, GeofenceCheckResult } from '../../types/address';
import { LocationPickerMap } from '../map/LocationPickerMap';
import { GeofenceChecker } from '../map/GeofenceChecker';
import { Button } from '../common/Button';
import { TreePine, Building, Shield, Car, Check } from 'lucide-react';

interface LocationStepProps {
  address: CustomerAddress;
  onLocationConfirmed: (lat: number, lng: number, dropZoneType: string) => void;
  onBack: () => void;
}

const DROP_ZONES = [
  { id: 'Lawn', label: 'Backyard / Lawn', desc: 'Unobstructed grass landing area', icon: <TreePine size={20} /> },
  { id: 'Rooftop Pad', label: 'Rooftop Landing Pad', desc: 'Commercial or residential flat roof', icon: <Building size={20} /> },
  { id: 'Driveway', label: 'Private Driveway', desc: 'Flat concrete or paved surface', icon: <Car size={20} /> },
  { id: 'Balcony Landing', label: 'Spacious Balcony', desc: 'Minimum 2.5m clearance', icon: <Shield size={20} /> },
];

export const LocationStep: React.FC<LocationStepProps> = ({
  address,
  onLocationConfirmed,
  onBack,
}) => {
  const [lat, setLat] = useState<number>(address.latitude || 37.7749);
  const [lng, setLng] = useState<number>(address.longitude || -122.4194);
  const [selectedDropZone, setSelectedDropZone] = useState<string>(address.dropZoneType || 'Lawn');
  const [eligibility, setEligibility] = useState<GeofenceCheckResult | null>(null);

  const handleNext = () => {
    onLocationConfirmed(lat, lng, selectedDropZone);
  };

  return (
    <div>
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem' }}>
        <div>
          <h3 className="card-title">2. Set Precision Drone Drop-off Zone</h3>
          <p className="section-subtitle">
            Autonomous drones need an accurate GPS coordinate and designated 2.5m clearance zone.
          </p>
        </div>
      </div>

      {/* Geofence Verification Status Box */}
      <GeofenceChecker
        latitude={lat}
        longitude={lng}
        onEligibilityChecked={(res) => setEligibility(res)}
      />

      {/* Interactive Pin Dropper Map */}
      <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
        <LocationPickerMap
          initialLat={lat}
          initialLng={lng}
          onLocationChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
          height="380px"
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
                  border: isSelected ? '2px solid var(--accent-cyan)' : '2px solid var(--border-default)',
                  background: isSelected ? 'rgba(0, 229, 255, 0.06)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                    {zone.icon}
                  </span>
                  {isSelected && <Check size={16} color="var(--accent-cyan)" />}
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

      {/* Buttons */}
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
          Confirm Drop Zone & Continue &rarr;
        </Button>
      </div>
    </div>
  );
};
