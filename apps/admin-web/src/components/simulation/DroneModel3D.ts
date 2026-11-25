import * as THREE from 'three';

export interface DroneAnimationState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  rotorSpeed: number; // RPM
  flightPhase: 'idle' | 'preflight' | 'takeoff' | 'climb' | 'cruise' | 'hover' | 'descent' | 'landing' | 'delivered' | 'return' | 'completed';
  status: 'normal' | 'warning' | 'critical' | 'delivery' | 'return';
  payloadAttached: boolean;
  obstacleScanning: boolean;
}

export class DroneModel3D {
  public group: THREE.Group;
  public propellers: THREE.Mesh[] = [];
  public payloadBox: THREE.Mesh | null = null;
  public payloadTether: THREE.Line | null = null;
  public navBeacons: THREE.PointLight[] = [];
  public scannerBeam: THREE.Mesh | null = null;
  public gimbalCamera: THREE.Group | null = null;
  public droneId: string;

  private beaconTime: number = 0;
  private currentPropAngle: number = 0;

  constructor(droneId: string = 'D-024', colorScheme: 'cyan' | 'amber' | 'emerald' | 'rose' = 'cyan') {
    this.droneId = droneId;
    this.group = new THREE.Group();
    this.group.name = `Drone_${droneId}`;

    this.buildDroneModel(colorScheme);
  }

