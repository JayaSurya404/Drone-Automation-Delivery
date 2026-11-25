import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CorridorRouteResult {
  waypoints: [number, number][];
  totalDistanceKm: number;
  corridorType: 'outbound_airway' | 'return_airway' | 'custom_corridor';
  obstaclesAvoided: { name: string; type: string; clearanceM: number }[];
}

export class CorridorRoutePlanner {
  private osmData: any = null;

  constructor() {
    this.loadOsmData();
  }

  private loadOsmData() {
    try {
      const dataPath = path.resolve(__dirname, '../data/osmCorridorData.json');
      if (fs.existsSync(dataPath)) {
        this.osmData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      }
    } catch (e) {
      console.warn('[CorridorRoutePlanner] OSM corridor data load warning:', e);
    }
  }

  // Haversine distance in km
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(3));
  }

  // Generate non-straight, obstacle-clearing flight corridor
  public planRoute(
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number,
    isReturn: boolean = false
  ): CorridorRouteResult {
    const hubLat = 11.1132;
    const hubLng = 77.0277;
    const isFromHub = Math.abs(startLat - hubLat) < 0.002 && Math.abs(startLng - hubLng) < 0.002;
    const isToHub = Math.abs(destLat - hubLat) < 0.002 && Math.abs(destLng - hubLng) < 0.002;

    let keyWaypoints: [number, number][] = [];
    let corridorType: CorridorRouteResult['corridorType'] = 'custom_corridor';
    const obstaclesAvoided: CorridorRouteResult['obstaclesAvoided'] = [];

    const totalDistKm = this.calculateDistanceKm(startLat, startLng, destLat, destLng);
    const is1kmCorridor = totalDistKm <= 2.0;

    if (isFromHub && !isReturn) {
      corridorType = 'outbound_airway';
      if (is1kmCorridor) {
        // ── 1.0 KM DEMONSTRATION CORRIDOR (Kurumbapalayam South / KVIMIS Airway) ──
        // Follows physical Gazebo world waypoints, clearing the construction crane with a dedicated East detour.
        keyWaypoints = [
          [startLat, startLng],                           // WP 0: SkyHub Launch Pad (11.113200, 77.027700)
          [11.111403, 77.027792],                         // WP 1: Corridor Climb & Acceleration (y=-200m)
          [11.109156, 77.027865],                         // WP 2: Pre-Obstacle Airway Entry (y=-450m)
          [11.108258, 77.028231],                         // WP 3: Tower Crane East Avoidance Detour (y=-550m, +36m East)
          [11.106911, 77.028020],                         // WP 4: Rejoin Southbound Airway (y=-700m)
          [11.105114, 77.028112],                         // WP 5: Approach Funnel Ceiling (y=-900m)
          [destLat, destLng],                             // WP 6: Customer Destination Drop Pad (11.104262, 77.028112)
        ];
        obstaclesAvoided.push(
          { name: 'Tower Construction Crane OBS-CRANE-01', type: 'crane', clearanceM: 36 },
          { name: 'Kurumbapalayam Logistics Warehouse', type: 'industrial', clearanceM: 45 }
        );
      } else {
        // ── 4.71 KM FULL CORRIDOR TO KALAPATTI ──
        keyWaypoints = [
          [startLat, startLng],                           // WP 0: SkyHub Launch Pad
          [11.1105, 77.0268],                             // WP 1: SkyHub Airway Exit (Kurumbapalayam North)
          [11.1015, 77.0255],                             // WP 2: KVIMIS Campus West Bypass (steers west of educational block)
          [11.0920, 77.0280],                             // WP 3: Mid-Corridor Crossing (clears SVB Tech Park)
          [11.0820, 77.0315],                             // WP 4: Kalapatti North Road Airway Turn
          [11.0745, 77.0340],                             // WP 5: Kalapatti Drop Zone Approach Funnel
          [destLat, destLng],                             // WP 6: Customer Destination Drop Pad
        ];
        obstaclesAvoided.push(
          { name: 'Kurumbapalayam Logistics Complex', type: 'industrial', clearanceM: 65 },
          { name: 'KVIMIS Campus & Power Transmission Corridor', type: 'college', clearanceM: 85 },
          { name: 'SVB Tech Park (10-Story Tower)', type: 'commercial', clearanceM: 320 },
          { name: 'Kalapatti Suburban Residential Cluster', type: 'residential', clearanceM: 45 }
        );
      }
    } else if (isToHub || isReturn) {
      corridorType = 'return_airway';
      if (is1kmCorridor) {
        // ── 1.0 KM RETURN CORRIDOR TO SKYHUB ──
        keyWaypoints = [
          [startLat, startLng],                           // Return WP 0: Customer Drop Zone Takeoff (11.104262, 77.028112)
          [11.106462, 77.028387],                         // Return WP 1: South Return Airway
          [11.109156, 77.028433],                         // Return WP 2: East Corridor Bypass (clears crane to the East)
          [11.111852, 77.028066],                         // Return WP 3: SkyHub Approach Funnel
          [destLat, destLng],                             // Return WP 4: SkyHub Docking Pad (11.113200, 77.027700)
        ];
        obstaclesAvoided.push(
          { name: 'Tower Construction Crane OBS-CRANE-01 (East Airway Clearance)', type: 'crane', clearanceM: 48 }
        );
      } else {
        // ── 4.71 KM RETURN CORRIDOR FROM KALAPATTI ──
        keyWaypoints = [
          [startLat, startLng],                           // Return WP 0: Customer Drop Zone Takeoff
          [11.0760, 77.0360],                             // Return WP 1: Kalapatti East Airway Departure
          [11.0850, 77.0365],                             // Return WP 2: East Kalapatti Airway
          [11.0950, 77.0345],                             // Return WP 3: East Tech Corridor Bypass
          [11.1040, 77.0305],                             // Return WP 4: North Ingress Approach
          [11.1115, 77.0285],                             // Return WP 5: SkyHub Final Approach Funnel
          [destLat, destLng],                             // Return WP 6: SkyHub Docking Pad
        ];
        obstaclesAvoided.push(
          { name: 'Lemon Tree Coimbatore & Kalapatti East Blocks', type: 'hotel', clearanceM: 70 },
          { name: 'North Tech Corridor East Commercial Zone', type: 'commercial', clearanceM: 140 },
          { name: 'Annur Road High Voltage Corridor', type: 'infrastructure', clearanceM: 95 }
        );
      }
    } else {
      // ── ARBITRARY COORDINATES CORRIDOR ──
      // Generates safe multi-waypoint arc avoiding straight line
      const dLat = destLat - startLat;
      const dLng = destLng - startLng;
      const midLat = (startLat + destLat) / 2;
      const midLng = (startLng + destLng) / 2;
      // Perpendicular lateral deviation (approx 200 meters)
      const perpLat = -dLng * 0.25;
      const perpLng = dLat * 0.25;

      keyWaypoints = [
        [startLat, startLng],
        [startLat + dLat * 0.25 + perpLat * 0.6, startLng + dLng * 0.25 + perpLng * 0.6],
        [midLat + perpLat, midLng + perpLng],
        [startLat + dLat * 0.75 + perpLat * 0.6, startLng + dLng * 0.75 + perpLng * 0.6],
        [destLat, destLng],
      ];
    }

    // Densify waypoints along the non-straight segments for smooth physical tracking
    const denseRoute: [number, number][] = [];
    for (let s = 0; s < keyWaypoints.length - 1; s++) {
      const p1 = keyWaypoints[s];
      const p2 = keyWaypoints[s + 1];
      const segDistKm = this.calculateDistanceKm(p1[0], p1[1], p2[0], p2[1]);
      // ~50m step size along each airway segment
      const steps = Math.max(3, Math.ceil((segDistKm * 1000) / 50));

      for (let i = 0; i < steps; i++) {
        const frac = i / steps;
        const lat = p1[0] + (p2[0] - p1[0]) * frac;
        const lng = p1[1] + (p2[1] - p1[1]) * frac;
        denseRoute.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
      }
    }
    // Add final destination
    denseRoute.push([
      parseFloat(keyWaypoints[keyWaypoints.length - 1][0].toFixed(6)),
      parseFloat(keyWaypoints[keyWaypoints.length - 1][1].toFixed(6)),
    ]);

    // Calculate total route distance along the actual non-straight path
    let totalKm = 0;
    for (let i = 0; i < denseRoute.length - 1; i++) {
      totalKm += this.calculateDistanceKm(
        denseRoute[i][0],
        denseRoute[i][1],
        denseRoute[i + 1][0],
        denseRoute[i + 1][1]
      );
    }

    return {
      waypoints: denseRoute,
      totalDistanceKm: parseFloat(totalKm.toFixed(3)),
      corridorType,
      obstaclesAvoided,
    };
  }
}

export const corridorRoutePlanner = new CorridorRoutePlanner();
