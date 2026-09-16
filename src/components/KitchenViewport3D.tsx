import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { KitchenConfig, CameraPresetId, Language } from '../types';
import { CABINET_FINISHES } from '../data/configOptions';
import { TRANSLATIONS } from '../i18n/translations';
import { 
  Maximize2, 
  RotateCcw, 
  Droplets, 
  Flame, 
  Fan, 
  Lightbulb, 
  Layers, 
  Eye,
  Camera
} from 'lucide-react';

interface KitchenViewport3DProps {
  config: KitchenConfig;
  lang: Language;
  onOpenQuotation?: () => void;
  onOpenBlueprint?: () => void;
}

export const KitchenViewport3D: React.FC<KitchenViewport3DProps> = ({
  config,
  lang,
  onOpenBlueprint,
}) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ja;
  const containerRef = useRef<HTMLDivElement>(null);

  // Interactive 3D toggles
  const [waterActive, setWaterActive] = useState<boolean>(true);
  const [burnerActive, setBurnerActive] = useState<boolean>(true);
  const [fanActive, setFanActive] = useState<boolean>(true);
  const [ledActive, setLedActive] = useState<boolean>(true);
  const [dishwasherOpen, setDishwasherOpen] = useState<boolean>(false);
  const [currentPreset, setCurrentPreset] = useState<CameraPresetId>('perspective');

  // Internal Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Dynamic mesh references for animations & updates
  const kitchenGroupRef = useRef<THREE.Group | null>(null);
  const waterStreamMeshRef = useRef<THREE.Mesh | null>(null);
  const burnerRingsRef = useRef<THREE.Mesh[]>([]);
  const burnerLightsRef = useRef<THREE.PointLight[]>([]);
  const fanBladesRef = useRef<THREE.Group | null>(null);
  const ledLightRef = useRef<THREE.RectAreaLight | THREE.PointLight | null>(null);
  const dishwasherDoorGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number>(0);
  const targetCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);

  // Materials cache
  const cabinetMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const countertopMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Camera presets coordinates
  const getPresetCoords = useCallback((preset: CameraPresetId, sinkLoc: 'left' | 'right') => {
    const sinkX = sinkLoc === 'left' ? -0.75 : 0.75;
    const cooktopX = sinkLoc === 'left' ? 0.75 : -0.75;

    switch (preset) {
      case 'perspective':
        return {
          pos: new THREE.Vector3(2.4, 1.9, 2.7),
          lookAt: new THREE.Vector3(0, 0.85, 0),
        };
      case 'front':
        return {
          pos: new THREE.Vector3(0, 1.15, 3.2),
          lookAt: new THREE.Vector3(0, 1.1, 0),
        };
      case 'top':
        return {
          pos: new THREE.Vector3(0, 4.2, 0.05),
          lookAt: new THREE.Vector3(0, 0.85, 0),
        };
      case 'sink':
        return {
          pos: new THREE.Vector3(sinkX * 0.9, 1.45, 1.15),
          lookAt: new THREE.Vector3(sinkX, 0.86, -0.05),
        };
      case 'cooktop':
        return {
          pos: new THREE.Vector3(cooktopX * 0.9, 1.45, 1.15),
          lookAt: new THREE.Vector3(cooktopX, 0.86, -0.05),
        };
      default:
        return {
          pos: new THREE.Vector3(2.4, 1.9, 2.7),
          lookAt: new THREE.Vector3(0, 0.85, 0),
        };
    }
  }, []);

  const handleApplyPreset = (preset: CameraPresetId) => {
    setCurrentPreset(preset);
    const target = getPresetCoords(preset, config.sinkLocation);
    targetCameraPosRef.current = target.pos;
    targetLookAtRef.current = target.lookAt;
  };

  // Helper to create rounded box / chamfered block
  const createBeveledBox = (w: number, h: number, d: number, mat: THREE.Material) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    return new THREE.Mesh(geom, mat);
  };

  // Build the complete procedural 3D model
  const rebuildKitchenScene = useCallback(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove existing kitchen group if any
    if (kitchenGroupRef.current) {
      scene.remove(kitchenGroupRef.current);
      kitchenGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      kitchenGroupRef.current = null;
    }

    burnerRingsRef.current = [];
    burnerLightsRef.current = [];
    fanBladesRef.current = null;
    waterStreamMeshRef.current = null;
    dishwasherDoorGroupRef.current = null;

    const kitchen = new THREE.Group();
    kitchenGroupRef.current = kitchen;

    // Determine cabinet finish material
    const currentFinish = CABINET_FINISHES.find((f) => f.id === config.cabinetFinish) || CABINET_FINISHES[0];
    const cabinetMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentFinish.colorHex),
      roughness: currentFinish.roughness,
      metalness: currentFinish.metalness,
    });
    cabinetMaterialRef.current = cabinetMat;

    // Countertop material (Quartz / Engineered Stone)
    const countertopMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xfcfcfc),
      roughness: 0.18,
      metalness: 0.05,
    });
    countertopMaterialRef.current = countertopMat;

    // Stainless steel & chrome materials
    const stainlessMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdde3ea),
      roughness: 0.22,
      metalness: 0.88,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1a1e24),
      roughness: 0.35,
      metalness: 0.7,
    });

    const ceramicGlassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0e1116),
      roughness: 0.08,
      metalness: 0.3,
    });

    // Handle Layout parameters
    const isPeninsula = config.layout === 'face-to-face' || config.layout === 'island';
    const isLType = config.layout === 'type-l';
    const isTypeII = config.layout === 'type-ii';
    
    // Depth: standard 0.65m, peninsula/island 0.933m
    const counterDepth = isPeninsula ? 0.933 : 0.65;
    const counterWidth = 2.55;
    const counterHeight = 0.85;
    const counterSlabThickness = 0.04;
    const baseCarcassHeight = counterHeight - counterSlabThickness - 0.07; // 0.74m
    const plinthHeight = 0.07;

    // Coordinates mirroring logic:
    // Left-handed: Sink X = -0.75, Cooktop X = +0.75
    // Right-handed: Sink X = +0.75, Cooktop X = -0.75
    const sinkX = config.sinkLocation === 'left' ? -0.75 : 0.75;
    const cooktopX = config.sinkLocation === 'left' ? 0.75 : -0.75;

    // Detail visibility rules
    const showFloorCabinet = config.detail !== 'type-i-wall-only';
    const showWallCabinet = config.detail === 'type-i-standard' || config.detail === 'type-i-side-hood' || config.detail === 'type-i-wall-only';
    const showRangeHood = config.detail !== 'type-i-floor-only' && config.detail !== 'type-i-wall-only';
    const hoodCenter = config.detail === 'type-i-center-hood';

    // ----------------------------------------------------
    // 1. FLOOR BASE CABINET & WORKTOP
    // ----------------------------------------------------
    if (showFloorCabinet) {
      const floorUnitGroup = new THREE.Group();

      // Plinth (Kick plate)
      const plinthGeom = new THREE.BoxGeometry(counterWidth - 0.04, plinthHeight, counterDepth - 0.06);
      const plinthMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.8 });
      const plinth = new THREE.Mesh(plinthGeom, plinthMat);
      plinth.position.set(0, plinthHeight / 2, -0.02);
      plinth.receiveShadow = true;
      floorUnitGroup.add(plinth);

      // Base Cabinet Carcass
      const carcassGeom = new THREE.BoxGeometry(counterWidth - 0.02, baseCarcassHeight, counterDepth - 0.04);
      const carcassMat = new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.6 });
      const carcass = new THREE.Mesh(carcassGeom, carcassMat);
      carcass.position.set(0, plinthHeight + baseCarcassHeight / 2, -0.01);
      carcass.castShadow = true;
      carcass.receiveShadow = true;
      floorUnitGroup.add(carcass);

      // Modular Cabinet Front Doors / Drawers
      // 3 Sections: Left (0.8m), Center (0.95m), Right (0.8m)
      const secWidths = [0.8, 0.95, 0.8];
      const secXCenters = [-0.875, 0, 0.875];

      secWidths.forEach((w, idx) => {
        const xPos = secXCenters[idx];
        const isCenter = idx === 1;

        // Dishwasher toggle in center unit if floorUnit is 'front-dishwasher'
        if (isCenter && config.floorUnit === 'front-dishwasher') {
          // Dishwasher front panel with handle & LED bar
          const dwGroup = new THREE.Group();
          dwGroup.position.set(xPos, plinthHeight, counterDepth / 2 - 0.015);

          // Door pivot at bottom for front-opening
          const doorPivot = new THREE.Group();
          doorPivot.position.set(0, 0, 0);

          const dwDoorGeom = new THREE.BoxGeometry(w - 0.015, baseCarcassHeight - 0.01, 0.02);
          const dwDoor = new THREE.Mesh(dwDoorGeom, cabinetMat);
          dwDoor.position.set(0, baseCarcassHeight / 2, 0.01);
          dwDoor.castShadow = true;
          doorPivot.add(dwDoor);

          // Top stainless control trim with LED status bar
          const trimGeom = new THREE.BoxGeometry(w - 0.02, 0.09, 0.024);
          const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.3, metalness: 0.8 });
          const trim = new THREE.Mesh(trimGeom, trimMat);
          trim.position.set(0, baseCarcassHeight - 0.045, 0.012);
          doorPivot.add(trim);

          // Panasonic Blue LED indicator strip
          const ledStripGeom = new THREE.BoxGeometry(0.18, 0.008, 0.026);
          const ledStripMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
          const ledStrip = new THREE.Mesh(ledStripGeom, ledStripMat);
          ledStrip.position.set(0, baseCarcassHeight - 0.035, 0.013);
          doorPivot.add(ledStrip);

          // Recessed grip handle
          const dwHandleGeom = new THREE.BoxGeometry(0.45, 0.025, 0.03);
          const dwHandle = new THREE.Mesh(dwHandleGeom, stainlessMat);
          dwHandle.position.set(0, baseCarcassHeight - 0.07, 0.02);
          doorPivot.add(dwHandle);

          // Interior rack simulation (visible when opened)
          const rackGeom = new THREE.BoxGeometry(w - 0.08, 0.04, 0.45);
          const rackMat = new THREE.MeshStandardMaterial({ color: 0x8892b0, wireframe: true });
          const rack = new THREE.Mesh(rackGeom, rackMat);
          rack.position.set(0, baseCarcassHeight * 0.5, -0.22);
          doorPivot.add(rack);

          dwGroup.add(doorPivot);
          floorUnitGroup.add(dwGroup);
          dishwasherDoorGroupRef.current = doorPivot;
        } else {
          // Standard High Storage drawers (3 stacked drawers per section)
          const drawerCount = 3;
          const drawerGap = 0.006;
          const drawerHeight = (baseCarcassHeight - drawerGap * (drawerCount + 1)) / drawerCount;

          for (let d = 0; d < drawerCount; d++) {
            const drawerY = plinthHeight + drawerGap + d * (drawerHeight + drawerGap) + drawerHeight / 2;
            const drawerGeom = new THREE.BoxGeometry(w - 0.015, drawerHeight, 0.02);
            const drawer = new THREE.Mesh(drawerGeom, cabinetMat);
            drawer.position.set(xPos, drawerY, counterDepth / 2 - 0.005);
            drawer.castShadow = true;
            floorUnitGroup.add(drawer);

            // Sleek horizontal aluminum J-pull / handle bar
            const handleGeom = new THREE.BoxGeometry(w * 0.7, 0.016, 0.018);
            const handle = new THREE.Mesh(handleGeom, stainlessMat);
            handle.position.set(xPos, drawerY + drawerHeight / 2 - 0.025, counterDepth / 2 + 0.008);
            handle.castShadow = true;
            floorUnitGroup.add(handle);
          }
        }
      });

      // Peninsula rear finish panel (if Peninsula or Island)
      if (isPeninsula) {
        const backPanelGeom = new THREE.BoxGeometry(counterWidth - 0.02, baseCarcassHeight, 0.02);
        const backPanel = new THREE.Mesh(backPanelGeom, cabinetMat);
        backPanel.position.set(0, plinthHeight + baseCarcassHeight / 2, -counterDepth / 2 + 0.01);
        backPanel.castShadow = true;
        floorUnitGroup.add(backPanel);
      }

      // Worktop / Countertop Slab
      const worktopGeom = new THREE.BoxGeometry(counterWidth, counterSlabThickness, counterDepth);
      const worktop = new THREE.Mesh(worktopGeom, countertopMat);
      worktop.position.set(0, counterHeight - counterSlabThickness / 2, 0);
      worktop.castShadow = true;
      worktop.receiveShadow = true;
      floorUnitGroup.add(worktop);

      // Worktop front edge chamfer detail
      const edgeGeom = new THREE.CylinderGeometry(0.008, 0.008, counterWidth, 16);
      const edgeMesh = new THREE.Mesh(edgeGeom, countertopMat);
      edgeMesh.rotation.z = Math.PI / 2;
      edgeMesh.position.set(0, counterHeight - 0.008, counterDepth / 2);
      floorUnitGroup.add(edgeMesh);

      // ----------------------------------------------------
      // L-Type Return Extension (if Type L)
      // ----------------------------------------------------
      if (isLType) {
        const returnLen = 1.15;
        const returnWidth = 0.65;
        const returnX = -counterWidth / 2 + returnWidth / 2;
        const returnZ = counterDepth / 2 + returnLen / 2;

        const lReturnCarcass = new THREE.Mesh(
          new THREE.BoxGeometry(returnWidth, baseCarcassHeight, returnLen),
          carcassMat
        );
        lReturnCarcass.position.set(returnX, plinthHeight + baseCarcassHeight / 2, returnZ);
        floorUnitGroup.add(lReturnCarcass);

        const lReturnTop = new THREE.Mesh(
          new THREE.BoxGeometry(returnWidth, counterSlabThickness, returnLen),
          countertopMat
        );
        lReturnTop.position.set(returnX, counterHeight - counterSlabThickness / 2, returnZ);
        floorUnitGroup.add(lReturnTop);
      }

      // ----------------------------------------------------
      // Type II Parallel Back Counter (if Type II)
      // ----------------------------------------------------
      if (isTypeII) {
        const pLen = 1.8;
        const pDepth = 0.65;
        const pZ = -1.35; // Behind the main unit

        const pCarcass = new THREE.Mesh(
          new THREE.BoxGeometry(pLen, baseCarcassHeight, pDepth),
          carcassMat
        );
        pCarcass.position.set(0, plinthHeight + baseCarcassHeight / 2, pZ);
        floorUnitGroup.add(pCarcass);

        const pTop = new THREE.Mesh(
          new THREE.BoxGeometry(pLen, counterSlabThickness, pDepth),
          countertopMat
        );
        pTop.position.set(0, counterHeight - counterSlabThickness / 2, pZ);
        floorUnitGroup.add(pTop);
      }

      // ----------------------------------------------------
      // 2. SUG-PIKA SINK & SLIM TOUCHLESS SENSOR FAUCET
      // ----------------------------------------------------
      const sinkGroup = new THREE.Group();
      sinkGroup.position.set(sinkX, counterHeight - counterSlabThickness / 2, 0.02);

      // Sink Basin Rim (Organic Glass or Stainless)
      const sinkMat = config.upgrades.sugoPikaSink
        ? new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.12,
            metalness: 0.02,
          }) // Sugo-Pika Organic Glass (smooth, repels water)
        : stainlessMat; // Standard stainless sink

      const sinkRimGeom = new THREE.BoxGeometry(0.76, 0.01, 0.52);
      const sinkRim = new THREE.Mesh(sinkRimGeom, sinkMat);
      sinkRim.position.set(0, counterSlabThickness / 2 + 0.003, 0);
      sinkGroup.add(sinkRim);

      // Recessed Inner Basin
      const basinInnerGeom = new THREE.BoxGeometry(0.68, 0.18, 0.44);
      const basinInner = new THREE.Mesh(basinInnerGeom, sinkMat);
      basinInner.position.set(0, -0.09, 0);
      sinkGroup.add(basinInner);

      // Drain strainer disk
      const drainGeom = new THREE.CylinderGeometry(0.065, 0.065, 0.005, 32);
      const drainMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.2 });
      const drain = new THREE.Mesh(drainGeom, drainMat);
      drain.position.set(0.18, -0.175, 0);
      sinkGroup.add(drain);

      // Panasonic Slim Touchless Sensor Faucet
      const faucetGroup = new THREE.Group();
      faucetGroup.position.set(0.05, counterSlabThickness / 2 + 0.005, -0.19);

      // Faucet Base Mount
      const faucetBaseGeom = new THREE.CylinderGeometry(0.024, 0.028, 0.08, 24);
      const faucetBase = new THREE.Mesh(faucetBaseGeom, stainlessMat);
      faucetBase.position.set(0, 0.04, 0);
      faucetGroup.add(faucetBase);

      // Gooseneck Arch Spout
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.08, 0),
        new THREE.Vector3(0, 0.32, 0),
        new THREE.Vector3(0, 0.39, 0.06),
        new THREE.Vector3(0, 0.38, 0.16),
        new THREE.Vector3(0, 0.31, 0.19),
      ]);
      const spoutGeom = new THREE.TubeGeometry(curve, 32, 0.013, 16, false);
      const spoutMesh = new THREE.Mesh(spoutGeom, stainlessMat);
      faucetGroup.add(spoutMesh);

      // Touchless Optical Sensor Indicator (Cyan LED dot if upgrade active)
      if (config.upgrades.slimSensorFaucet) {
        const sensorRingGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16);
        const sensorMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
        const sensorRing = new THREE.Mesh(sensorRingGeom, sensorMat);
        sensorRing.rotation.x = Math.PI / 2;
        sensorRing.position.set(0, 0.32, 0.19);
        faucetGroup.add(sensorRing);
      }

      // Animated Water Stream
      const waterStreamCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.31, 0.19),
        new THREE.Vector3(0, 0.18, 0.19),
        new THREE.Vector3(0, 0.0, 0.19),
        new THREE.Vector3(0, -0.16, 0.19),
      ]);
      const waterGeom = new THREE.TubeGeometry(waterStreamCurve, 20, 0.007, 12, false);
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transmission: 0.9,
        opacity: 0.85,
        transparent: true,
        roughness: 0.05,
        ior: 1.33,
      });
      const waterStreamMesh = new THREE.Mesh(waterGeom, waterMat);
      waterStreamMesh.visible = waterActive;
      faucetGroup.add(waterStreamMesh);
      waterStreamMeshRef.current = waterStreamMesh;

      sinkGroup.add(faucetGroup);
      floorUnitGroup.add(sinkGroup);

      // ----------------------------------------------------
      // 3. TRIPLE WIDE IH COOKTOP (Panasonic Signature)
      // ----------------------------------------------------
      const cooktopGroup = new THREE.Group();
      cooktopGroup.position.set(cooktopX, counterHeight - counterSlabThickness / 2 + 0.002, 0.02);

      // Ceramic Glass Cooktop Plate (W900 x D350 for Triple Wide, or W600 for standard)
      const cooktopWidth = config.upgrades.tripleWideIH ? 0.92 : 0.62;
      const cooktopDepth = config.upgrades.tripleWideIH ? 0.38 : 0.48;
      const glassPlateGeom = new THREE.BoxGeometry(cooktopWidth, 0.008, cooktopDepth);
      const glassPlate = new THREE.Mesh(glassPlateGeom, ceramicGlassMat);
      glassPlate.position.set(0, counterSlabThickness / 2 + 0.004, 0);
      cooktopGroup.add(glassPlate);

      // Beveled Stainless Frame Border
      const frameGeom = new THREE.BoxGeometry(cooktopWidth + 0.015, 0.007, cooktopDepth + 0.015);
      const frame = new THREE.Mesh(frameGeom, stainlessMat);
      frame.position.set(0, counterSlabThickness / 2 + 0.002, 0);
      cooktopGroup.add(frame);

      // Induction Burner Heating Zones (3 in horizontal line for Triple Wide!)
      const burnerPositions = config.upgrades.tripleWideIH
        ? [-0.28, 0, 0.28] // 3 horizontal burners
        : [-0.14, 0.14]; // 2 burners standard

      burnerPositions.forEach((bX, bIdx) => {
        // Subtle ceramic markings
        const ringGeom = new THREE.RingGeometry(0.07, 0.09, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: bIdx === 0 ? 0xff3b30 : 0x00f2fe, // Panasonic dual glow: red/cyan
          side: THREE.DoubleSide,
          transparent: true,
          opacity: burnerActive ? 0.95 : 0.2,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(bX, counterSlabThickness / 2 + 0.009, 0);
        cooktopGroup.add(ringMesh);
        burnerRingsRef.current.push(ringMesh);

        // Inner glowing coil circle
        const innerRingGeom = new THREE.RingGeometry(0.02, 0.045, 32);
        const innerRingMat = new THREE.MeshBasicMaterial({
          color: bIdx === 0 ? 0xff7b00 : 0x00c4cc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: burnerActive ? 0.8 : 0.15,
        });
        const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.set(bX, counterSlabThickness / 2 + 0.009, 0);
        cooktopGroup.add(innerRing);
        burnerRingsRef.current.push(innerRing);

        // Point light for cooking glow
        const bLight = new THREE.PointLight(
          bIdx === 0 ? 0xff4500 : 0x00e5ff,
          burnerActive ? 0.8 : 0,
          0.6
        );
        bLight.position.set(cooktopX + bX, counterHeight + 0.05, 0.02);
        floorUnitGroup.add(bLight);
        burnerLightsRef.current.push(bLight);
      });

      // Front capacitive touch control buttons
      const touchBarGeom = new THREE.BoxGeometry(cooktopWidth * 0.7, 0.002, 0.04);
      const touchBarMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
      const touchBar = new THREE.Mesh(touchBarGeom, touchBarMat);
      touchBar.position.set(0, counterSlabThickness / 2 + 0.009, cooktopDepth / 2 - 0.03);
      cooktopGroup.add(touchBar);

      floorUnitGroup.add(cooktopGroup);
      kitchen.add(floorUnitGroup);
    }

    // ----------------------------------------------------
    // 4. UPPER WALL CABINET (吊戸棚)
    // ----------------------------------------------------
    if (showWallCabinet) {
      const wallCabinetGroup = new THREE.Group();
      const wallCabY = 1.95; // Eye height
      const wallCabHeight = 0.65;
      const wallCabDepth = 0.38;

      // Upper carcass
      const wallCarcassGeom = new THREE.BoxGeometry(counterWidth - 0.02, wallCabHeight, wallCabDepth - 0.02);
      const wallCarcass = new THREE.Mesh(wallCarcassGeom, cabinetMat);
      wallCarcass.position.set(0, wallCabY, -counterDepth / 2 + wallCabDepth / 2);
      wallCarcass.castShadow = true;
      wallCabinetGroup.add(wallCarcass);

      // Upper Cabinet Doors (4 doors across 2550mm)
      const upperDoorCount = 4;
      const uDoorWidth = (counterWidth - 0.04) / upperDoorCount;
      for (let u = 0; u < upperDoorCount; u++) {
        const uDoorX = -counterWidth / 2 + 0.02 + u * uDoorWidth + uDoorWidth / 2;
        const uDoorGeom = new THREE.BoxGeometry(uDoorWidth - 0.01, wallCabHeight - 0.02, 0.02);
        const uDoor = new THREE.Mesh(uDoorGeom, cabinetMat);
        uDoor.position.set(uDoorX, wallCabY, -counterDepth / 2 + wallCabDepth);
        uDoor.castShadow = true;
        wallCabinetGroup.add(uDoor);

        // Bottom push-latch or bottom strip handle
        const uHandleGeom = new THREE.BoxGeometry(uDoorWidth * 0.7, 0.01, 0.015);
        const uHandle = new THREE.Mesh(uHandleGeom, stainlessMat);
        uHandle.position.set(uDoorX, wallCabY - wallCabHeight / 2 + 0.03, -counterDepth / 2 + wallCabDepth + 0.01);
        wallCabinetGroup.add(uHandle);
      }

      // Under-Cabinet Warm LED Light Strip
      const ledBarGeom = new THREE.BoxGeometry(counterWidth * 0.85, 0.012, 0.02);
      const ledBarMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0 });
      const ledBar = new THREE.Mesh(ledBarGeom, ledBarMat);
      ledBar.position.set(0, wallCabY - wallCabHeight / 2 - 0.01, -counterDepth / 2 + wallCabDepth * 0.75);
      wallCabinetGroup.add(ledBar);

      // Downward illuminating point light
      const underCabLight = new THREE.PointLight(0xffeedd, ledActive ? 1.4 : 0, 2.2);
      underCabLight.position.set(0, wallCabY - wallCabHeight / 2 - 0.05, 0);
      wallCabinetGroup.add(underCabLight);
      ledLightRef.current = underCabLight;

      kitchen.add(wallCabinetGroup);
    }

    // ----------------------------------------------------
    // 5. AUTO CLEAN RANGE HOOD (ほっとくくるりんフード)
    // ----------------------------------------------------
    if (showRangeHood) {
      const hoodGroup = new THREE.Group();
      const hoodX = hoodCenter ? 0 : cooktopX; // Position above cooktop or centered
      const hoodY = 1.90;
      const hoodWidth = 0.90;
      const hoodDepth = 0.60;

      // Hood Main Slanted Canopy
      const hoodMat = config.upgrades.autoCleanHood ? darkMetalMat : stainlessMat;

      // Chimney Duct to Ceiling
      const chimneyGeom = new THREE.BoxGeometry(0.34, 0.70, 0.32);
      const chimney = new THREE.Mesh(chimneyGeom, hoodMat);
      chimney.position.set(hoodX, hoodY + 0.45, -counterDepth / 2 + 0.22);
      chimney.castShadow = true;
      hoodGroup.add(chimney);

      // Slim Bottom Intake Hood Panel
      const intakeGeom = new THREE.BoxGeometry(hoodWidth, 0.06, hoodDepth);
      const intake = new THREE.Mesh(intakeGeom, hoodMat);
      intake.position.set(hoodX, hoodY, -counterDepth / 2 + hoodDepth / 2);
      intake.castShadow = true;
      hoodGroup.add(intake);

      // Panasonic Hotto Kukururin Filter Plate (Grease separator baffle)
      const baffleGeom = new THREE.BoxGeometry(hoodWidth * 0.78, 0.01, hoodDepth * 0.65);
      const baffleMat = new THREE.MeshStandardMaterial({
        color: 0x22272e,
        metalness: 0.8,
        roughness: 0.3,
      });
      const baffle = new THREE.Mesh(baffleGeom, baffleMat);
      baffle.position.set(hoodX, hoodY - 0.02, -counterDepth / 2 + hoodDepth / 2);
      hoodGroup.add(baffle);

      // Rotating Centrifugal Fan Blades (Visible Turbine inside cavity)
      const fanGroup = new THREE.Group();
      fanGroup.position.set(hoodX, hoodY + 0.12, -counterDepth / 2 + hoodDepth / 2);

      const fanHubGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16);
      const fanHubMat = new THREE.MeshStandardMaterial({ color: 0x00a86b, metalness: 0.5 }); // Panasonic emerald accent
      const fanHub = new THREE.Mesh(fanHubGeom, fanHubMat);
      fanGroup.add(fanHub);

      // Fan turbine blades
      const bladeCount = 6;
      for (let b = 0; b < bladeCount; b++) {
        const bladeAngle = (b / bladeCount) * Math.PI * 2;
        const bladeGeom = new THREE.BoxGeometry(0.08, 0.03, 0.006);
        const blade = new THREE.Mesh(bladeGeom, stainlessMat);
        blade.position.set(Math.cos(bladeAngle) * 0.08, 0, Math.sin(bladeAngle) * 0.08);
        blade.rotation.y = bladeAngle + 0.4;
        fanGroup.add(blade);
      }
      hoodGroup.add(fanGroup);
      fanBladesRef.current = fanGroup;

      // Hood Spotlights illuminating the cooktop
      const hoodSpot = new THREE.SpotLight(0xffffff, 1.2, 2.5, Math.PI / 4, 0.3);
      hoodSpot.position.set(hoodX, hoodY - 0.02, -counterDepth / 2 + hoodDepth / 2);
      hoodSpot.target.position.set(hoodX, counterHeight, 0.02);
      hoodGroup.add(hoodSpot);
      hoodGroup.add(hoodSpot.target);

      kitchen.add(hoodGroup);
    }

    scene.add(kitchen);
  }, [config, waterActive, burnerActive, fanActive, ledActive]);

  // Three.js Scene Setup & Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.09);

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(2.4, 1.9, 2.7);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
    controls.minDistance = 0.8;
    controls.maxDistance = 6.5;
    controls.target.set(0, 0.85, 0);
    controlsRef.current = controls;

    // Showroom Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    mainKeyLight.position.set(3.5, 4.5, 3.2);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 2048;
    mainKeyLight.shadow.mapSize.height = 2048;
    mainKeyLight.shadow.bias = -0.0001;
    scene.add(mainKeyLight);

    const fillLight = new THREE.DirectionalLight(0x90b8f8, 0.45);
    fillLight.position.set(-3.5, 3.0, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x00a86b, 0.35); // Panasonic emerald brand rim
    rimLight.position.set(0, 3.5, -3.5);
    scene.add(rimLight);

    // Architectural Showroom Floor & Accent Wall
    const floorGeom = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.4,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Grid Tile Lines (Fine luxury architectural grid)
    const grid = new THREE.GridHelper(12, 24, 0x00a86b, 0x1e293b);
    grid.position.y = 0.001;
    scene.add(grid);

    // Back accent wall
    const wallGeom = new THREE.PlaneGeometry(14, 6);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f1420,
      roughness: 0.85,
    });
    const backWall = new THREE.Mesh(wallGeom, wallMat);
    backWall.position.set(0, 3, -0.65 / 2 - 0.05);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Initial build
    rebuildKitchenScene();

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Animate fan rotation if active
      if (fanBladesRef.current && fanActive) {
        fanBladesRef.current.rotation.y += delta * 12;
      }

      // Animate water flow wobble if active
      if (waterStreamMeshRef.current && waterActive) {
        waterStreamMeshRef.current.rotation.y = Math.sin(elapsedTime * 6) * 0.08;
      }

      // Animate burner ring pulsing
      if (burnerActive && burnerRingsRef.current.length > 0) {
        const pulse = 0.85 + Math.sin(elapsedTime * 4) * 0.15;
        burnerRingsRef.current.forEach((ring) => {
          if (ring.material instanceof THREE.Material) {
            ring.material.opacity = pulse;
          }
        });
      }

      // Smooth camera position interpolation
      if (targetCameraPosRef.current && targetLookAtRef.current && cameraRef.current && controlsRef.current) {
        cameraRef.current.position.lerp(targetCameraPosRef.current, 0.06);
        controlsRef.current.target.lerp(targetLookAtRef.current, 0.06);
        if (cameraRef.current.position.distanceTo(targetCameraPosRef.current) < 0.01) {
          targetCameraPosRef.current = null;
          targetLookAtRef.current = null;
        }
      }

      // Dishwasher door angle animation (Smooth hinge lerp)
      if (dishwasherDoorGroupRef.current) {
        const targetRot = dishwasherOpen ? Math.PI / 2.2 : 0;
        dishwasherDoorGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          dishwasherDoorGroupRef.current.rotation.x,
          targetRot,
          0.08
        );
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = newW / newH;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
    };
  }, []); // Mount only once, dynamic updates handled via callbacks

  // Re-run kitchen reconstruction on configuration change
  useEffect(() => {
    rebuildKitchenScene();
  }, [rebuildKitchenScene]);

  // Sync Water flow state
  useEffect(() => {
    if (waterStreamMeshRef.current) {
      waterStreamMeshRef.current.visible = waterActive;
    }
  }, [waterActive]);

  // Sync Burner state
  useEffect(() => {
    burnerRingsRef.current.forEach((r) => {
      if (r.material instanceof THREE.Material) {
        r.material.opacity = burnerActive ? 0.9 : 0.15;
      }
    });
    burnerLightsRef.current.forEach((l) => {
      l.intensity = burnerActive ? 0.8 : 0;
    });
  }, [burnerActive]);

  // Sync LED light strip
  useEffect(() => {
    if (ledLightRef.current) {
      ledLightRef.current.intensity = ledActive ? 1.4 : 0;
    }
  }, [ledActive]);

  return (
    <div className="relative w-full h-full min-h-[420px] lg:min-h-[520px] flex flex-col rounded-2xl overflow-hidden glass-panel border border-slate-700/60 shadow-2xl">
      {/* 3D WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        id="three-canvas-viewport" 
        className="w-full h-full flex-1 relative cursor-grab active:cursor-grabbing select-none"
      />

      {/* Top Floating Overlay Controls: Dimension badge & Viewport Tools */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none gap-2 z-10">
        {/* Dimensions & Active Layout Spec Pill */}
        <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-xs shadow-lg text-slate-200">
          <span className="w-2 h-2 rounded-full bg-[#00a86b] animate-pulse"></span>
          <span className="font-semibold text-emerald-400">2550mm × 650mm × 850mm</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">
            {config.sinkLocation === 'left' ? 'Sink Left (L)' : 'Sink Right (R)'}
          </span>
        </div>

        {/* Top-Right Quick View Presets & 2D Blueprint Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
          {onOpenBlueprint && (
            <button
              id="open-blueprint-btn"
              onClick={onOpenBlueprint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/80 hover:bg-[#00a86b]/20 hover:border-[#00a86b]/40 rounded-lg border border-transparent transition-all"
              title={t.view_blueprint}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{t.view_blueprint}</span>
            </button>
          )}

          <button
            id="reset-cam-btn"
            onClick={() => handleApplyPreset('perspective')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={t.reset_camera}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Interactive Simulation Dashboard: Water, Burner, Fan, Dishwasher Toggles */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Camera Angle Presets Toolbar */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-xl overflow-x-auto">
          <div className="px-2 py-1 text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Camera className="w-3 h-3 text-slate-500" />
            <span className="hidden md:inline">{t.camera_presets}</span>
          </div>

          <button
            id="cam-preset-perspective"
            onClick={() => handleApplyPreset('perspective')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              currentPreset === 'perspective'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_perspective}
          </button>

          <button
            id="cam-preset-front"
            onClick={() => handleApplyPreset('front')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              currentPreset === 'front'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_front}
          </button>

          <button
            id="cam-preset-top"
            onClick={() => handleApplyPreset('top')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              currentPreset === 'top'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_top}
          </button>

          <button
            id="cam-preset-sink"
            onClick={() => handleApplyPreset('sink')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              currentPreset === 'sink'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_sink}
          </button>

          <button
            id="cam-preset-cooktop"
            onClick={() => handleApplyPreset('cooktop')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              currentPreset === 'cooktop'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_cooktop}
          </button>
        </div>

        {/* 3D Functional Simulation Toggles */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-xl">
          {/* Water Stream Toggle */}
          <button
            id="toggle-water-btn"
            onClick={() => setWaterActive(!waterActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              waterActive
                ? 'bg-blue-600/80 text-blue-100 border border-blue-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_water}
          >
            <Droplets className={`w-3.5 h-3.5 ${waterActive ? 'text-cyan-300 animate-bounce' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{t.ctrl_water}</span>
          </button>

          {/* IH Burner Glow Toggle */}
          <button
            id="toggle-burner-btn"
            onClick={() => setBurnerActive(!burnerActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              burnerActive
                ? 'bg-red-600/80 text-red-100 border border-red-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_burner}
          >
            <Flame className={`w-3.5 h-3.5 ${burnerActive ? 'text-amber-300' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{t.ctrl_burner}</span>
          </button>

          {/* Hood Fan Rotation Toggle */}
          <button
            id="toggle-fan-btn"
            onClick={() => setFanActive(!fanActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              fanActive
                ? 'bg-emerald-600/80 text-emerald-100 border border-emerald-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_fan}
          >
            <Fan className={`w-3.5 h-3.5 ${fanActive ? 'text-emerald-300 animate-spin' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{t.ctrl_fan}</span>
          </button>

          {/* Cabinet LED Light Toggle */}
          <button
            id="toggle-led-btn"
            onClick={() => setLedActive(!ledActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              ledActive
                ? 'bg-amber-600/80 text-amber-100 border border-amber-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_led}
          >
            <Lightbulb className={`w-3.5 h-3.5 ${ledActive ? 'text-amber-300' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{t.ctrl_led}</span>
          </button>

          {/* Dishwasher Open/Close if dishwasher selected */}
          {config.floorUnit === 'front-dishwasher' && (
            <button
              id="toggle-dishwasher-btn"
              onClick={() => setDishwasherOpen(!dishwasherOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                dishwasherOpen
                  ? 'bg-purple-600/80 text-purple-100 border border-purple-400/40 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title={t.ctrl_dishwasher}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{dishwasherOpen ? t.ctrl_door_close : t.ctrl_door_open}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
