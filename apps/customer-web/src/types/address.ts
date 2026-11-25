import { DropZoneSafetyEvaluation, NoFlyZone } from './airspace';

export type AddressLabel = 'Home' | 'Office' | 'Other';

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: AddressLabel;
  name: string;
  phone: string;
  building: string;
  street: string;
  area: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  instructions?: string;
  isDefault: boolean;
  dropZoneType?: 'Lawn' | 'Rooftop Pad' | 'Balcony Landing' | 'Driveway' | 'Designated Station';
  clearanceRadiusMeters?: number;
  hazardsVerified?: boolean;
}

export interface GeofenceCheckResult {
  isEligible: boolean;
  message: string;
  distanceFromHubKm: number;
  estimatedFlightMinutes: number;
  status: 'Eligible' | 'Not Eligible' | 'Temporarily Unavailable';
  airspaceStatus?: 'CLEAR' | 'PROHIBITED_NFZ' | 'WARNING_ZONE' | 'OUT_OF_SERVICE_RADIUS';
  conflictingZones?: NoFlyZone[];
  hubName?: string;
  safetyScorePercent?: number;
}
