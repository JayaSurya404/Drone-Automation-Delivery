import { DroneLocation, HubLocation } from '../types/tracking';

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
  fitBounds(coordinates: [number, number][]): void;
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
      subdomains: 'abc',
    }).addTo(this.mapInstance);

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
          if (this.onLocationSelectCallback) {
            this.onLocationSelectCallback(pos.lat, pos.lng);
          }
        });
      }
    }

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

  public fitBounds(coordinates: [number, number][]): void {
    if (!this.mapInstance || !this.L || coordinates.length === 0) return;
    const bounds = this.L.latLngBounds(coordinates);
    this.mapInstance.fitBounds(bounds, { padding: [50, 50] });
  }

  public destroy(): void {
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
  }
}
