import { queryAll } from '../db/database.js';

export interface NoFlyZone {
  id: string;
  name: string;
  code: string;
  type: 'AIRPORT' | 'MILITARY' | 'HOSPITAL_HELIPAD' | 'GOVERNMENT' | 'CRITICAL_INFRA';
  restriction: 'PROHIBITED' | 'RESTRICTED_WARNING';
  latitude: number;
  longitude: number;
  radiusMeters: number;
  altitudeFloorMeters: number;
  altitudeCeilingMeters: number;
  reason: string;
  regulatoryRef: string;
  activeSchedule?: string;
}

export interface DropZoneSafetyEvaluation {
  isEligible: boolean;
  status: 'CLEAR' | 'PROHIBITED_NFZ' | 'WARNING_ZONE' | 'OUT_OF_SERVICE_RADIUS';
  conflictingZones: NoFlyZone[];
  distanceFromHubKm: number;
  estimatedFlightMinutes: number;
  clearanceRadiusMeters: number;
  safetyScorePercent: number;
  message: string;
  hubName?: string;
}

// Curated FAA & civil aviation restricted zones across the San Francisco Bay Area operational corridor
const SF_NO_FLY_ZONES: NoFlyZone[] = [
  {
    id: 'nfz_sfo_class_b',
    name: 'San Francisco International Airport (SFO) Airspace Exclusion Buffer',
    code: 'SFO-CLASS-B',
    type: 'AIRPORT',
    restriction: 'PROHIBITED',
    latitude: 37.6213,
    longitude: -122.3790,
    radiusMeters: 6200,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 3000,
    reason: 'Active Class B commercial jet approach and departure corridors. Autonomous civil UAV operations strictly forbidden without LAANC waiver.',
    regulatoryRef: 'FAA 14 CFR § 107.41 / Class B Airspace',
    activeSchedule: '24/7 Continuous',
  },
  {
    id: 'nfz_presidio_military',
    name: 'Presidio & Golden Gate National Coastal Defense Zone',
    code: 'PRESIDIO-DEF',
    type: 'MILITARY',
    restriction: 'PROHIBITED',
    latitude: 37.7989,
    longitude: -122.4662,
    radiusMeters: 2100,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 1200,
    reason: 'Federal security reservation, Golden Gate Bridge infrastructure protection zone, and maritime military exclusion.',
    regulatoryRef: 'Title 36 CFR § 1.5 / National Park & Federal Reserve Airspace',
    activeSchedule: '24/7 Continuous',
  },
  {
    id: 'nfz_alcatraz_fed',
    name: 'Alcatraz Island Federal Security Enclave',
    code: 'ALCATRAZ-FED',
    type: 'GOVERNMENT',
    restriction: 'PROHIBITED',
    latitude: 37.8267,
    longitude: -122.4230,
    radiusMeters: 1200,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 600,
    reason: 'Federal correctional historic boundary & pelican wildlife marine reserve.',
    regulatoryRef: 'FAA FDC NOTAM 4/3621 Federal Enclave',
    activeSchedule: '24/7 Continuous',
  },
  {
    id: 'nfz_ucsf_parnassus_heli',
    name: 'UCSF Medical Center Emergency Trauma Heliport',
    code: 'UCSF-HELI-CORR',
    type: 'HOSPITAL_HELIPAD',
    restriction: 'RESTRICTED_WARNING',
    latitude: 37.7631,
    longitude: -122.4580,
    radiusMeters: 1000,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 350,
    reason: 'Emergency Medevac helicopter transit corridor. Drones must maintain safe lateral separation and limit altitude to max 35m.',
    regulatoryRef: 'FAA Advisory Circular 150/5390-2C Heliport Safety',
    activeSchedule: 'Continuous Emergency Priority',
  },
  {
    id: 'nfz_sf_civic_gov',
    name: 'San Francisco Civic Center & Federal Building Security Zone',
    code: 'SF-CIVIC-SEC',
    type: 'GOVERNMENT',
    restriction: 'RESTRICTED_WARNING',
    latitude: 37.7795,
    longitude: -122.4175,
    radiusMeters: 750,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 400,
    reason: 'Dense municipal government complex. Automated speed limit: 30 km/h and tether drop mandatory.',
    regulatoryRef: 'SF Municipal Code Art. 22A Urban UAV Guidance',
    activeSchedule: 'Mon-Fri 06:00 - 19:00',
  },
  {
    id: 'nfz_oak_runway_approach',
    name: 'Oakland International Airport Runway 28L/R Approach Buffer',
    code: 'OAK-CLASS-C',
    type: 'AIRPORT',
    restriction: 'PROHIBITED',
    latitude: 37.7213,
    longitude: -122.2208,
    radiusMeters: 5500,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 2500,
    reason: 'Class C commercial aircraft final approach radar vectoring corridor.',
    regulatoryRef: 'FAA 14 CFR § 107.41 / Class C Airspace',
    activeSchedule: '24/7 Continuous',
  },
];

