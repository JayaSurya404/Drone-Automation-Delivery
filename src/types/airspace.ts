export type AirspaceZoneType =
  | 'AIRPORT'
  | 'MILITARY'
  | 'HOSPITAL_HELIPAD'
  | 'GOVERNMENT'
  | 'CRITICAL_INFRA';

export type AirspaceRestrictionLevel = 'PROHIBITED' | 'RESTRICTED_WARNING';

export interface NoFlyZone {
  id: string;
  name: string;
  code: string;
  type: AirspaceZoneType;
  restriction: AirspaceRestrictionLevel;
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

export type ClearanceRadiusOption = 2.0 | 3.5 | 5.0;

export interface OverheadHazardChecklist {
  noWires: boolean;
  levelGround: boolean;
  clearSkyView: boolean;
  petsProtected: boolean;
}
