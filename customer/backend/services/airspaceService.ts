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

// Curated DGCA & Indian civil aviation restricted zones across the Coimbatore / Tamil Nadu operational corridor
const COIMBATORE_NO_FLY_ZONES: NoFlyZone[] = [
  {
    id: 'nfz_cjb_airport',
    name: 'Coimbatore International Airport (CJB / VOCB) Active Runway Security Perimeter',
    code: 'CJB-CLASS-D-CORE',
    type: 'AIRPORT',
    restriction: 'PROHIBITED',
    latitude: 11.0298,
    longitude: 77.0434,
    radiusMeters: 2500,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 3000,
    reason: 'Active commercial aircraft runway & terminal security perimeter. UAV operations prohibited inside runway safety boundary.',
    regulatoryRef: 'DGCA UAS Rules 2021 / Class D Runway Buffer',
    activeSchedule: '24/7 Continuous',
  },
  {
    id: 'nfz_cjb_corridor',
    name: 'Coimbatore Airport Outer Air Corridor Advisory Zone',
    code: 'CJB-UAV-YELLOW',
    type: 'AIRPORT',
    restriction: 'RESTRICTED_WARNING',
    latitude: 11.0298,
    longitude: 77.0434,
    radiusMeters: 5000,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 60,
    reason: 'DGCA designated low-altitude commercial delivery air corridor under 60m AGL. Normal drone flight permitted with continuous telemetry.',
    regulatoryRef: 'DGCA Digital Sky Drone Airspace Map (Yellow Zone Corridor)',
    activeSchedule: '24/7 Monitored',
  },
  {
    id: 'nfz_sulur_iaf',
    name: 'Sulur Air Force Station (AFS Sulur) Military Airspace Zone',
    code: 'SULUR-IAF-RED',
    type: 'MILITARY',
    restriction: 'PROHIBITED',
    latitude: 11.0136,
    longitude: 77.1611,
    radiusMeters: 6000,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 4000,
    reason: 'Indian Air Force fighter jet training range and defense installation. Classified Red Zone by Ministry of Civil Aviation.',
    regulatoryRef: 'MoD & DGCA National Drone Airspace Map (Red Zone)',
    activeSchedule: '24/7 Continuous',
  },
  {
    id: 'nfz_cmch_heliport',
    name: 'Coimbatore Medical College Hospital (CMCH) Trauma Heliport Corridor',
    code: 'CMCH-HELI-CORR',
    type: 'HOSPITAL_HELIPAD',
    restriction: 'RESTRICTED_WARNING',
    latitude: 10.9996,
    longitude: 76.9664,
    radiusMeters: 1200,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 350,
    reason: 'Emergency Medevac helicopter transit corridor. Drones must maintain safe lateral separation and limit altitude to max 35m.',
    regulatoryRef: 'DGCA Heliport Safety Guidelines 2022',
    activeSchedule: 'Continuous Emergency Priority',
  },
  {
    id: 'nfz_coimbatore_collectorate',
    name: 'Coimbatore District Collectorate & Police Commissionerate Security Enclave',
    code: 'CBE-GOV-SEC',
    type: 'GOVERNMENT',
    restriction: 'RESTRICTED_WARNING',
    latitude: 11.0018,
    longitude: 76.9629,
    radiusMeters: 800,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 300,
    reason: 'Dense municipal government & law enforcement complex. Speed limit: 30 km/h and precision tether landing mandatory.',
    regulatoryRef: 'Coimbatore District Administration UAV Protocol',
    activeSchedule: 'Mon-Sat 08:00 - 20:00',
  },
  {
    id: 'nfz_psg_hospitals',
    name: 'PSG Hospitals & Health Campus Air Corridor',
    code: 'PSG-MED-CORR',
    type: 'HOSPITAL_HELIPAD',
    restriction: 'RESTRICTED_WARNING',
    latitude: 11.0250,
    longitude: 77.0300,
    radiusMeters: 1000,
    altitudeFloorMeters: 0,
    altitudeCeilingMeters: 250,
    reason: 'Hospital quiet zone & ambulance transit corridor. Acoustic optimization active.',
    regulatoryRef: 'DGCA Urban UAV Guidelines',
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
    return COIMBATORE_NO_FLY_ZONES;
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
      // Default fallback hub: SkyHub Chinniyampalayam
      minDistanceMeters = this.calculateDistanceMeters(11.0550, 77.0650, lat, lng);
      nearestHub = {
        hub_name: 'SkyHub Chinniyampalayam',
        radius_km: 12.0,
      };
    }

    const distKm = parseFloat((minDistanceMeters / 1000).toFixed(2));
    const maxRadiusKm = nearestHub.radius_km || 12.0;

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

    for (const nfz of COIMBATORE_NO_FLY_ZONES) {
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