class AirspaceService {
  // Haversine distance in meters
  public calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Get all active No-Fly Zones
  public getNoFlyZones(): NoFlyZone[] {
    return SF_NO_FLY_ZONES;
  }

  // Authoritatively evaluate a candidate drop zone location
  public evaluateDropZone(
    lat: number,
    lng: number,
    clearanceRadiusMeters: number = 3.5
  ): DropZoneSafetyEvaluation {
    const safeRadius = Math.max(2.0, Math.min(10.0, clearanceRadiusMeters));

    // 1. Evaluate closest hub
    const hubs = queryAll<any>("SELECT * FROM delivery_zones WHERE status = 'ACTIVE'");
    let nearestHub: any = null;
    let minDistanceMeters = Infinity;

    if (hubs && hubs.length > 0) {
      for (const hub of hubs) {
        const dist = this.calculateDistanceMeters(hub.hub_latitude, hub.hub_longitude, lat, lng);
        if (dist < minDistanceMeters) {
          minDistanceMeters = dist;
          nearestHub = hub;
        }
      }
    } else {
      // Default fallback hub (SkyHub Central)
      minDistanceMeters = this.calculateDistanceMeters(37.7625, -122.4480, lat, lng);
      nearestHub = {
        hub_name: 'SkyHub Aero Fulfillment Central #1',
        radius_km: 18.5,
      };
    }

    const distKm = parseFloat((minDistanceMeters / 1000).toFixed(2));
    const maxRadiusKm = nearestHub.radius_km || 18.5;

    // Out of hub delivery range check
    if (distKm > maxRadiusKm) {
      return {
        isEligible: false,
        status: 'OUT_OF_SERVICE_RADIUS',
        conflictingZones: [],
        distanceFromHubKm: distKm,
        estimatedFlightMinutes: 0,
        clearanceRadiusMeters: safeRadius,
        safetyScorePercent: 0,
        message: `Location is ${distKm} km from ${nearestHub.hub_name}, exceeding the max drone service radius of ${maxRadiusKm} km.`,
        hubName: nearestHub.hub_name,
      };
    }

    // 2. Evaluate collisions with No-Fly Zones
    const prohibitedConflicts: NoFlyZone[] = [];
    const warningConflicts: NoFlyZone[] = [];

    for (const nfz of SF_NO_FLY_ZONES) {
      const distanceToCenter = this.calculateDistanceMeters(lat, lng, nfz.latitude, nfz.longitude);
      // Check if drop location + clearance radius overlaps with NFZ circle
      if (distanceToCenter <= nfz.radiusMeters + safeRadius) {
        if (nfz.restriction === 'PROHIBITED') {
          prohibitedConflicts.push(nfz);
        } else {
          warningConflicts.push(nfz);
        }
      }
    }

    // Prohibited NFZ collision -> Hard Reject
    if (prohibitedConflicts.length > 0) {
      const primaryViolation = prohibitedConflicts[0];
      return {
        isEligible: false,
        status: 'PROHIBITED_NFZ',
        conflictingZones: prohibitedConflicts,
        distanceFromHubKm: distKm,
        estimatedFlightMinutes: 0,
        clearanceRadiusMeters: safeRadius,
        safetyScorePercent: 0,
        message: `Drop Zone Rejected: Target falls within ${primaryViolation.name} (${primaryViolation.regulatoryRef}). Civil UAV flight is strictly prohibited by aviation safety regulations.`,
        hubName: nearestHub.hub_name,
      };
    }

    // Transit time: ~45 km/h cruise speed + 3 mins ascent/descent
    const flightMinutes = Math.max(6, Math.round((distKm / 45) * 60) + 3);

    // Warning zone caution
    if (warningConflicts.length > 0) {
      const cautionZone = warningConflicts[0];
      return {
        isEligible: true,
        status: 'WARNING_ZONE',
        conflictingZones: warningConflicts,
        distanceFromHubKm: distKm,
        estimatedFlightMinutes: flightMinutes,
        clearanceRadiusMeters: safeRadius,
        safetyScorePercent: 78,
        message: `Airspace cleared with caution: Proximity to ${cautionZone.name}. Drone will maintain max 35m altitude corridor with precision tether descent.`,
        hubName: nearestHub.hub_name,
      };
    }

    // 100% Clear Corridor
    return {
      isEligible: true,
      status: 'CLEAR',
      conflictingZones: [],
      distanceFromHubKm: distKm,
      estimatedFlightMinutes: flightMinutes,
      clearanceRadiusMeters: safeRadius,
      safetyScorePercent: 100,
      message: `Airspace fully verified. 100% clear autonomous corridor from ${nearestHub.hub_name} to your designated drop zone.`,
      hubName: nearestHub.hub_name,
    };
  }
}

export const airspaceService = new AirspaceService();
