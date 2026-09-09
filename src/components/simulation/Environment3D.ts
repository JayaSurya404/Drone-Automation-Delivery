import * as THREE from 'three';

export interface EnvironmentSettings {
  weather: 'clear' | 'cloudy' | 'rain' | 'wind' | 'storm';
  timeOfDay: 'day' | 'sunset' | 'night';
  visibility: 'high' | 'medium' | 'low';
}

export class Environment3D {
  public scene: THREE.Scene;
  public warehousePadPosition = new THREE.Vector3(0, 0.05, -35);
  public customerPadPosition = new THREE.Vector3(0, 0.05, 38);
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

  private rainVelocity: Float32Array | null = null;
  private animTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Default Lights
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(30, 60, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 200;
    this.dirLight.shadow.camera.left = -60;
    this.dirLight.shadow.camera.right = 60;
    this.dirLight.shadow.camera.top = 60;
    this.dirLight.shadow.camera.bottom = -60;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Obstacle Group container
    this.obstacleGroup = new THREE.Group();
    this.scene.add(this.obstacleGroup);

    this.buildTerrainAndCity();
    this.buildWarehouseHub();
    this.buildCustomerZone();
    this.buildObstacleTower();
    this.buildRainAndWeather();
    this.buildFlightPaths();
  }

