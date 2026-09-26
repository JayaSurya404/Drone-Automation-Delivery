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
  getCenter?(): [number, number] | null;
  getZoom?(): number | null;
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
  private traveledPolyline: any = null;
  private traveledPoints: [number, number][] = [];
  private pendingDroneLocation: DroneLocation | null = null;
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

    // High quality ESRI World Imagery satellite base layer + CartoDB labels matching Admin Satellite Map
    this.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
      }
    ).addTo(this.mapInstance);

    this.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c', 'd'],
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      }
    ).addTo(this.mapInstance);

    // If an update arrived while initializing, flush it now
    if (this.pendingDroneLocation) {
      this.updateDronePosition(this.pendingDroneLocation);
      this.pendingDroneLocation = null;
    }

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

  public getDroneMarkerLatLng(): { lat: number; lng: number } | null {
    if (this.droneMarker) {
      const pos = this.droneMarker.getLatLng();
      return { lat: pos.lat, lng: pos.lng };
    }
    return null;
  }

  public updateDronePosition(location: DroneLocation): void {
    if (!this.mapInstance || !this.L) {
      this.pendingDroneLocation = location;
      return;
    }

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

    const heading = location.bearing || 0;
    const badgeText = `${location.altitudeMeters ? `${location.altitudeMeters}m • ` : ''}${location.speedKmh ? `${location.speedKmh} km/h` : 'Airborne'}`;

    if (this.droneMarker) {
      // Smoothly update marker position without destroying DOM element or icon
      this.droneMarker.setLatLng([lat, lng]);
      const el = this.droneMarker.getElement();
      if (el) {
        const svg = el.querySelector('svg');
        if (svg) {
          svg.style.transform = `rotate(${heading}deg)`;
        }
        const badge = el.querySelector('.drone-status-text') as HTMLElement;
        if (badge) {
          badge.textContent = badgeText;
        }
      }
    } else {
      const customDroneHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; inset: -6px; border-radius: 9999px; background-color: rgba(6, 182, 212, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9999px; border: 2px solid #06b6d4; background-color: rgba(15, 23, 42, 0.95); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; color: white; transform: rotate(${heading}deg); transition: transform 0.4s ease;">
              <path fill="#06b6d4" d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
          <div class="drone-status-text" style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; font-family: monospace; color: white; background-color: rgba(15, 23, 42, 0.92); border: 1px solid #06b6d4; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
            ${badgeText}
          </div>
        </div>
      `;

      const icon = this.L.divIcon({
        className: 'custom-drone-leaflet-icon',
        html: customDroneHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      this.droneMarker = this.L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(this.mapInstance);
    }

    // Expose actual Leaflet marker position globally for verification and testing
    if (typeof window !== 'undefined' && this.droneMarker) {
      const pos = this.droneMarker.getLatLng();
      (window as any).__skynavCustomerDrone = {
        lat: pos.lat,
        lng: pos.lng,
        alt: location.altitudeMeters || 0,
        altitudeMeters: location.altitudeMeters || 0,
        speed: location.speedKmh || 0,
        speedKmh: location.speedKmh || 0,
        heading,
        bearing: heading,
        markerLatLng: [pos.lat, pos.lng],
        updatedAt: Date.now(),
      };
      (window as any).__skynavCustDrone = (window as any).__skynavCustomerDrone;
    }

    // Traveled route maintenance
    const currentPt: [number, number] = [lat, lng];
    if (this.traveledPoints.length === 0) {
      this.traveledPoints.push(currentPt);
    } else {
      const last = this.traveledPoints[this.traveledPoints.length - 1];
      if (Math.abs(last[0] - lat) > 0.000005 || Math.abs(last[1] - lng) > 0.000005) {
        this.traveledPoints.push(currentPt);
      }
    }

    if (this.traveledPolyline) {
      this.traveledPolyline.setLatLngs(this.traveledPoints);
    } else if (this.mapInstance && this.traveledPoints.length > 1) {
      this.traveledPolyline = this.L.polyline(this.traveledPoints, {
        color: '#06b6d4',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
      }).addTo(this.mapInstance);
    }
  }

  public updateDestination(lat: number, lng: number, label: string = 'Drop-off Zone'): void {
    if (!this.mapInstance || !this.L) return;

    const customDestHtml = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9999px; border: 2px solid #10b981; background-color: rgba(15, 23, 42, 0.95); box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.4);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
        </div>
        <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 1px 6px; border-radius: 6px; font-size: 9px; font-weight: 700; color: #10b981; background-color: rgba(15, 23, 42, 0.92); border: 1px solid #10b981;">
          Customer Landing Zone
        </div>
      </div>
    `;

    const icon = this.L.divIcon({
      className: 'custom-dest-leaflet-icon',
      html: customDestHtml,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    this.currentDestCoords = [lat, lng];

    if (this.destMarker) {
      this.destMarker.setLatLng([lat, lng]);
      this.destMarker.setIcon(icon);
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
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="width: 32px; height: 32px; border-radius: 10px; background-color: rgba(15, 23, 42, 0.95); border: 2px solid #06b6d4; display: flex; align-items: center; justify-content: center; color: #06b6d4; box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.5);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div style="margin-top: 2px; padding: 1px 6px; border-radius: 4px; background-color: rgba(15, 23, 42, 0.9); border: 1px solid rgba(6, 182, 212, 0.4); font-size: 9px; font-weight: 700; color: #06b6d4; font-family: monospace; white-space: nowrap;">
          ${hub.name || 'SkyHub Kurumbapalayam'}
        </div>
      </div>
    `;

    const icon = this.L.divIcon({
      className: 'custom-hub-leaflet-icon',
      html: customHubHtml,
      iconSize: [34, 46],
      iconAnchor: [17, 23],
    });

    if (this.hubMarker) {
      this.hubMarker.setLatLng([hub.latitude, hub.longitude]);
      this.hubMarker.setIcon(icon);
    } else {
      this.hubMarker = this.L.marker([hub.latitude, hub.longitude], { icon }).addTo(this.mapInstance);
      this.hubMarker.bindTooltip(`📍 ${hub.name || 'SkyHub Kurumbapalayam'}`, { direction: 'top' });
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

      let layer: any;
      if (zone.polygon && zone.polygon.length >= 3) {
        layer = this.L.polygon(zone.polygon, {
          color: strokeColor,
          fillColor,
          fillOpacity,
          weight: isProhibited ? 2 : 1.5,
          dashArray: isProhibited ? '6, 6' : '4, 4',
          className: `nfz-polygon ${isProhibited ? 'prohibited' : 'warning'}`,
        });
      } else {
        layer = this.L.circle([zone.latitude, zone.longitude], {
          radius: zone.radiusMeters,
          color: strokeColor,
          fillColor,
          fillOpacity,
          weight: isProhibited ? 2 : 1.5,
          dashArray: isProhibited ? '6, 6' : '4, 4',
          className: `nfz-circle ${isProhibited ? 'prohibited' : 'warning'}`,
        });
      }

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

      layer.bindPopup(popupHtml, { maxWidth: 300, className: 'custom-nfz-leaflet-popup' });
      layer.bindTooltip(`⚠️ ${zone.name}`, { direction: 'top', sticky: true });

      layer.addTo(this.nfzLayerGroup);
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

  public getCenter(): [number, number] | null {
    if (!this.mapInstance) return null;
    const c = this.mapInstance.getCenter();
    return [c.lat, c.lng];
  }

  public getZoom(): number | null {
    if (!this.mapInstance) return null;
    return this.mapInstance.getZoom();
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
      if (this.traveledPolyline) {
        this.traveledPolyline.remove();
        this.traveledPolyline = null;
      }
      this.traveledPoints = [];
      this.pendingDroneLocation = null;
      this.flightPolyline = null;
      this.geofenceCircle = null;
      this.mapInstance.remove();
      this.mapInstance = null;
    }
  }
}
