import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import osmCorridorData from '../../data/osmCorridorData.json';

export interface EnvironmentSettings {
  weather: 'clear' | 'cloudy' | 'rain' | 'wind' | 'storm';
  timeOfDay: 'day' | 'sunset' | 'night';
  visibility: 'high' | 'medium' | 'low';
}

/**
 * Real Geographic 3D Digital Twin Environment
 * Centered on SkyHub Kurumbapalayam [11.1132, 77.0277], Coimbatore, Tamil Nadu, India
 * Covering the flight corridor south to Kalapatti / Peelamedu customer destination [11.0725, 77.0345]
 */
export class Environment3D {
  public scene: THREE.Scene;

  // Real geographic positions in 3D world space (origin = 0, 0, 0)
  // SkyHub Kurumbapalayam [11.1132, 77.0277] mapped to (0, 0.05, -35)
  public warehousePadPosition = new THREE.Vector3(0, 0.05, -35);

  // Customer Destination [11.0725, 77.0345] mapped to (12.05, 0.05, 38)
  public customerPadPosition = new THREE.Vector3(12.05, 0.05, 38);

  // Flight corridor obstacle (transmission tower / cell mast along SH-165)
  public obstaclePosition = new THREE.Vector3(3.5, 0, 5);

  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public obstacleGroup: THREE.Group;
  public plannedPathLine: THREE.Line | null = null;
  public traversedPathLine: THREE.Line | null = null;
  public reroutedPathLine: THREE.Line | null = null;
  public customerTargetRing: THREE.Mesh | null = null;
  public rainParticles: THREE.Points | null = null;
  public windLines: THREE.LineSegments | null = null;
  public groundMesh: THREE.Mesh | null = null;

  private rainVelocity: Float32Array | null = null;
  private animTimer: number = 0;
  private groundMaterial: THREE.MeshStandardMaterial | null = null;

  // Real Digital Elevation Model (DEM) data (AWS Open Data Terrarium SRTM/Copernicus 30m DEM)
  public isRealDemLoaded: boolean = false;
  public realDemHeightmap: Float32Array | null = null;
  public baseElevationMsl: number = 399.6; // Mean elevation of Kurumbapalayam MSL in meters

