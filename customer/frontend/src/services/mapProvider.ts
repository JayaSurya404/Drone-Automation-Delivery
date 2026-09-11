import { DroneLocation, HubLocation } from '../types/tracking';
import { NoFlyZone } from '../types/airspace';

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

export interface MapRendererOptions {
  containerElement: HTMLElement;
  initialViewport: MapViewport;
  isInteractive?: boolean;
  theme?: 'dark' | 'light';
  onLocationSelect?: (lat: number, lng: number) => void;
}

export interface IMapProvider {
  initialize(options: MapRendererOptions): void;
  updateDronePosition(location: DroneLocation): void;
  updateDestination(lat: number, lng: number, label?: string): void;
  updateHub(hub: HubLocation): void;
  setFlightRoute(route: [number, number][]): void;
  setGeofenceRadius(centerLat: number, centerLng: number, radiusMeters: number): void;
  setNoFlyZones(zones: NoFlyZone[]): void;
  setClearanceRadius(radiusMeters: number, isEligible?: boolean): void;
  toggleAirspaceLayer(visible: boolean): void;
  fitBounds(coordinates: [number, number][], padding?: [number, number], maxZoom?: number): void;
  onUserInteraction?(callback: () => void): void;
  invalidateSize(): void;
  destroy(): void;
}

// Leaflet implementation of IMapProvider - 100% Light Theme
export class LeafletMapProvider implements IMapProvider {
  private mapInstance: any = null;
  private L: any = null;
  private droneMarker: any = null;
  private destMarker: any = null;
  private hubMarker: any = null;
  private flightPolyline: any = null;
  private geofenceCircle: any = null;
  private nfzLayerGroup: any = null;
  private clearanceCircle: any = null;
  private currentDestCoords: [number, number] | null = null;
  private currentClearanceRadius: number = 3.5;
  private currentClearanceEligible: boolean = true;
  private isLocationPicker: boolean = false;
  private onLocationSelectCallback?: (lat: number, lng: number) => void;

  public async initialize(options: MapRendererOptions): Promise<void> {
    const L = await import('leaflet');
    this.L = L.default || L;
    this.onLocationSelectCallback = options.onLocationSelect;
    this.isLocationPicker = !!options.onLocationSelect;

    if (this.mapInstance) {
      this.mapInstance.remove();
    }

    this.mapInstance = this.L.map(options.containerElement, {
      center: options.initialViewport.center,
      zoom: options.initialViewport.zoom,
      zoomControl: options.isInteractive !== false,
      dragging: options.isInteractive !== false,
      touchZoom: options.isInteractive !== false,
      scrollWheelZoom: options.isInteractive !== false,
      attributionControl: false,
    });

    // High quality light tile layer without watermark
    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    this.L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.mapInstance);

    // Recalculate dimensions once mounted in DOM
    setTimeout(() => {
      this.invalidateSize();
    }, 150);
    setTimeout(() => {
      this.invalidateSize();
    }, 500);