  private buildDroneModel(colorScheme: string) {
    // Colors & Materials
    const carbonColor = 0x1e293b; // Slate 800
    const accentHex =
      colorScheme === 'amber' ? 0xf59e0b :
      colorScheme === 'emerald' ? 0x10b981 :
      colorScheme === 'rose' ? 0xf43f5e : 0x06b6d4; // Cyan 500

    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: carbonColor,
      roughness: 0.35,
      metalness: 0.7,
    });

    const darkTrimMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.8,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.3,
      metalness: 0.4,
      emissive: accentHex,
      emissiveIntensity: 0.25,
    });

    // 1. Central Aerodynamic Fuselage
    const bodyGeometry = new THREE.BoxGeometry(0.7, 0.16, 0.9);
    const bodyMesh = new THREE.Mesh(bodyGeometry, carbonMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.group.add(bodyMesh);

    // Top Aerodynamic Cockpit Canopy / Avionics Hatch
    const topCanopyGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.12, 8);
    const topCanopy = new THREE.Mesh(topCanopyGeo, darkTrimMaterial);
    topCanopy.position.y = 0.12;
    this.group.add(topCanopy);

    // GPS Mast / RTK Antenna Puck
    const rtkBaseGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.16);
    const rtkBase = new THREE.Mesh(rtkBaseGeo, darkTrimMaterial);
    rtkBase.position.set(-0.2, 0.18, -0.25);
    const rtkPuckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16);
    const rtkPuck = new THREE.Mesh(rtkPuckGeo, accentMaterial);
    rtkPuck.position.set(-0.2, 0.26, -0.25);
    this.group.add(rtkBase);
    this.group.add(rtkPuck);

    // Drone ID Marking Plaque
    const idDecalGeo = new THREE.PlaneGeometry(0.3, 0.1);
    const idDecalMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const idDecal = new THREE.Mesh(idDecalGeo, idDecalMat);
    idDecal.rotation.x = -Math.PI / 2;
    idDecal.position.set(0, 0.081, 0.1);
    this.group.add(idDecal);

    // 2. Structural Cross Arms (X-Frame configuration)
    const armPositions = [
      { x: 0.7, z: 0.7, angle: Math.PI / 4, isStarboard: true, isFront: true },
      { x: -0.7, z: 0.7, angle: -Math.PI / 4, isStarboard: false, isFront: true },
      { x: 0.7, z: -0.7, angle: (3 * Math.PI) / 4, isStarboard: true, isFront: false },
      { x: -0.7, z: -0.7, angle: -(3 * Math.PI) / 4, isStarboard: false, isFront: false },
    ];

    armPositions.forEach((arm, index) => {
      // Carbon tube arm
      const armLength = 0.95;
      const armTubeGeo = new THREE.CylinderGeometry(0.03, 0.035, armLength, 12);
      const armMesh = new THREE.Mesh(armTubeGeo, darkTrimMaterial);
      armMesh.position.set(arm.x * 0.45, 0.02, arm.z * 0.45);
      armMesh.rotation.y = arm.angle;
      armMesh.rotation.z = Math.PI / 2;
      armMesh.castShadow = true;
      this.group.add(armMesh);

      // Motor Nacelle Housing
      const motorGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 16);
      const motorMesh = new THREE.Mesh(motorGeo, carbonMaterial);
      motorMesh.position.set(arm.x, 0.08, arm.z);
      motorMesh.castShadow = true;
      this.group.add(motorMesh);

      // Motor Cap / Anodized Accent Ring
      const capGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.03, 16);
      const capMesh = new THREE.Mesh(capGeo, accentMaterial);
      capMesh.position.set(arm.x, 0.18, arm.z);
      this.group.add(capMesh);

      // 3. Propeller Blades (Dual carbon aerodynamic blades)
      const propGroup = new THREE.Group();
      propGroup.position.set(arm.x, 0.21, arm.z);

      const bladeGeo = new THREE.BoxGeometry(0.7, 0.008, 0.06);
      const propMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.2,
        metalness: 0.9,
      });
      const bladeMesh1 = new THREE.Mesh(bladeGeo, propMat);
      bladeMesh1.castShadow = true;
      propGroup.add(bladeMesh1);

      // Propeller Hub spinner
      const hubGeo = new THREE.ConeGeometry(0.035, 0.06, 12);
      const hubMesh = new THREE.Mesh(hubGeo, accentMaterial);
      hubMesh.position.y = 0.03;
      propGroup.add(hubMesh);

      this.group.add(propGroup);
      this.propellers.push(propGroup as any);

      // 4. Navigation LED Strobe Beacons
      const ledColor = arm.isFront
        ? arm.isStarboard
          ? 0x10b981 // Green (Starboard)
          : 0xef4444 // Red (Port)
        : 0xffffff; // White (Rear)

      const ledLensGeo = new THREE.SphereGeometry(0.03, 8, 8);
      const ledLensMat = new THREE.MeshBasicMaterial({ color: ledColor });
      const ledLens = new THREE.Mesh(ledLensGeo, ledLensMat);
      ledLens.position.set(arm.x, -0.02, arm.z);
      this.group.add(ledLens);

      const navLight = new THREE.PointLight(ledColor, 1.2, 3);
      navLight.position.set(arm.x, -0.02, arm.z);
      this.group.add(navLight);
      this.navBeacons.push(navLight);
    });

    // 5. Landing Skids (Twin heavy-duty carbon legs)
    const skidMaterial = darkTrimMaterial;
    [-0.32, 0.32].forEach((xOffset) => {
      // Horizontal runner
      const runnerGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8);
      const runner = new THREE.Mesh(runnerGeo, skidMaterial);
      runner.position.set(xOffset, -0.28, 0);
      runner.rotation.x = Math.PI / 2;
      runner.castShadow = true;
      this.group.add(runner);

      // Front & Rear Struts
      [-0.35, 0.35].forEach((zOffset) => {
        const strutGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8);
        const strut = new THREE.Mesh(strutGeo, skidMaterial);
        strut.position.set(xOffset, -0.14, zOffset);
        strut.rotation.z = xOffset > 0 ? -0.2 : 0.2;
        strut.castShadow = true;
        this.group.add(strut);
      });
    });

    // 6. Gimbal 4K FPV Camera with Gyro Mount
    const gimbalGroup = new THREE.Group();
    gimbalGroup.position.set(0, -0.06, 0.48);

    const gimbalMountGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const gimbalMount = new THREE.Mesh(gimbalMountGeo, darkTrimMaterial);
    gimbalGroup.add(gimbalMount);

    const cameraLensGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.08, 16);
    const cameraLensMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.95,
      roughness: 0.05,
    });
    const cameraLens = new THREE.Mesh(cameraLensGeo, cameraLensMat);
    cameraLens.rotation.x = Math.PI / 2;
    cameraLens.position.set(0, 0, 0.05);
    gimbalGroup.add(cameraLens);

    this.group.add(gimbalGroup);
    this.gimbalCamera = gimbalGroup;

    // 7. Forward LiDAR Scanner Ray Cone
    const scannerGeo = new THREE.ConeGeometry(0.8, 2.5, 16, 1, true);
    const scannerMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
    });
    const scanner = new THREE.Mesh(scannerGeo, scannerMat);
    scanner.position.set(0, 0, 1.4);
    scanner.rotation.x = -Math.PI / 2;
    this.group.add(scanner);
    this.scannerBeam = scanner;

    // 8. Cargo Payload Box
    const payloadGroup = new THREE.Group();
    payloadGroup.position.set(0, -0.18, 0);

    const boxGeo = new THREE.BoxGeometry(0.38, 0.22, 0.38);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.1,
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
    payloadGroup.add(boxMesh);

    // Red Cross / Medical Badge Decal on Cargo Box
    const badgeGeo = new THREE.BoxGeometry(0.18, 0.04, 0.01);
    const badgeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const crossH = new THREE.Mesh(badgeGeo, badgeMat);
    crossH.position.set(0, 0, 0.191);
    payloadGroup.add(crossH);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.01), badgeMat);
    crossV.position.set(0, 0, 0.191);
    payloadGroup.add(crossV);

    this.group.add(payloadGroup);
    this.payloadBox = payloadGroup as any;

    this.group.scale.set(1.4, 1.4, 1.4);
  }

  public update(delta: number, state: DroneAnimationState) {
    this.group.position.copy(state.position);
    this.group.rotation.copy(state.rotation);

    if (state.rotorSpeed > 0) {
      const speedRads = (state.rotorSpeed * Math.PI * 2 * delta) / 60;
      this.currentPropAngle += speedRads;

      this.propellers.forEach((prop, i) => {
        const direction = i % 2 === 0 ? 1 : -1;
        prop.rotation.y = this.currentPropAngle * direction;
      });
    }

    this.beaconTime += delta;
    const isStrobeOn = Math.sin(this.beaconTime * 8) > 0.4;
    this.navBeacons.forEach((light) => {
      light.intensity = isStrobeOn ? 2.0 : 0.4;
    });

    if (this.scannerBeam) {
      if (state.obstacleScanning) {
        const pulse = 0.25 + 0.2 * Math.sin(this.beaconTime * 12);
        (this.scannerBeam.material as THREE.MeshBasicMaterial).opacity = pulse;
        this.scannerBeam.rotation.z += delta * 2;
      } else {
        (this.scannerBeam.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    if (this.gimbalCamera) {
      if (state.flightPhase === 'landing' || state.flightPhase === 'hover' || state.flightPhase === 'delivered') {
        this.gimbalCamera.rotation.x = THREE.MathUtils.lerp(this.gimbalCamera.rotation.x, 0.6, delta * 4);
      } else if (state.flightPhase === 'cruise' || state.flightPhase === 'takeoff') {
        this.gimbalCamera.rotation.x = THREE.MathUtils.lerp(this.gimbalCamera.rotation.x, 0.1, delta * 4);
      }
    }

    if (this.payloadBox) {
      this.payloadBox.visible = state.payloadAttached;
    }
  }

  public setHighlightStatus(status: 'normal' | 'warning' | 'critical' | 'delivery' | 'return') {
    let colorHex = 0x06b6d4;
    if (status === 'warning') colorHex = 0xf59e0b;
    if (status === 'critical') colorHex = 0xef4444;
    if (status === 'delivery') colorHex = 0x10b981;
    if (status === 'return') colorHex = 0x3b82f6;

    if (this.navBeacons[0]) {
      this.navBeacons[0].color.setHex(colorHex);
    }
  }
}
