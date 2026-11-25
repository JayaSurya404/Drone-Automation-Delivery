import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { GeofenceCheckResult } from '../../types/address';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ShieldAlert, Navigation } from 'lucide-react';

interface GeofenceCheckerProps {
  latitude: number;
  longitude: number;
  clearanceRadiusMeters?: number;
  onEligibilityChecked?: (result: GeofenceCheckResult) => void;
}

export const GeofenceChecker: React.FC<GeofenceCheckerProps> = ({
  latitude,
  longitude,
  clearanceRadiusMeters = 3.5,
  onEligibilityChecked,
}) => {
  const [checking, setChecking] = useState<boolean>(true);
  const [result, setResult] = useState<GeofenceCheckResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    setChecking(true);

    api.geofence
      .checkEligibility(latitude, longitude, clearanceRadiusMeters)
      .then((res: GeofenceCheckResult) => {
        if (isMounted) {
          setResult(res);
          setChecking(false);
          if (onEligibilityChecked) {
            onEligibilityChecked(res);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          const fallback: GeofenceCheckResult = {
            isEligible: false,
            status: 'Temporarily Unavailable',
            airspaceStatus: 'OUT_OF_SERVICE_RADIUS',
            distanceFromHubKm: 0,
            estimatedFlightMinutes: 0,
            message: 'Airspace verification service is temporarily connecting. Please wait or retry.',
          };
          setResult(fallback);
          setChecking(false);
          if (onEligibilityChecked) {
            onEligibilityChecked(fallback);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, clearanceRadiusMeters]);

  if (checking) {
    return (
      <div className="geofence-status-box" style={{ background: 'var(--bg-tertiary, #f8fafc)', border: '1px solid var(--border-default, #e2e8f0)' }}>
        <Loader2 className="animate-spin" size={20} color="var(--accent-cyan, #0ea5e9)" />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Auditing DGCA Airspace Corridors & No-Fly Zones (NFZ)...
        </span>
      </div>
    );
  }

  if (!result) return null;

  // Prohibited No-Fly Zone conflict
  if (result.airspaceStatus === 'PROHIBITED_NFZ' || (!result.isEligible && result.conflictingZones && result.conflictingZones.length > 0)) {
    const conflict = result.conflictingZones?.[0];
    return (
      <div className="geofence-status-box ineligible" style={{ background: '#fef2f2', border: '1.5px solid #f87171' }}>
        <ShieldAlert size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⛔ RESTRICTED AIRSPACE VIOLATION</span>
            {conflict && <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem' }}>{conflict.code}</span>}
          </div>
          <div style={{ fontSize: '0.825rem', color: '#7f1d1d', marginTop: '0.2rem', lineHeight: 1.4 }}>
            {result.message}
          </div>
          {conflict && (
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>
              Mandatory Regulation: {conflict.regulatoryRef}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Warning corridor
  if (result.airspaceStatus === 'WARNING_ZONE') {
    return (
      <div className="geofence-status-box" style={{ background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
        <AlertTriangle size={24} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#92400e' }}>
            ⚠️ Airspace Caution Corridor
          </div>
          <div style={{ fontSize: '0.825rem', color: '#78350f', marginTop: '0.2rem', lineHeight: 1.4 }}>
            {result.message}
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.4rem', fontSize: '0.78rem', color: '#92400e' }}>
            <span>Distance: <strong>{result.distanceFromHubKm} km</strong></span>
            <span>Est. Air Transit: <strong>~{result.estimatedFlightMinutes} mins</strong></span>
            <span>Max Altitude: <strong>35m MSL</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // Standard Eligible / Clear
  if (result.isEligible) {
    return (
      <div className="geofence-status-box eligible" style={{ background: '#f0fdf4', border: '1.5px solid #86efac' }}>
        <CheckCircle2 size={24} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#166534' }}>
            Airspace Clear for Autonomous Delivery 🚀
          </div>
          <div style={{ fontSize: '0.825rem', color: '#14532d', marginTop: '0.2rem', lineHeight: 1.4 }}>
            {result.message}
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.45rem', fontSize: '0.78rem', color: '#166534' }}>
            <span>Fulfillment: <strong>{result.hubName || 'SkyHub Central'}</strong></span>
            <span>Corridor Distance: <strong>{result.distanceFromHubKm} km</strong></span>
            <span>Est. Air Transit: <strong>~{result.estimatedFlightMinutes} mins</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // Out of Range
  return (
    <div className="geofence-status-box ineligible">
      <XCircle size={22} color="#dc2626" style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.925rem', color: '#991b1b' }}>Delivery Out of Service Corridor</div>
        <div style={{ fontSize: '0.825rem', marginTop: '0.15rem', color: '#7f1d1d' }}>{result.message}</div>
      </div>
    </div>
  );
};