  // Genuine OpenStreetMap Building Footprints & Road Network
  public osmBuildingsGroup: THREE.Group = new THREE.Group();
  public osmRoadsGroup: THREE.Group = new THREE.Group();
  public totalOsmBuildings: number = 2066;
  public totalOsmRoads: number = 938;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Environmental Lights
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.2);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.dirLight.position.set(40, 70, 30);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 250;
    this.dirLight.shadow.camera.left = -90;
    this.dirLight.shadow.camera.right = 90;
    this.dirLight.shadow.camera.top = 90;
    this.dirLight.shadow.camera.bottom = -90;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Obstacle Group container
    this.obstacleGroup = new THREE.Group();
    this.scene.add(this.obstacleGroup);

    this.scene.add(this.osmBuildingsGroup);
    this.scene.add(this.osmRoadsGroup);

    this.buildTerrainAndCorridor();
    this.buildRealOsmBuildings();
    this.buildRealOsmRoads();
    this.buildKurumbapalayamHub();
    this.buildCustomerZone();
    this.buildCorridorObstacles();
    this.buildRainAndWeather();
    this.buildFlightPaths();

    // Asynchronously load real ESRI High-Resolution satellite imagery tiles & Real DEM Elevation Mesh
    this.loadRealSatelliteTiles();
    this.loadRealElevationMesh();
  }

  /**
   * Builds the geographic terrain covering Kurumbapalayam and the Coimbatore delivery corridor
   */
  private buildTerrainAndCorridor() {
    // 1. Base Terrain Ground Plane
    const groundGeo = new THREE.PlaneGeometry(180, 180, 64, 64);

    // Initial procedural satellite canvas with realistic Coimbatore agricultural, road, and soil hues
    const initialCanvas = this.createFallbackTerrainCanvas();
    const initialTexture = new THREE.CanvasTexture(initialCanvas);
    initialTexture.wrapS = THREE.ClampToEdgeWrapping;
    initialTexture.wrapT = THREE.ClampToEdgeWrapping;

    this.groundMaterial = new THREE.MeshStandardMaterial({
      map: initialTexture,
      roughness: 0.85,
      metalness: 0.1,
    });

    const ground = new THREE.Mesh(groundGeo, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMesh = ground;

    // 2. Real OpenStreetMap Road Networks & Building Geometries
    // (Handled via buildRealOsmRoads() and buildRealOsmBuildings())

    // 4. Geographic Vegetation & Greenery along Coimbatore agrarian boundaries
    for (let t = 0; t < 28; t++) {
      const angle = (t / 28) * Math.PI * 2;
      const radius = 26 + (t % 4) * 6;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;

      // Keep delivery flight corridor clear
      if (Math.abs(tx) > 6) {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.2, 1.4, 6),
          new THREE.MeshStandardMaterial({ color: 0x475569 })
        );
        trunk.position.set(tx, 0.7, tz);
        trunk.castShadow = true;
        this.scene.add(trunk);

        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(1.0, 2.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.9 })
        );
        crown.position.set(tx, 2.2, tz);
        crown.castShadow = true;
        this.scene.add(crown);
      }
    }
  }

  /**
   * SkyHub Kurumbapalayam [11.1132, 77.0277] Multi-bay Droneport & Maintenance Hangar
   */
  private buildKurumbapalayamHub() {
    const hubPos = this.warehousePadPosition;

    // 1. SkyHub Kurumbapalayam Operations Command Hangar
    const whBuildingGeo = new THREE.BoxGeometry(20, 5.2, 14);
    const whBuildingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.35,
    });
    const whBuilding = new THREE.Mesh(whBuildingGeo, whBuildingMat);
    whBuilding.position.set(hubPos.x, 2.6, hubPos.z - 10);
    whBuilding.castShadow = true;
    whBuilding.receiveShadow = true;
    this.scene.add(whBuilding);

    // Hub Billboard Sign ("SKYHUB KURUMBAPALAYAM • COIMBATORE")
    const signGeo = new THREE.BoxGeometry(14, 1.4, 0.2);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(hubPos.x, 5.5, hubPos.z - 3);
    this.scene.add(signMesh);

    // 2. Primary Launch & Docking Pad 01 (Pad D-001)
    const padGeo = new THREE.CylinderGeometry(4.8, 5.2, 0.22, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.25,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(hubPos.x, 0.11, hubPos.z);
    pad.receiveShadow = true;
    this.scene.add(pad);

    // Outer Cyan Aviation Warning Ring
    const ringGeo = new THREE.RingGeometry(3.8, 4.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hubPos.x, 0.23, hubPos.z);
    this.scene.add(ring);

    // Primary Landing Target 'H'
    const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const barLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 2.6), barMat);
    barLeft.position.set(hubPos.x - 0.9, 0.24, hubPos.z);
    this.scene.add(barLeft);

    const barRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 2.6), barMat);
    barRight.position.set(hubPos.x + 0.9, 0.24, hubPos.z);
    this.scene.add(barRight);

    const barMid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.02, 0.35), barMat);
    barMid.position.set(hubPos.x, 0.24, hubPos.z);
    this.scene.add(barMid);

    // Pad ID Decal "PAD 01 - SKYHUB"
    const padTextGeo = new THREE.PlaneGeometry(2.4, 0.4);
    const padTextMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const padText = new THREE.Mesh(padTextGeo, padTextMat);
    padText.rotation.x = -Math.PI / 2;
    padText.position.set(hubPos.x, 0.24, hubPos.z + 2.8);
    this.scene.add(padText);

    // Auxiliary Launch Pads (Pad 02, Pad 03)
    [-7.5, 7.5].forEach((offset) => {
      const auxPad = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.6, 0.15, 24),
        padMat
      );
      auxPad.position.set(hubPos.x + offset, 0.08, hubPos.z);
      auxPad.receiveShadow = true;
      this.scene.add(auxPad);

      const auxRing = new THREE.Mesh(
        new THREE.RingGeometry(1.8, 2.1, 24),
        new THREE.MeshBasicMaterial({ color: 0x64748b, side: THREE.DoubleSide })
      );
      auxRing.rotation.x = -Math.PI / 2;
      auxRing.position.set(hubPos.x + offset, 0.17, hubPos.z);
      this.scene.add(auxRing);
    });

    // 3. RTK GNSS Differential Base Station Mast (30m tall)
    const rtkTowerGeo = new THREE.CylinderGeometry(0.18, 0.45, 18, 8);
    const rtkTowerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const rtkTower = new THREE.Mesh(rtkTowerGeo, rtkTowerMat);
    rtkTower.position.set(hubPos.x - 9.5, 9, hubPos.z - 8);
    rtkTower.castShadow = true;
    this.scene.add(rtkTower);

    // Blinking Red FAA/DGCA Obstruction Beacon at Mast Tip
    const beaconLight = new THREE.PointLight(0xef4444, 2.0, 15);
    beaconLight.position.set(hubPos.x - 9.5, 18.5, hubPos.z - 8);
    this.scene.add(beaconLight);

    // 4 Corner Runway Inset Beacons
    const beaconAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    beaconAngles.forEach((ang) => {
      const bx = hubPos.x + Math.cos(ang) * 4.6;
      const bz = hubPos.z + Math.sin(ang) * 4.6;
      const bLight = new THREE.PointLight(0x10b981, 1.4, 6);
      bLight.position.set(bx, 0.35, bz);
      this.scene.add(bLight);
    });
  }

  /**
   * Customer Delivery Drop-Off Zone [11.0725, 77.0345] (Kalapatti, Coimbatore)
   */
  private buildCustomerZone() {
    const custPos = this.customerPadPosition;

    // 1. Customer Residence / Drop Destination
    const houseGeo = new THREE.BoxGeometry(12, 4.2, 10);
    const houseMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
      metalness: 0.2,
    });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.set(custPos.x, 2.1, custPos.z + 8);
    house.castShadow = true;
    house.receiveShadow = true;
    this.scene.add(house);

    // 2. Precision Landing Zone
    const padGeo = new THREE.CylinderGeometry(3.6, 4.0, 0.16, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(custPos.x, 0.08, custPos.z);
    pad.receiveShadow = true;
    this.scene.add(pad);

    // Pulsing Concentric Emerald Target Ring
    const targetRingGeo = new THREE.RingGeometry(2.0, 2.6, 32);
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.set(custPos.x, 0.17, custPos.z);
    this.scene.add(targetRing);
    this.customerTargetRing = targetRing;

    // Bullseye Center Spot
    const bullseyeGeo = new THREE.CircleGeometry(0.7, 24);
    const bullseyeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const bullseye = new THREE.Mesh(bullseyeGeo, bullseyeMat);
    bullseye.rotation.x = -Math.PI / 2;
    bullseye.position.set(custPos.x, 0.18, custPos.z);
    this.scene.add(bullseye);

    // Laser Landing Guide Light
    const guideLight = new THREE.PointLight(0x10b981, 2.0, 10);
    guideLight.position.set(custPos.x, 0.8, custPos.z);
    this.scene.add(guideLight);
  }

  /**
   * Flight corridor obstacles with FAA/DGCA red collision warning beacons
   */
  private buildCorridorObstacles() {
    const obsPos = this.obstaclePosition;

    // High-Tension Transmission Pylon (SH-165 Airspace Obstacle)
    const mastHeight = 24;
    const mastGeo = new THREE.CylinderGeometry(0.35, 0.6, mastHeight, 8);
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.7,
      roughness: 0.3,
    });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(obsPos.x, mastHeight / 2, obsPos.z);
    mast.castShadow = true;
    this.obstacleGroup.add(mast);

    // Cross Arms
    [-2, 0, 2].forEach((yOffset) => {
      const armGeo = new THREE.BoxGeometry(6.5, 0.3, 0.3);
      const arm = new THREE.Mesh(armGeo, mastMat);
      arm.position.set(obsPos.x, mastHeight - 3 + yOffset, obsPos.z);
      this.obstacleGroup.add(arm);
    });

    // Flashing Red Hazard Strobe at Mast Tip
    const hazardStrobe = new THREE.PointLight(0xef4444, 2.8, 14);
    hazardStrobe.position.set(obsPos.x, mastHeight + 0.6, obsPos.z);
    this.obstacleGroup.add(hazardStrobe);

    // Collision Buffer Safety Zone Ring
    const ringGeo = new THREE.RingGeometry(6.0, 6.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const baseRing = new THREE.Mesh(ringGeo, ringMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(obsPos.x, 0.05, obsPos.z);
    this.obstacleGroup.add(baseRing);

    this.obstacleGroup.visible = true;
  }

  /**
   * Builds nominal and traversed flight path lines
   */
  private buildFlightPaths() {
    // Nominal Planned Corridor from SkyHub to Customer
    const nominalPoints = [
      new THREE.Vector3(0, 0.2, -35),
      new THREE.Vector3(0, 5, -28),
      new THREE.Vector3(4, 16, -14),
      new THREE.Vector3(8, 16, 8),
      new THREE.Vector3(12, 16, 24),
      new THREE.Vector3(12.05, 5, 34),
      new THREE.Vector3(12.05, 0.2, 38),
    ];
    const nominalCurve = new THREE.CatmullRomCurve3(nominalPoints);
    const nominalGeo = new THREE.BufferGeometry().setFromPoints(nominalCurve.getPoints(90));
    const nominalMat = new THREE.LineDashedMaterial({
      color: 0x0284c7,
      dashSize: 1.2,
      gapSize: 0.6,
      linewidth: 2,
    });
    const nominalLine = new THREE.Line(nominalGeo, nominalMat);
    nominalLine.computeLineDistances();
    this.scene.add(nominalLine);
    this.plannedPathLine = nominalLine;

    // Traversed Route Line
    const travMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 3 });
    const travGeo = new THREE.BufferGeometry().setFromPoints([nominalPoints[0], nominalPoints[0]]);
    const travLine = new THREE.Line(travGeo, travMat);
    this.scene.add(travLine);
    this.traversedPathLine = travLine;

    // Lateral Avoidance Path (Bypasses obstacle West)
    const reroutePoints = [
      new THREE.Vector3(0, 16, -10),
      new THREE.Vector3(-6, 16, 0),
      new THREE.Vector3(-6, 16, 10),
      new THREE.Vector3(6, 16, 22),
      new THREE.Vector3(12.05, 5, 34),
      new THREE.Vector3(12.05, 0.2, 38),
    ];
    const rerouteCurve = new THREE.CatmullRomCurve3(reroutePoints);
    const rerouteGeo = new THREE.BufferGeometry().setFromPoints(rerouteCurve.getPoints(60));
    const rerouteMat = new THREE.LineDashedMaterial({
      color: 0x10b981,
      dashSize: 0.8,
      gapSize: 0.4,
    });
    const rerouteLine = new THREE.Line(rerouteGeo, rerouteMat);
    rerouteLine.computeLineDistances();
    rerouteLine.visible = false;
    this.scene.add(rerouteLine);
    this.reroutedPathLine = rerouteLine;
  }

  /**
   * Weather and rain simulation
   */
  private buildRainAndWeather() {
    const rainCount = 1200;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
      velocities[i] = 1.2 + Math.random() * 0.8;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocity = velocities;

    const rainMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.18,
      transparent: true,
      opacity: 0.0,
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);
  }

  /**
   * Asynchronously loads real ESRI High-Resolution satellite imagery tiles
   * covering the Kurumbapalayam -> Kalapatti corridor into an HTML5 CanvasTexture.
   */
  private async loadRealSatelliteTiles() {
    try {
      // Bounding box tiles at zoom 15:
      // x: 23394 to 23396 (3 columns)
      // y: 15365 to 15369 (5 rows)
      const zoom = 15;
      const minX = 23394;
      const maxX = 23396;
      const minY = 15365;
      const maxY = 15369;

      const cols = maxX - minX + 1; // 3
      const rows = maxY - minY + 1; // 5
      const tileSize = 256;

      const canvas = document.createElement('canvas');
      canvas.width = cols * tileSize;
      canvas.height = rows * tileSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw initial dark satellite base
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let loadedTiles = 0;
      const totalTiles = cols * rows;

      const loadTile = (x: number, y: number, col: number, row: number): Promise<void> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
            loadedTiles++;
            resolve();
          };
          img.onerror = () => {
            // Silently proceed if individual tile fails
            resolve();
          };
          img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
        });
      };

      const tilePromises: Promise<void>[] = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          tilePromises.push(loadTile(minX + c, minY + r, c, r));
        }
      }

      await Promise.all(tilePromises);

      // If tiles loaded, apply the real satellite texture to the ground plane
      if (loadedTiles > 0 && this.groundMaterial) {
        const satelliteTexture = new THREE.CanvasTexture(canvas);
        satelliteTexture.anisotropy = 8;
        satelliteTexture.wrapS = THREE.ClampToEdgeWrapping;
        satelliteTexture.wrapT = THREE.ClampToEdgeWrapping;
        this.groundMaterial.map = satelliteTexture;
        this.groundMaterial.needsUpdate = true;
      }
    } catch (e) {
      console.warn('Real satellite tiles loading fallback:', e);
    }
  }

  /**
   * Asynchronously loads real Digital Elevation Model (DEM) data from
   * AWS Open Data Terrarium elevation tiles (SRTM/Copernicus global 30m DEM)
   * covering Kurumbapalayam [11.1132, 77.0277] to Kalapatti [11.0725, 77.0345].
   * Decodes elevation in meters: H = (R * 256 + G + B / 256) - 32768
   * Displaces vertices of the terrain PlaneGeometry to create true 3D topography.
   */
  private async loadRealElevationMesh() {
    if (!this.groundMesh) return;
    try {
      const zoom = 14;
      const tileX = 11697;
      const northTileY = 7683; // Kurumbapalayam
      const southTileY = 7684; // Kalapatti

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const loadTile = (url: string, yOffset: number): Promise<void> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, 0, yOffset, 256, 256);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
      };

      await Promise.all([
        loadTile(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tileX}/${northTileY}.png`, 0),
        loadTile(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tileX}/${southTileY}.png`, 256),
      ]);

      const imgData = ctx.getImageData(0, 0, 256, 512);
      const pixels = imgData.data;
      const heightmap = new Float32Array(256 * 512);

      for (let i = 0; i < heightmap.length; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        const elevationM = (r * 256 + g + b / 256) - 32768;
        heightmap[i] = elevationM;
      }
      this.realDemHeightmap = heightmap;

      // Displace ground mesh geometry vertices
      const geo = this.groundMesh.geometry as THREE.PlaneGeometry;
      const posAttr = geo.attributes.position;
      if (!posAttr) return;

      // Sample Kurumbapalayam base elevation at center north (u=0.5, v=0.2)
      const baseSampleIdx = Math.floor(0.2 * 512) * 256 + 128;
      const sampleBaseElevation = heightmap[baseSampleIdx] || 392.0;
      this.baseElevationMsl = sampleBaseElevation;

      const elevationScale = 0.12; // 10m elevation delta = 1.2 scene height units

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);

        // Map local PlaneGeometry (-90..+90) to normalized UV (0..1)
        const u = Math.max(0, Math.min(1, (vx + 90) / 180));
        // Note: local Y=+90 is North (world -Z), mapped to top of DEM (v=0)
        const v = Math.max(0, Math.min(1, (90 - vy) / 180));

        const px = Math.min(255, Math.floor(u * 256));
        const py = Math.min(511, Math.floor(v * 512));
        const demElevation = heightmap[py * 256 + px] || sampleBaseElevation;

        // Relative elevation from Kurumbapalayam hub
        const deltaMeters = demElevation - sampleBaseElevation;
        const localZ = deltaMeters * elevationScale; // Local Z maps to world +Y after rotation.x = -PI/2

        posAttr.setZ(i, localZ);
      }

      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
      this.isRealDemLoaded = true;

      // Adjust Hub pad and Customer pad to anchor directly to ground elevation
      this.warehousePadPosition.y = this.getGroundElevationAt(this.warehousePadPosition.x, this.warehousePadPosition.z) + 0.05;
      this.customerPadPosition.y = this.getGroundElevationAt(this.customerPadPosition.x, this.customerPadPosition.z) + 0.05;

      // Re-anchor real OpenStreetMap buildings and roads onto newly loaded DEM elevation mesh
      this.buildRealOsmBuildings();
      this.buildRealOsmRoads();

      console.log(`[Environment3D] Real DEM Elevation Mesh Loaded: Base MSL = ${this.baseElevationMsl.toFixed(1)}m, Vertex displacement active.`);
    } catch (err) {
      console.warn('[Environment3D] Real DEM tile loading error:', err);
    }
  }

  /**
   * Builds genuine 3D building geometry extruded from OpenStreetMap (OSM) footprints
   * for the Kurumbapalayam [11.1132, 77.0277] to Kalapatti [11.0725, 77.0345] delivery corridor.
   * Total 2,066 real OSM building polygons.
   * Ground base is placed directly on the real DEM elevation mesh surface.
   */
  public buildRealOsmBuildings() {
    if (this.osmBuildingsGroup.children.length > 0) {
      this.osmBuildingsGroup.clear();
    }

    const buildingMaterials = {
      commercial: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 }), // Slate glass
      education: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.25 }),   // Academic campus
      hotel: new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4, metalness: 0.4 }),         // Modern hotel
      industrial: new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6, metalness: 0.3 }),    // Industrial
      residential: new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.65, metalness: 0.15 }), // Suburban homes
    };

    const geosByCategory: Record<string, THREE.BufferGeometry[]> = {
      commercial: [],
      education: [],
      hotel: [],
      industrial: [],
      residential: [],
    };

    const buildings = (osmCorridorData as any).buildings || [];
    this.totalOsmBuildings = buildings.length;

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (!b.pts || b.pts.length < 3) continue;

      // Classify category
      let category = 'residential';
      if (b.type === 'commercial' || b.type === 'office' || (b.name && b.name.includes('Tech Park'))) {
        category = 'commercial';
      } else if (b.type === 'college' || b.type === 'school' || b.type === 'university' || (b.name && (b.name.includes('KVIMIS') || b.name.includes('College')))) {
        category = 'education';
      } else if (b.type === 'hotel' || b.type === 'apartments' || (b.name && b.name.includes('Lemon Tree'))) {
        category = 'hotel';
      } else if (b.type === 'industrial' || b.type === 'warehouse') {
        category = 'industrial';
      }

      // Height determination:
      // 1. Genuine OSM 'height' tag (if present)
      // 2. Genuine OSM 'building:levels' tag (levels * 3.2m)
      // 3. Estimated height based on building category
      let hMeters = 8;
      if (b.height && b.height > 0) {
        hMeters = b.height;
      } else if (b.levels && b.levels > 0) {
        hMeters = b.levels * 3.2;
      } else if (category === 'commercial') {
        hMeters = 16;
      } else if (category === 'hotel') {
        hMeters = 15;
      } else if (category === 'industrial') {
        hMeters = 12;
      } else if (category === 'education') {
        hMeters = 12;
      }

      // Proportional scene height (cruising altitude 75m MSL = 16.0 scene units)
      const hScene = Math.max(0.6, (hMeters / 75) * 16);

      // Create 2D polygon shape in local coordinates
      const shape = new THREE.Shape();
      shape.moveTo(b.pts[0][0], b.pts[0][1]);
      for (let p = 1; p < b.pts.length; p++) {
        shape.lineTo(b.pts[p][0], b.pts[p][1]);
      }
      shape.closePath();

      try {
        const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: hScene, bevelEnabled: false });
        // Rotate so extrusion points towards world +Y
        extrudeGeo.rotateX(Math.PI / 2);

        // Sample real DEM terrain elevation at centroid
        const groundY = this.getGroundElevationAt(b.cx, b.cz);
        // Translate base flush with DEM ground and position at (cx, cz)
        extrudeGeo.translate(b.cx, groundY + hScene, b.cz);

        geosByCategory[category].push(extrudeGeo);

        // Prominent Landmark Decorative Features
        if (b.name === 'SVB Tech Park' || (b.levels && b.levels >= 8)) {
          // Aviation obstruction strobe on SVB Tech Park
          const strobe = new THREE.PointLight(0xef4444, 1.2, 10);
          strobe.position.set(b.cx, groundY + hScene + 0.8, b.cz);
          this.osmBuildingsGroup.add(strobe);

          const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 1.0),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
          );
          mast.position.set(b.cx, groundY + hScene + 0.5, b.cz);
          this.osmBuildingsGroup.add(mast);
        } else if (b.name === 'Lemon Tree Coimbatore') {
          const hotelBeacon = new THREE.PointLight(0xf59e0b, 0.8, 8);
          hotelBeacon.position.set(b.cx, groundY + hScene + 0.5, b.cz);
          this.osmBuildingsGroup.add(hotelBeacon);
        }
      } catch (err) {
        // Skip degenerate polygon
      }
    }

    // Merge geometries by category and create high-performance WebGL meshes
    for (const [cat, geos] of Object.entries(geosByCategory)) {
      if (geos.length === 0) continue;
      try {
        const merged = BufferGeometryUtils.mergeGeometries(geos, false);
        if (merged) {
          const mat = buildingMaterials[cat as keyof typeof buildingMaterials] || buildingMaterials.residential;
          const mesh = new THREE.Mesh(merged, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.osmBuildingsGroup.add(mesh);
        }
      } catch (err) {
        console.warn(`Failed to merge OSM buildings for category ${cat}:`, err);
      }
    }
  }

  /**
   * Builds genuine OpenStreetMap (OSM) road networks for the delivery corridor.
   * Total 938 road segments (arterial highways and local streets).
   * Mapped directly on top of real DEM terrain topography.
   */
  public buildRealOsmRoads() {
    if (this.osmRoadsGroup.children.length > 0) {
      this.osmRoadsGroup.clear();
    }

    const roads = (osmCorridorData as any).roads || [];
    this.totalOsmRoads = roads.length;

    const arterialGeos: THREE.BufferGeometry[] = [];
    const localGeos: THREE.BufferGeometry[] = [];

    for (let r = 0; r < roads.length; r++) {
      const rd = roads[r];
      if (!rd.pts || rd.pts.length < 2) continue;

      const isArterial = rd.type === 'arterial';
      const halfWidth = isArterial ? 0.6 : 0.3; // Scene width in units

      const vertices: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i < rd.pts.length - 1; i++) {
        const p1 = rd.pts[i];
        const p2 = rd.pts[i + 1];
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const len = Math.hypot(dx, dz);
        if (len < 0.01) continue;

        const nx = (-dz / len) * halfWidth;
        const nz = (dx / len) * halfWidth;

        const y1 = this.getGroundElevationAt(p1[0], p1[1]) + 0.04;
        const y2 = this.getGroundElevationAt(p2[0], p2[1]) + 0.04;

        const baseIdx = vertices.length / 3;
        vertices.push(p1[0] - nx, y1, p1[1] - nz);
        vertices.push(p1[0] + nx, y1, p1[1] + nz);
        vertices.push(p2[0] - nx, y2, p2[1] - nz);
        vertices.push(p2[0] + nx, y2, p2[1] + nz);

        indices.push(baseIdx, baseIdx + 2, baseIdx + 1);
        indices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3);
      }

      if (vertices.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        if (isArterial) arterialGeos.push(geo);
        else localGeos.push(geo);
      }
    }

    if (arterialGeos.length > 0) {
      const mergedArterial = BufferGeometryUtils.mergeGeometries(arterialGeos, false);
      if (mergedArterial) {
        const arterialMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.8,
          metalness: 0.2,
        });
        const arterialMesh = new THREE.Mesh(mergedArterial, arterialMat);
        arterialMesh.receiveShadow = true;
        this.osmRoadsGroup.add(arterialMesh);
      }
    }

    if (localGeos.length > 0) {
      const mergedLocal = BufferGeometryUtils.mergeGeometries(localGeos, false);
      if (mergedLocal) {
        const localMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.85,
          metalness: 0.15,
        });
        const localMesh = new THREE.Mesh(mergedLocal, localMat);
        localMesh.receiveShadow = true;
        this.osmRoadsGroup.add(localMesh);
      }
    }
  }

  /**
   * Checks visual clearance between the drone 3D position and real OSM buildings.
   * Returns minimum clearance metrics and whether any safety envelope violation exists.
   */
  public checkBuildingClearance(dronePos: THREE.Vector3): { minHorizontalDistM: number; minVerticalDistM: number; clear: boolean } {
    let minH = 999;
    let minV = 999;
    const buildings = (osmCorridorData as any).buildings || [];

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const hDist = Math.hypot(dronePos.x - b.cx, dronePos.z - b.cz);
      if (hDist < 3.0) { // within ~180m horizontal corridor
        const groundY = this.getGroundElevationAt(b.cx, b.cz);
        let hMeters = 8;
        if (b.height) hMeters = b.height;
        else if (b.levels) hMeters = b.levels * 3.2;
        const bTopY = groundY + (hMeters / 75) * 16;
        const vDist = dronePos.y - bTopY;

        if (hDist < minH) minH = hDist;
        if (vDist < minV) minV = vDist;
      }
    }

    const minHorizontalDistM = minH < 999 ? minH * (4500 / 73) : 500;
    const minVerticalDistM = minV < 999 ? (minV / 16) * 75 : 50;
    return {
      minHorizontalDistM: parseFloat(minHorizontalDistM.toFixed(1)),
      minVerticalDistM: parseFloat(minVerticalDistM.toFixed(1)),
      clear: minVerticalDistM > 10.0 || minHorizontalDistM > 25.0,
    };
  }

  /**
   * Returns the exact ground elevation in Three.js world Y units
   * derived from the real AWS Terrarium DEM heightmap.
   */
  public getGroundElevationAt(worldX: number, worldZ: number): number {
    if (!this.realDemHeightmap || !this.isRealDemLoaded) {
      return 0.0;
    }
    const u = Math.max(0, Math.min(1, (worldX + 90) / 180));
    const v = Math.max(0, Math.min(1, (worldZ + 90) / 180));
    const px = Math.min(255, Math.floor(u * 256));
    const py = Math.min(511, Math.floor(v * 512));
    const demElevation = this.realDemHeightmap[py * 256 + px] || this.baseElevationMsl;
    const deltaMeters = demElevation - this.baseElevationMsl;
    return deltaMeters * 0.12;
  }

  /**
   * Diagnostic provider configuration reporter
   */
  public static getActiveProviderInfo() {
    const mapbox = (import.meta as any).env?.VITE_MAPBOX_TOKEN;
    const cesium = (import.meta as any).env?.VITE_CESIUM_ION_TOKEN;
    const google = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;

    return {
      activeEngine: 'Three.js WebGL Real DEM + OSM Buildings + ESRI World Imagery',
      terrainSource: 'AWS Open Data Terrarium DEM (SRTM/Copernicus 30m) - 399.6m MSL Base',
      satelliteSource: 'ESRI ArcGIS Online High-Resolution World Imagery',
      buildingSource: 'OpenStreetMap Building Polygons (2,066 Extruded Footprints)',
      roadSource: 'OpenStreetMap Road Network (938 Arterial & Local Segments)',
      configuredTokens: {
        mapbox: Boolean(mapbox),
        cesium: Boolean(cesium),
        google: Boolean(google),
      },
    };
  }

  /**
   * Procedural fallback terrain canvas with authentic Kurumbapalayam agrarian and road patterns
   */
  private createFallbackTerrainCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Dark slate soil / aerial background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 1024);

    // Agricultural parcel textures typical of Kurumbapalayam outskirts
    const parcels = [
      { x: 80, y: 120, w: 220, h: 180, c: '#142334' },
      { x: 340, y: 80, w: 280, h: 220, c: '#11293a' },
      { x: 660, y: 140, w: 240, h: 200, c: '#162b33' },
      { x: 120, y: 380, w: 260, h: 240, c: '#0d2230' },
      { x: 620, y: 400, w: 320, h: 280, c: '#132838' },
      { x: 180, y: 700, w: 340, h: 220, c: '#152433' },
      { x: 580, y: 720, w: 280, h: 200, c: '#102232' },
    ];

    parcels.forEach((p) => {
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    });

    // Subtle aviation coordinate grid
    ctx.strokeStyle = '#0ea5e922';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    return canvas;
  }

  /**
   * Deterministic obstacle safety altitude helper
   * Ensures drone altitude stays at least 10m above any corridor obstacle
   */
  public getSafeAltitude(x: number, z: number): number {
    // Tallest structure along corridor is 24m
    const minSafeCeiling = 34; // 24m + 10m buffer
    // Near hub pad or customer pad, allow descent
    const distHub = Math.hypot(x - this.warehousePadPosition.x, z - this.warehousePadPosition.z);
    const distCust = Math.hypot(x - this.customerPadPosition.x, z - this.customerPadPosition.z);

    if (distHub < 8 || distCust < 8) {
      return 0.2; // Landing altitude allowed
    }
    return minSafeCeiling;
  }

  public updateEnvironment(delta: number, settings: EnvironmentSettings, isRerouted: boolean) {
    this.animTimer += delta;

    // 1. Pulsing Customer Target Ring
    if (this.customerTargetRing) {
      const scale = 1 + 0.08 * Math.sin(this.animTimer * 4);
      this.customerTargetRing.scale.set(scale, scale, 1);
    }

    // 2. Weather & Rain Particles
    if (this.rainParticles && this.rainVelocity) {
      const isRaining = settings.weather === 'rain' || settings.weather === 'storm';
      const rainMat = this.rainParticles.material as THREE.PointsMaterial;
      rainMat.opacity = isRaining ? (settings.weather === 'storm' ? 0.75 : 0.45) : 0;

      if (isRaining) {
        const positions = this.rainParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < this.rainVelocity.length; i++) {
          positions[i * 3 + 1] -= this.rainVelocity[i] * delta * 40;
          if (settings.weather === 'storm' || settings.weather === 'wind') {
            positions[i * 3] += delta * 12;
          }
          if (positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = 60;
          }
        }
        this.rainParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 3. Lighting & Time of Day Presets
    if (settings.timeOfDay === 'day') {
      this.dirLight.color.setHex(0xffffff);
      this.dirLight.intensity = 1.6;
      this.hemiLight.color.setHex(0xdbeafe);
      this.hemiLight.groundColor.setHex(0x334155);
      this.hemiLight.intensity = 1.2;
    } else if (settings.timeOfDay === 'sunset') {
      this.dirLight.color.setHex(0xf97316);
      this.dirLight.intensity = 1.4;
      this.hemiLight.color.setHex(0xf43f5e);
      this.hemiLight.groundColor.setHex(0x1e1b4b);
      this.hemiLight.intensity = 0.8;
    } else if (settings.timeOfDay === 'night') {
      this.dirLight.color.setHex(0x38bdf8);
      this.dirLight.intensity = 0.25;
      this.hemiLight.color.setHex(0x0f172a);
      this.hemiLight.groundColor.setHex(0x020617);
      this.hemiLight.intensity = 0.4;
    }

    // 4. Reroute Path Visibility
    if (this.reroutedPathLine) {
      this.reroutedPathLine.visible = isRerouted;
    }
  }

  public updateTraversedPath(currentPos: THREE.Vector3, historyPoints: THREE.Vector3[]) {
    if (this.traversedPathLine && historyPoints.length > 1) {
      this.traversedPathLine.geometry.setFromPoints(historyPoints);
      this.traversedPathLine.geometry.attributes.position.needsUpdate = true;
    }
  }
}
