import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { GeofenceCheckResult } from '../../types/address';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Plane } from 'lucide-react';

interface GeofenceCheckerProps {
  latitude: number;
  longitude: number;
  onEligibilityChecked?: (result: GeofenceCheckResult) => void;
}

export const GeofenceChecker: React.FC<GeofenceCheckerProps> = ({
  latitude,
  longitude,
  onEligibilityChecked,
}) => {
  const [checking, setChecking] = useState<boolean>(true);
  const [result, setResult] = useState<GeofenceCheckResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    setChecking(true);

    api.geofence
      .checkEligibility(latitude, longitude)
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
            distanceFromHubKm: 0,
            estimatedFlightMinutes: 0,
            message: 'Drone delivery is temporarily unavailable. Please try again later.',
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
  }, [latitude, longitude]);

  if (checking) {
    return (
      <div className="geofence-status-box" style={{ background: 'var(--bg-tertiary)' }}>
        <Loader2 className="animate-spin" size={20} color="var(--accent-cyan)" />
        <span style={{ fontSize: '0.875rem' }}>Verifying airspace & safe drone delivery zone...</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.isEligible) {
    return (
      <div className="geofence-status-box eligible">
        <CheckCircle2 size={22} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>Drone Delivery Available! 🚀</div>
          <div style={{ fontSize: '0.825rem', marginTop: '0.15rem' }}>{result.message}</div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.78rem' }}>
            <span>Distance: <strong>{result.distanceFromHubKm} km</strong></span>
            <span>Est. Air Transit: <strong>~{result.estimatedFlightMinutes} mins</strong></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="geofence-status-box ineligible">
      <XCircle size={22} style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>Drone Delivery Not Available</div>
        <div style={{ fontSize: '0.825rem', marginTop: '0.15rem' }}>{result.message}</div>
      </div>
    </div>
  );
};