    if (this.isLocationPicker) {
      this.mapInstance.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        this.updateDestination(lat, lng, 'Selected Drop Location');
        if (this.onLocationSelectCallback) {
          this.onLocationSelectCallback(lat, lng);
        }
      });
    }
  }

  public updateDronePosition(location: DroneLocation): void {
    if (!this.mapInstance || !this.L) return;

    const customDroneHtml = `
      <div class="drone-map-marker" style="transform: rotate(${location.bearing || 0}deg);">
        <div class="drone-icon-box">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="4" fill="#0ea5e9"/>
          </svg>
        </div>
        <div class="drone-pulse-radar"></div>
      </div>
    `;

    const icon = this.L.divIcon({
      className: 'custom-drone-leaflet-icon',
      html: customDroneHtml,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
    });

    if (this.droneMarker) {
      this.droneMarker.setLatLng([location.latitude, location.longitude]);
      this.droneMarker.setIcon(icon);
    } else {
      this.droneMarker = this.L.marker([location.latitude, location.longitude], { icon }).addTo(this.mapInstance);
    }
  }

  public updateDestination(lat: number, lng: number, label: string = 'Drop-off Zone'): void {
    if (!this.mapInstance || !this.L) return;

    const customDestHtml = `
      <div class="destination-map-marker">
        <div class="landing-pad-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
        </div>
        <div class="landing-pad-pulse"></div>
      </div>
    `;

    const icon = this.L.divIcon({
      className: 'custom-dest-leaflet-icon',
      html: customDestHtml,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });

    this.currentDestCoords = [lat, lng];

    if (this.destMarker) {
      this.destMarker.setLatLng([lat, lng]);
    } else {
      this.destMarker = this.L.marker([lat, lng], {
        icon,
        draggable: this.isLocationPicker,
      }).addTo(this.mapInstance);

      if (this.isLocationPicker) {
        this.destMarker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          this.currentDestCoords = [pos.lat, pos.lng];
          this.renderClearanceCircle();
          if (this.onLocationSelectCallback) {
            this.onLocationSelectCallback(pos.lat, pos.lng);
          }
        });
      }
    }

    this.renderClearanceCircle();

    if (label) {
      this.destMarker.bindTooltip(label, { direction: 'top', offset: [0, -20] });
    }
  }

  public updateHub(hub: HubLocation): void {
    if (!this.mapInstance || !this.L) return;

    const customHubHtml = `
      <div class="hub-map-marker">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    `;

    const icon = this.L.divIcon({
      className: 'custom-hub-leaflet-icon',
      html: customHubHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (this.hubMarker) {
      this.hubMarker.setLatLng([hub.latitude, hub.longitude]);
    } else {
      this.hubMarker = this.L.marker([hub.latitude, hub.longitude], { icon }).addTo(this.mapInstance);
      this.hubMarker.bindTooltip(`📍 ${hub.name}`, { direction: 'top' });
    }
  }

  public setFlightRoute(route: [number, number][]): void {
    if (!this.mapInstance || !this.L) return;

    if (this.flightPolyline) {
      this.flightPolyline.setLatLngs(route);
    } else {
      this.flightPolyline = this.L.polyline(route, {
        color: '#0284c7',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 8',
        lineCap: 'round',
      }).addTo(this.mapInstance);
    }
  }

  public setGeofenceRadius(centerLat: number, centerLng: number, radiusMeters: number = 15000): void {
    if (!this.mapInstance || !this.L) return;

    if (this.geofenceCircle) {
      this.geofenceCircle.setLatLng([centerLat, centerLng]);
      this.geofenceCircle.setRadius(radiusMeters);
    } else {
      this.geofenceCircle = this.L.circle([centerLat, centerLng], {
        color: 'rgba(2, 132, 199, 0.4)',
        fillColor: 'rgba(2, 132, 199, 0.06)',
        fillOpacity: 0.15,
        radius: radiusMeters,
        weight: 1.5,
        dashArray: '4, 4',
      }).addTo(this.mapInstance);
    }
  }

  // Precision Drop-Zone Clearance Radius Circle
  public setClearanceRadius(radiusMeters: number, isEligible: boolean = true): void {
    this.currentClearanceRadius = radiusMeters;
    this.currentClearanceEligible = isEligible;
    this.renderClearanceCircle();
  }

  private renderClearanceCircle(): void {
    if (!this.mapInstance || !this.L || !this.currentDestCoords) return;

    const isClear = this.currentClearanceEligible;
    const strokeColor = isClear ? '#10b981' : '#ef4444';
    const fillColor = isClear ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.28)';

    if (this.clearanceCircle) {
      this.clearanceCircle.setLatLng(this.currentDestCoords);
      this.clearanceCircle.setRadius(this.currentClearanceRadius);
      this.clearanceCircle.setStyle({
        color: strokeColor,
        fillColor: fillColor,
        weight: 2,
        dashArray: '4, 4',
      });
    } else {
      this.clearanceCircle = this.L.circle(this.currentDestCoords, {
        color: strokeColor,
        fillColor: fillColor,
        fillOpacity: 0.25,
        radius: this.currentClearanceRadius,
        weight: 2,
        dashArray: '4, 4',
        className: 'dropzone-clearance-circle',
      }).addTo(this.mapInstance);
    }
  }

  // Render No-Fly Zones (NFZ) & Restricted Corridors
  public setNoFlyZones(zones: NoFlyZone[]): void {
    if (!this.mapInstance || !this.L) return;

    if (this.nfzLayerGroup) {
      this.nfzLayerGroup.clearLayers();
    } else {
      this.nfzLayerGroup = this.L.layerGroup().addTo(this.mapInstance);
    }

    zones.forEach((zone) => {
      const isProhibited = zone.restriction === 'PROHIBITED';
      const strokeColor = isProhibited ? '#ef4444' : '#f59e0b';
      const fillColor = isProhibited ? '#ef4444' : '#f59e0b';
      const fillOpacity = isProhibited ? 0.16 : 0.12;

      const circle = this.L.circle([zone.latitude, zone.longitude], {
        radius: zone.radiusMeters,
        color: strokeColor,
        fillColor,
        fillOpacity,
        weight: isProhibited ? 2 : 1.5,
        dashArray: isProhibited ? '6, 6' : '4, 4',
        className: `nfz-circle ${isProhibited ? 'prohibited' : 'warning'}`,
      });

      const popupHtml = `
        <div class="nfz-popup-card">
          <div class="nfz-popup-header ${isProhibited ? 'prohibited' : 'warning'}">
            <span class="nfz-badge">${isProhibited ? '⛔ PROHIBITED AIRSPACE' : '⚠️ RESTRICTED CAUTION'}</span>
            <span class="nfz-code">${zone.code}</span>
          </div>
          <div class="nfz-popup-title">${zone.name}</div>
          <p class="nfz-popup-reason">${zone.reason}</p>
          <div class="nfz-popup-meta">
            <span><strong>Authority:</strong> ${zone.regulatoryRef}</span>
            <span><strong>Radius:</strong> ${(zone.radiusMeters / 1000).toFixed(1)} km</span>
            <span><strong>Ceiling:</strong> ${zone.altitudeCeilingMeters}m MSL</span>
          </div>
        </div>
      `;

      circle.bindPopup(popupHtml, { maxWidth: 300, className: 'custom-nfz-leaflet-popup' });
      circle.bindTooltip(`⚠️ ${zone.name}`, { direction: 'top', sticky: true });

      circle.addTo(this.nfzLayerGroup);
    });
  }

  public toggleAirspaceLayer(visible: boolean): void {
    if (!this.mapInstance || !this.nfzLayerGroup) return;

    if (visible) {
      if (!this.mapInstance.hasLayer(this.nfzLayerGroup)) {
        this.mapInstance.addLayer(this.nfzLayerGroup);
      }
    } else {
      if (this.mapInstance.hasLayer(this.nfzLayerGroup)) {
        this.mapInstance.removeLayer(this.nfzLayerGroup);
      }
    }
  }

  public onUserInteraction(callback: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('dragstart zoomstart movestart', callback);
  }

  public fitBounds(coordinates: [number, number][], padding: [number, number] = [60, 60], maxZoom: number = 16): void {
    if (!this.mapInstance || !this.L || !coordinates || coordinates.length === 0) return;
    const validCoords = coordinates.filter(
      (c) => Array.isArray(c) && c.length === 2 && !isNaN(c[0]) && !isNaN(c[1]) && (c[0] !== 0 || c[1] !== 0)
    );
    if (validCoords.length === 0) return;
    try {
      this.invalidateSize();
      const bounds = this.L.latLngBounds(validCoords);
      if (bounds.isValid && bounds.isValid()) {
        this.mapInstance.fitBounds(bounds, { padding, maxZoom, animate: true });
      }
    } catch (e) {
      console.warn('Error fitting map bounds:', e);
    }
  }

  public invalidateSize(): void {
    if (this.mapInstance) {
      this.mapInstance.invalidateSize();
    }
  }

  public destroy(): void {
    if (this.mapInstance) {
      if (this.nfzLayerGroup) {
        this.nfzLayerGroup.clearLayers();
        this.nfzLayerGroup = null;
      }
      this.clearanceCircle = null;
      this.destMarker = null;
      this.droneMarker = null;
      this.hubMarker = null;
      this.flightPolyline = null;
      this.geofenceCircle = null;
      this.mapInstance.remove();
      this.mapInstance = null;
    }
  }
}