  private buildTerrainAndCity() {
    // 1. Ground Plane (Asphalt/Ground with Subtle Grid)
    const groundGeo = new THREE.PlaneGeometry(160, 160, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Slate 900
      roughness: 0.85,
      metalness: 0.15,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Subtle Aviation Grid GridHelper
    const grid = new THREE.GridHelper(150, 75, 0x0ea5e9, 0x1e293b);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // 2. Road Network & Arterials
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const roadGeoV = new THREE.PlaneGeometry(6, 150);
    const roadV1 = new THREE.Mesh(roadGeoV, roadMat);
    roadV1.rotation.x = -Math.PI / 2;
    roadV1.position.set(-18, 0.03, 0);
    roadV1.receiveShadow = true;
    this.scene.add(roadV1);

    const roadV2 = new THREE.Mesh(roadGeoV, roadMat);
    roadV2.rotation.x = -Math.PI / 2;
    roadV2.position.set(18, 0.03, 0);
    roadV2.receiveShadow = true;
    this.scene.add(roadV2);

    const roadGeoH = new THREE.PlaneGeometry(150, 6);
    const roadH1 = new THREE.Mesh(roadGeoH, roadMat);
    roadH1.rotation.x = -Math.PI / 2;
    roadH1.position.set(0, 0.03, 0);
    roadH1.receiveShadow = true;
    this.scene.add(roadH1);

    // 3. Procedural Urban Skyline (28 stylized buildings)
    const buildingMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 }), // Slate Blue Glass
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 }), // Concrete Tower
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 }), // Modern Dark Glass
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6, metalness: 0.3 }), // Gray Tower
    ];

    const buildingLayouts = [
      // Left Cluster (Commercial & Medical District)
      { x: -32, z: -25, w: 10, d: 10, h: 18, isHospital: true },
      { x: -32, z: -10, w: 12, d: 8, h: 26, isHospital: false },
      { x: -32, z: 8, w: 9, d: 11, h: 14, isHospital: false },
      { x: -32, z: 25, w: 11, d: 9, h: 22, isHospital: false },
      { x: -48, z: -20, w: 10, d: 12, h: 32, isHospital: false },
      { x: -48, z: 0, w: 12, d: 10, h: 28, isHospital: false },
      { x: -48, z: 20, w: 9, d: 9, h: 16, isHospital: false },

      // Right Cluster (Tech Parks & Residential Towers)
      { x: 32, z: -25, w: 11, d: 9, h: 24, isHospital: false },
      { x: 32, z: -8, w: 10, d: 12, h: 30, isHospital: false },
      { x: 32, z: 12, w: 12, d: 8, h: 18, isHospital: false },
      { x: 32, z: 28, w: 9, d: 10, h: 25, isHospital: false },
      { x: 48, z: -18, w: 10, d: 10, h: 20, isHospital: false },
      { x: 48, z: 5, w: 12, d: 12, h: 36, isHospital: false },
      { x: 48, z: 24, w: 10, d: 8, h: 22, isHospital: false },

      // Perimeter Corner Buildings
      { x: -10, z: -55, w: 14, d: 10, h: 15, isHospital: false },
      { x: 10, z: -55, w: 14, d: 10, h: 15, isHospital: false },
      { x: -10, z: 55, w: 12, d: 10, h: 14, isHospital: false },
      { x: 10, z: 55, w: 12, d: 10, h: 14, isHospital: false },
    ];

    buildingLayouts.forEach((b, i) => {
      const mat = buildingMaterials[i % buildingMaterials.length];
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const bMesh = new THREE.Mesh(bGeo, mat);
      bMesh.position.set(b.x, b.h / 2, b.z);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      this.scene.add(bMesh);

      // Rooftop Perimeter trim
      const roofTrimGeo = new THREE.BoxGeometry(b.w + 0.3, 0.4, b.d + 0.3);
      const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
      const roofTrim = new THREE.Mesh(roofTrimGeo, roofTrimMat);
      roofTrim.position.set(b.x, b.h + 0.2, b.z);
      this.scene.add(roofTrim);

      // Rooftop HVAC units / Antenna Mast
      if (b.h > 20) {
        const hvacGeo = new THREE.BoxGeometry(2, 1.2, 2.5);
        const hvacMesh = new THREE.Mesh(hvacGeo, buildingMaterials[1]);
        hvacMesh.position.set(b.x + 1.5, b.h + 0.8, b.z);
        this.scene.add(hvacMesh);

        // Warning Aircraft Obstruction Strobe Light atop tall towers
        const strobeLight = new THREE.PointLight(0xef4444, 0.8, 6);
        strobeLight.position.set(b.x, b.h + 1.2, b.z);
        this.scene.add(strobeLight);
      }

      // Hospital Marker Decal
      if (b.isHospital) {
        const crossH = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.6, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        crossH.position.set(b.x, b.h * 0.75, b.z + b.d / 2 + 0.1);
        this.scene.add(crossH);
        const crossV = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 2.4, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        crossV.position.set(b.x, b.h * 0.75, b.z + b.d / 2 + 0.1);
        this.scene.add(crossV);
      }
    });

    // 4. Urban Trees & Green Belts
    for (let t = 0; t < 24; t++) {
      const angle = (t / 24) * Math.PI * 2;
      const radius = 22 + (t % 3) * 4;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;

      // Avoid middle delivery lane
      if (Math.abs(tx) > 5) {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x475569 })
        );
        trunk.position.set(tx, 0.6, tz);
        trunk.castShadow = true;
        this.scene.add(trunk);

        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(0.8, 1.8, 7),
          new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.9 })
        );
        crown.position.set(tx, 1.8, tz);
        crown.castShadow = true;
        this.scene.add(crown);
      }
    }
  }

  private buildWarehouseHub() {
    const hubPos = this.warehousePadPosition;

    // 1. Warehouse Main Logistics Facility Building
    const whBuildingGeo = new THREE.BoxGeometry(16, 4.5, 12);
    const whBuildingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.4,
    });
    const whBuilding = new THREE.Mesh(whBuildingGeo, whBuildingMat);
    whBuilding.position.set(hubPos.x, 2.25, hubPos.z - 8);
    whBuilding.castShadow = true;
    whBuilding.receiveShadow = true;
    this.scene.add(whBuilding);

    // Warehouse Billboard Sign ("SKYNAV HUB 01")
    const signGeo = new THREE.BoxGeometry(8, 1.2, 0.2);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(hubPos.x, 4.8, hubPos.z - 2);
    this.scene.add(signMesh);

    // 2. Concrete Helipad Platform
    const padGeo = new THREE.CylinderGeometry(4.5, 4.8, 0.2, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.2,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(hubPos.x, 0.1, hubPos.z);
    pad.receiveShadow = true;
    this.scene.add(pad);

    // Outer Yellow/Cyan Warning Ring
    const ringGeo = new THREE.RingGeometry(3.6, 4.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hubPos.x, 0.21, hubPos.z);
    this.scene.add(ring);

    // Large 'H' Landing Target Marker
    const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const barLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 2.4), barMat);
    barLeft.position.set(hubPos.x - 0.8, 0.22, hubPos.z);
    this.scene.add(barLeft);

    const barRight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 2.4), barMat);
    barRight.position.set(hubPos.x + 0.8, 0.22, hubPos.z);
    this.scene.add(barRight);

    const barMid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.3), barMat);
    barMid.position.set(hubPos.x, 0.22, hubPos.z);
    this.scene.add(barMid);

    // 4 Corner Runway Inset Beacons
    const beaconAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    beaconAngles.forEach((ang) => {
      const bx = hubPos.x + Math.cos(ang) * 4.2;
      const bz = hubPos.z + Math.sin(ang) * 4.2;
      const bLight = new THREE.PointLight(0x10b981, 1.2, 5);
      bLight.position.set(bx, 0.3, bz);
      this.scene.add(bLight);
    });
  }

  private buildCustomerZone() {
    const custPos = this.customerPadPosition;

    // 1. Customer Residence / Receiver Building
    const houseGeo = new THREE.BoxGeometry(12, 4, 10);
    const houseMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
    });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.set(custPos.x, 2, custPos.z + 8);
    house.castShadow = true;
    house.receiveShadow = true;
    this.scene.add(house);

    // 2. Smart Delivery Zone Precision Landing Pad
    const padGeo = new THREE.CylinderGeometry(3.5, 3.8, 0.15, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(custPos.x, 0.08, custPos.z);
    pad.receiveShadow = true;
    this.scene.add(pad);

    // Pulsing Concentric Circles Target Ring
    const targetRingGeo = new THREE.RingGeometry(1.8, 2.4, 32);
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981, // Emerald Green
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.set(custPos.x, 0.16, custPos.z);
    this.scene.add(targetRing);
    this.customerTargetRing = targetRing;

    // Inner Bullseye Spot
    const bullseyeGeo = new THREE.CircleGeometry(0.6, 24);
    const bullseyeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const bullseye = new THREE.Mesh(bullseyeGeo, bullseyeMat);
    bullseye.rotation.x = -Math.PI / 2;
    bullseye.position.set(custPos.x, 0.17, custPos.z);
    this.scene.add(bullseye);

    // Laser Guide Beacon Light (Subtle upward light beam)
    const guideLight = new THREE.PointLight(0x10b981, 1.8, 8);
    guideLight.position.set(custPos.x, 0.6, custPos.z);
    this.scene.add(guideLight);
  }

  private buildObstacleTower() {
    const obsPos = this.obstaclePosition;

    // High-Rise Construction Crane / Temporary Obstacle Mast
    const mastHeight = 22;
    const mastGeo = new THREE.CylinderGeometry(0.3, 0.45, mastHeight, 8);
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Warning Amber
      metalness: 0.7,
      roughness: 0.3,
    });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(obsPos.x, mastHeight / 2, obsPos.z);
    mast.castShadow = true;
    this.obstacleGroup.add(mast);

    // Horizontal Crane Jib Arm
    const jibGeo = new THREE.BoxGeometry(0.4, 0.4, 10);
    const jib = new THREE.Mesh(jibGeo, mastMat);
    jib.position.set(obsPos.x, mastHeight - 0.2, obsPos.z + 2);
    this.obstacleGroup.add(jib);

    // Flashing Red Hazard Strobe at Mast Tip
    const hazardStrobe = new THREE.PointLight(0xef4444, 2.5, 12);
    hazardStrobe.position.set(obsPos.x, mastHeight + 0.5, obsPos.z);
    this.obstacleGroup.add(hazardStrobe);

    // Transparent Proximity Hazard Bubble / Collision Envelope
    const bubbleGeo = new THREE.SphereGeometry(6.5, 24, 24);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    bubble.position.set(obsPos.x, 14, obsPos.z);
    this.obstacleGroup.add(bubble);

    // Warning Base Decal
    const ringGeo = new THREE.RingGeometry(5.8, 6.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const baseRing = new THREE.Mesh(ringGeo, ringMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(obsPos.x, 0.05, obsPos.z);
    this.obstacleGroup.add(baseRing);

    // By default, show when obstacle active
    this.obstacleGroup.visible = true;
  }

  private buildFlightPaths() {
    // 1. Nominal Planned Route Curve (Warehouse -> Customer)
    const nominalPoints = [
      new THREE.Vector3(0, 0.2, -35),
      new THREE.Vector3(0, 4, -30),
      new THREE.Vector3(0, 16, -18),
      new THREE.Vector3(0, 16, 0),
      new THREE.Vector3(0, 16, 18),
      new THREE.Vector3(0, 4, 32),
      new THREE.Vector3(0, 0.2, 38),
    ];
    const nominalCurve = new THREE.CatmullRomCurve3(nominalPoints);
    const nominalGeo = new THREE.BufferGeometry().setFromPoints(nominalCurve.getPoints(80));
    const nominalMat = new THREE.LineDashedMaterial({
      color: 0x0284c7, // Sky blue
      dashSize: 1.0,
      gapSize: 0.6,
      linewidth: 2,
    });
    const nominalLine = new THREE.Line(nominalGeo, nominalMat);
    nominalLine.computeLineDistances();
    this.scene.add(nominalLine);
    this.plannedPathLine = nominalLine;

    // 2. Traversed Route (Dynamically updated during flight)
    const travMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 3 });
    const travGeo = new THREE.BufferGeometry().setFromPoints([nominalPoints[0], nominalPoints[0]]);
    const travLine = new THREE.Line(travGeo, travMat);
    this.scene.add(travLine);
    this.traversedPathLine = travLine;

    // 3. Autonomous Rerouted Path (Bypasses obstacle on lateral corridor)
    const reroutePoints = [
      new THREE.Vector3(0, 16, -12),
      new THREE.Vector3(-8, 16, -2), // Lateral bypass West
      new THREE.Vector3(-8, 16, 12),
      new THREE.Vector3(0, 16, 22),
      new THREE.Vector3(0, 4, 32),
      new THREE.Vector3(0, 0.2, 38),
    ];
    const rerouteCurve = new THREE.CatmullRomCurve3(reroutePoints);
    const rerouteGeo = new THREE.BufferGeometry().setFromPoints(rerouteCurve.getPoints(60));
    const rerouteMat = new THREE.LineDashedMaterial({
      color: 0x10b981, // Emerald Green
      dashSize: 0.8,
      gapSize: 0.4,
    });
    const rerouteLine = new THREE.Line(rerouteGeo, rerouteMat);
    rerouteLine.computeLineDistances();
    rerouteLine.visible = false;
    this.scene.add(rerouteLine);
    this.reroutedPathLine = rerouteLine;
  }

  private buildRainAndWeather() {
    // 1500 rain particles
    const rainCount = 1500;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
      velocities[i] = 1.2 + Math.random() * 0.8;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocity = velocities;

    const rainMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.18,
      transparent: true,
      opacity: 0.0, // Hidden in clear mode
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);
  }

  public updateEnvironment(delta: number, settings: EnvironmentSettings, isRerouted: boolean) {
    this.animTimer += delta;

    // 1. Pulsing Customer Target Ring
    if (this.customerTargetRing) {
      const scale = 1 + 0.1 * Math.sin(this.animTimer * 4);
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
            positions[i * 3] += delta * 12; // Wind drift
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
      this.dirLight.intensity = 1.5;
      this.hemiLight.color.setHex(0xdbeafe);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 1.0;
    } else if (settings.timeOfDay === 'sunset') {
      this.dirLight.color.setHex(0xf97316); // Golden Amber
      this.dirLight.intensity = 1.3;
      this.hemiLight.color.setHex(0xf43f5e);
      this.hemiLight.groundColor.setHex(0x1e1b4b);
      this.hemiLight.intensity = 0.8;
    } else if (settings.timeOfDay === 'night') {
      this.dirLight.color.setHex(0x38bdf8);
      this.dirLight.intensity = 0.2;
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
