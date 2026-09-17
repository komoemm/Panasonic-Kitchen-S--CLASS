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
  activeFocus?: 'sink' | 'cooktop' | 'hood' | 'perspective' | CameraPresetId;
  onOpenQuotation?: () => void;
  onOpenBlueprint?: () => void;
}

export const KitchenViewport3D: React.FC<KitchenViewport3DProps> = ({
  config,
  lang,
  activeFocus,
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
  const waterRippleDiscRef = useRef<THREE.Mesh | null>(null);
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

  // Performance and RAF Throttling Refs
  const lastInteractionTimeRef = useRef<number>(performance.now());
  const lastRenderTimeRef = useRef<number>(0);
  const needsRenderRef = useRef<boolean>(true);
  const fanActiveRef = useRef<boolean>(fanActive);
  const waterActiveRef = useRef<boolean>(waterActive);
  const burnerActiveRef = useRef<boolean>(burnerActive);
  const ledActiveRef = useRef<boolean>(ledActive);
  const dishwasherOpenRef = useRef<boolean>(dishwasherOpen);

  // Helper to trigger active render state
  const markInteraction = useCallback(() => {
    lastInteractionTimeRef.current = performance.now();
    needsRenderRef.current = true;
  }, []);

  // Sync state to refs for animation loop
  useEffect(() => {
    fanActiveRef.current = fanActive;
    markInteraction();
  }, [fanActive, markInteraction]);

  useEffect(() => {
    waterActiveRef.current = waterActive;
    markInteraction();
  }, [waterActive, markInteraction]);

  useEffect(() => {
    burnerActiveRef.current = burnerActive;
    markInteraction();
  }, [burnerActive, markInteraction]);

  useEffect(() => {
    ledActiveRef.current = ledActive;
    markInteraction();
  }, [ledActive, markInteraction]);

  useEffect(() => {
    dishwasherOpenRef.current = dishwasherOpen;
    markInteraction();
  }, [dishwasherOpen, markInteraction]);

  // Deep resource disposal helpers to eliminate WebGL memory leaks
  const disposeMaterial = useCallback((material: THREE.Material) => {
    const mat = material as any;
    for (const key of Object.keys(mat)) {
      const val = mat[key];
      if (val && typeof val === 'object' && val.isTexture && typeof val.dispose === 'function') {
        val.dispose();
      }
    }
    material.dispose();
  }, []);

  const disposeHierarchy = useCallback((root: THREE.Object3D) => {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.Line).isLine || (child as THREE.Points).isPoints) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => disposeMaterial(m));
          } else {
            disposeMaterial(mesh.material);
          }
        }
      }
      const anyChild = child as any;
      if (anyChild.shadow && anyChild.shadow.map && typeof anyChild.shadow.map.dispose === 'function') {
        anyChild.shadow.map.dispose();
      }
    });
  }, [disposeMaterial]);

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
        // Angled isometric close-up looking down at ~42 degrees directly into the sink basin
        const xOffset = sinkLoc === 'left' ? 0.16 : -0.16;
        return {
          pos: new THREE.Vector3(sinkX + xOffset, 1.28, 0.62),
          lookAt: new THREE.Vector3(sinkX + (sinkLoc === 'left' ? 0.05 : -0.05), 0.72, 0.01),
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

  const handleApplyPreset = useCallback((preset: CameraPresetId) => {
    setCurrentPreset(preset);
    const target = getPresetCoords(preset, config.sinkLocation);
    targetCameraPosRef.current = target.pos;
    targetLookAtRef.current = target.lookAt;
    markInteraction();
  }, [config.sinkLocation, getPresetCoords, markInteraction]);

  // Sync activeFocus prop to preset camera changes
  useEffect(() => {
    if (activeFocus) {
      if (
        activeFocus === 'sink' ||
        activeFocus === 'cooktop' ||
        activeFocus === 'perspective' ||
        activeFocus === 'front' ||
        activeFocus === 'top'
      ) {
        handleApplyPreset(activeFocus as CameraPresetId);
      }
    }
  }, [activeFocus, handleApplyPreset]);

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
      disposeHierarchy(kitchenGroupRef.current);
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

    // Countertop material (Polished Quartz / Engineered Stone)
    const countertopMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xfcfcfc),
      roughness: 0.16,
      metalness: 0.04,
      envMapIntensity: 0.95,
    });
    countertopMaterialRef.current = countertopMat;

    // Stainless steel & architectural metal materials
    const stainlessMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdde3ea),
      roughness: 0.18,
      metalness: 0.92,
      envMapIntensity: 1.2,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1a1e24),
      roughness: 0.32,
      metalness: 0.72,
      envMapIntensity: 0.85,
    });

    const ceramicGlassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0a0d12),
      roughness: 0.05,
      metalness: 0.35,
      envMapIntensity: 1.15,
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

      // Soft contact shadow beneath the cabinet base for realistic ground spatial depth
      const baseShadowCanvas = document.createElement('canvas');
      baseShadowCanvas.width = 256;
      baseShadowCanvas.height = 128;
      const baseShadowCtx = baseShadowCanvas.getContext('2d');
      if (baseShadowCtx) {
        const grad = baseShadowCtx.createRadialGradient(128, 64, 15, 128, 64, 120);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.52)');
        grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.18)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        baseShadowCtx.fillStyle = grad;
        baseShadowCtx.fillRect(0, 0, 256, 128);
      }
      const baseShadowTex = new THREE.CanvasTexture(baseShadowCanvas);
      const baseShadowGeom = new THREE.PlaneGeometry(counterWidth + 0.35, counterDepth + 0.28);
      const baseShadowMat = new THREE.MeshBasicMaterial({
        map: baseShadowTex,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const baseContactShadow = new THREE.Mesh(baseShadowGeom, baseShadowMat);
      baseContactShadow.rotation.x = -Math.PI / 2;
      baseContactShadow.position.set(0, 0.002, 0);
      floorUnitGroup.add(baseContactShadow);

      // Base Cabinet Carcass (Hollowed/Recessed underneath the sink basin)
      const carcassMat = new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.6 });
      const sinkIsLeft = config.sinkLocation === 'left';
      const sinkCarcassWidth = 0.82;
      const mainCarcassWidth = counterWidth - 0.02 - sinkCarcassWidth;

      // Carcass under non-sink main area (full height)
      const mainCarcassGeom = new THREE.BoxGeometry(mainCarcassWidth, baseCarcassHeight, counterDepth - 0.04);
      const mainCarcass = new THREE.Mesh(mainCarcassGeom, carcassMat);
      const mainCarcassX = sinkIsLeft 
        ? (-counterWidth / 2 + 0.01 + sinkCarcassWidth + mainCarcassWidth / 2) 
        : (-counterWidth / 2 + 0.01 + mainCarcassWidth / 2);
      mainCarcass.position.set(mainCarcassX, plinthHeight + baseCarcassHeight / 2, -0.01);
      mainCarcass.castShadow = true;
      mainCarcass.receiveShadow = true;
      floorUnitGroup.add(mainCarcass);

      // Carcass under sink basin (recessed height 0.48m so cavity & drain are completely unobstructed)
      const sinkCarcassHeight = 0.48;
      const sinkCarcassGeom = new THREE.BoxGeometry(sinkCarcassWidth, sinkCarcassHeight, counterDepth - 0.04);
      const sinkCarcass = new THREE.Mesh(sinkCarcassGeom, carcassMat);
      const sinkCarcassX = sinkIsLeft 
        ? (-counterWidth / 2 + 0.01 + sinkCarcassWidth / 2) 
        : (counterWidth / 2 - 0.01 - sinkCarcassWidth / 2);
      sinkCarcass.position.set(sinkCarcassX, plinthHeight + sinkCarcassHeight / 2, -0.01);
      sinkCarcass.castShadow = true;
      sinkCarcass.receiveShadow = true;
      floorUnitGroup.add(sinkCarcass);

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

      // Worktop / Countertop Slab with Sink Cutout
      // Dimensions: cutout 0.76m width x 0.48m depth centered at sinkX
      const cutoutW = 0.76;
      const cutoutD = 0.48;
      const sinkZ = 0.01;
      const cutoutX1 = sinkX - cutoutW / 2;
      const cutoutX2 = sinkX + cutoutW / 2;
      const cutoutZ1 = sinkZ - cutoutD / 2;
      const cutoutZ2 = sinkZ + cutoutD / 2;

      const minX = -counterWidth / 2;
      const maxX = counterWidth / 2;
      const minZ = -counterDepth / 2;
      const maxZ = counterDepth / 2;

      // 1) Outer side slab (between edge and sink)
      const outerSlabW = sinkIsLeft ? (cutoutX1 - minX) : (maxX - cutoutX2);
      const outerSlabX = sinkIsLeft ? (minX + cutoutX1) / 2 : (cutoutX2 + maxX) / 2;
      const outerSlabGeom = new THREE.BoxGeometry(outerSlabW, counterSlabThickness, counterDepth);
      const outerSlab = new THREE.Mesh(outerSlabGeom, countertopMat);
      outerSlab.position.set(outerSlabX, counterHeight - counterSlabThickness / 2, 0);
      outerSlab.castShadow = true;
      outerSlab.receiveShadow = true;
      floorUnitGroup.add(outerSlab);

      // 2) Inner slab (spanning cooktop and middle preparation area)
      const innerSlabW = sinkIsLeft ? (maxX - cutoutX2) : (cutoutX1 - minX);
      const innerSlabX = sinkIsLeft ? (cutoutX2 + maxX) / 2 : (minX + cutoutX1) / 2;
      const innerSlabGeom = new THREE.BoxGeometry(innerSlabW, counterSlabThickness, counterDepth);
      const innerSlab = new THREE.Mesh(innerSlabGeom, countertopMat);
      innerSlab.position.set(innerSlabX, counterHeight - counterSlabThickness / 2, 0);
      innerSlab.castShadow = true;
      innerSlab.receiveShadow = true;
      floorUnitGroup.add(innerSlab);

      // 3) Rear counter strip behind sink cutout
      const rearStripD = cutoutZ1 - minZ;
      const rearStripGeom = new THREE.BoxGeometry(cutoutW, counterSlabThickness, rearStripD);
      const rearStrip = new THREE.Mesh(rearStripGeom, countertopMat);
      rearStrip.position.set(sinkX, counterHeight - counterSlabThickness / 2, (minZ + cutoutZ1) / 2);
      rearStrip.castShadow = true;
      rearStrip.receiveShadow = true;
      floorUnitGroup.add(rearStrip);

      // 4) Front counter strip in front of sink cutout
      const frontStripD = maxZ - cutoutZ2;
      const frontStripGeom = new THREE.BoxGeometry(cutoutW, counterSlabThickness, frontStripD);
      const frontStrip = new THREE.Mesh(frontStripGeom, countertopMat);
      frontStrip.position.set(sinkX, counterHeight - counterSlabThickness / 2, (cutoutZ2 + maxZ) / 2);
      frontStrip.castShadow = true;
      frontStrip.receiveShadow = true;
      floorUnitGroup.add(frontStrip);

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
      sinkGroup.position.set(sinkX, counterHeight, sinkZ);

      // Sink Basin Material (Organic Glass or Brushed Stainless)
      const sinkMat = config.upgrades.sugoPikaSink
        ? new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.12,
            metalness: 0.05,
            side: THREE.DoubleSide,
          }) // Sugo-Pika Organic Glass (smooth, water-repellent)
        : new THREE.MeshStandardMaterial({
            color: 0xd1d5db,
            roughness: 0.22,
            metalness: 0.88,
            side: THREE.DoubleSide,
          }); // Standard Stainless Steel Sink

      // a) Outer Bevel Rim framing the cutout on top of the counter
      const rimH = 0.006;
      const rimBack = new THREE.Mesh(new THREE.BoxGeometry(0.79, rimH, 0.035), sinkMat);
      rimBack.position.set(0, rimH / 2, -0.23 + 0.0175);
      sinkGroup.add(rimBack);

      const rimFront = new THREE.Mesh(new THREE.BoxGeometry(0.79, rimH, 0.035), sinkMat);
      rimFront.position.set(0, rimH / 2, 0.23 - 0.0175);
      sinkGroup.add(rimFront);

      const rimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.035, rimH, 0.425), sinkMat);
      rimLeft.position.set(-0.395 + 0.0175, rimH / 2, 0);
      sinkGroup.add(rimLeft);

      const rimRight = new THREE.Mesh(new THREE.BoxGeometry(0.035, rimH, 0.425), sinkMat);
      rimRight.position.set(0.395 - 0.0175, rimH / 2, 0);
      sinkGroup.add(rimRight);

      // Soft contact shadow around and inside the sink rim for realistic spatial depth
      // 1) Ambient contact drop shadow underneath the outer bevel rim resting on the counter surface
      const outerRimShadowGeom = new THREE.PlaneGeometry(0.83, 0.53);
      const outerShadowCanvas = document.createElement('canvas');
      outerShadowCanvas.width = 128;
      outerShadowCanvas.height = 128;
      const oCtx = outerShadowCanvas.getContext('2d');
      if (oCtx) {
        oCtx.clearRect(0, 0, 128, 128);
        oCtx.fillStyle = 'rgba(0, 0, 0, 0)';
        oCtx.fillRect(0, 0, 128, 128);
        oCtx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        oCtx.lineWidth = 14;
        oCtx.strokeRect(7, 7, 114, 114);
      }
      const outerShadowTex = new THREE.CanvasTexture(outerShadowCanvas);
      const outerRimContactShadow = new THREE.Mesh(
        outerRimShadowGeom,
        new THREE.MeshBasicMaterial({
          map: outerShadowTex,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        })
      );
      outerRimContactShadow.rotation.x = -Math.PI / 2;
      outerRimContactShadow.position.set(0, 0.001, 0);
      sinkGroup.add(outerRimContactShadow);

      // 2) Inner ambient occlusion shadow bands along the top edges of the 4 inner cavity walls
      const innerShadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const rimShadowBack = new THREE.Mesh(new THREE.PlaneGeometry(0.73, 0.032), innerShadowMat);
      rimShadowBack.position.set(0, -0.016, -0.43 / 2 + 0.005);
      sinkGroup.add(rimShadowBack);

      const rimShadowFront = new THREE.Mesh(new THREE.PlaneGeometry(0.73, 0.032), innerShadowMat);
      rimShadowFront.position.set(0, -0.016, 0.43 / 2 - 0.005);
      rimShadowFront.rotation.y = Math.PI;
      sinkGroup.add(rimShadowFront);

      const rimShadowLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.032), innerShadowMat);
      rimShadowLeft.position.set(-0.73 / 2 + 0.005, -0.016, 0);
      rimShadowLeft.rotation.y = Math.PI / 2;
      sinkGroup.add(rimShadowLeft);

      const rimShadowRight = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.032), innerShadowMat);
      rimShadowRight.position.set(0.73 / 2 - 0.005, -0.016, 0);
      rimShadowRight.rotation.y = -Math.PI / 2;
      sinkGroup.add(rimShadowRight);

      // b) Sunken Cavity Box (width ~0.74m, depth ~0.44m, height/depth -0.18m)
      const basinCavityDepth = 0.18;
      const basinInnerW = 0.73;
      const basinInnerD = 0.43;

      // Bottom Floor Plate
      const basinFloor = new THREE.Mesh(
        new THREE.BoxGeometry(basinInnerW, 0.008, basinInnerD),
        sinkMat
      );
      basinFloor.position.set(0, -basinCavityDepth + 0.004, 0);
      basinFloor.receiveShadow = true;
      sinkGroup.add(basinFloor);

      // 4 Inner Cavity Walls with DoubleSide rendering
      const wallBack = new THREE.Mesh(
        new THREE.BoxGeometry(basinInnerW, basinCavityDepth, 0.008),
        sinkMat
      );
      wallBack.position.set(0, -basinCavityDepth / 2, -basinInnerD / 2 + 0.004);
      sinkGroup.add(wallBack);

      const wallFront = new THREE.Mesh(
        new THREE.BoxGeometry(basinInnerW, basinCavityDepth, 0.008),
        sinkMat
      );
      wallFront.position.set(0, -basinCavityDepth / 2, basinInnerD / 2 - 0.004);
      sinkGroup.add(wallFront);

      const wallLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, basinCavityDepth, basinInnerD - 0.016),
        sinkMat
      );
      wallLeft.position.set(-basinInnerW / 2 + 0.004, -basinCavityDepth / 2, 0);
      sinkGroup.add(wallLeft);

      const wallRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, basinCavityDepth, basinInnerD - 0.016),
        sinkMat
      );
      wallRight.position.set(basinInnerW / 2 - 0.004, -basinCavityDepth / 2, 0);
      sinkGroup.add(wallRight);

      // Wire sponge/soap drainer rack along back wall
      const rackGeom = new THREE.BoxGeometry(0.24, 0.024, 0.055);
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.92, roughness: 0.18 });
      const wireRack = new THREE.Mesh(rackGeom, rackMat);
      wireRack.position.set(-0.16, -0.04, -basinInnerD / 2 + 0.038);
      sinkGroup.add(wireRack);

      // c) Circular Drain Hole & Chrome Strainer Rim Assembly
      const drainX = 0.14;
      const drainZ = -0.05;

      // Chrome Strainer Outer Rim
      const drainRimGeom = new THREE.RingGeometry(0.042, 0.068, 32);
      const chromeDrainMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.96,
        roughness: 0.12,
        side: THREE.DoubleSide,
      });
      const drainRim = new THREE.Mesh(drainRimGeom, chromeDrainMat);
      drainRim.rotation.x = -Math.PI / 2;
      drainRim.position.set(drainX, -basinCavityDepth + 0.009, drainZ);
      sinkGroup.add(drainRim);

      // Dark Plumbing Drain Cavity (interior depth)
      const drainChamberGeom = new THREE.CylinderGeometry(0.042, 0.038, 0.045, 32);
      const darkDrainMat = new THREE.MeshStandardMaterial({
        color: 0x050811,
        roughness: 0.95,
        metalness: 0.08,
      });
      const drainChamber = new THREE.Mesh(drainChamberGeom, darkDrainMat);
      drainChamber.position.set(drainX, -basinCavityDepth - 0.018, drainZ);
      sinkGroup.add(drainChamber);

      // Stainless Strainer Perforated Disc / Cover Plug
      const plugPlateGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.004, 24);
      const plugPlate = new THREE.Mesh(plugPlateGeom, chromeDrainMat);
      plugPlate.position.set(drainX, -basinCavityDepth + 0.0095, drainZ);
      sinkGroup.add(plugPlate);

      // Center Handle Pin for Plug
      const plugHandleGeom = new THREE.CylinderGeometry(0.003, 0.003, 0.012, 16);
      const plugHandle = new THREE.Mesh(plugHandleGeom, chromeDrainMat);
      plugHandle.position.set(drainX, -basinCavityDepth + 0.016, drainZ);
      sinkGroup.add(plugHandle);

      // Strainer Perforation Grate Slot Ring
      const grateSlotGeom = new THREE.RingGeometry(0.025, 0.041, 24);
      const grateSlotMat = new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide });
      const grateSlot = new THREE.Mesh(grateSlotGeom, grateSlotMat);
      grateSlot.rotation.x = -Math.PI / 2;
      grateSlot.position.set(drainX, -basinCavityDepth + 0.0088, drainZ);
      sinkGroup.add(grateSlot);

      // Soft Interior Fill Light to guarantee sink cavity visibility
      const sinkCavityLight = new THREE.PointLight(0xffffff, 0.55, 1.8, 1.2);
      sinkCavityLight.position.set(0, 0.22, 0);
      sinkGroup.add(sinkCavityLight);

      // Panasonic Slim Touchless Sensor Faucet (Polished Chrome Finish with PBR Studio Reflections)
      const chromeFaucetMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.98,
        roughness: 0.08,
        envMapIntensity: 1.35,
      });

      const faucetGroup = new THREE.Group();
      faucetGroup.position.set(drainX, 0.003, -0.23);

      // Faucet Base Mount
      const faucetBaseGeom = new THREE.CylinderGeometry(0.024, 0.028, 0.08, 24);
      const faucetBase = new THREE.Mesh(faucetBaseGeom, chromeFaucetMat);
      faucetBase.position.set(0, 0.04, 0);
      faucetGroup.add(faucetBase);

      // Gooseneck Arch Spout (curves forward and downward directly over the drain hole)
      const spoutCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.04, 0),
        new THREE.Vector3(0, 0.28, 0.01),
        new THREE.Vector3(0, 0.35, 0.06),
        new THREE.Vector3(0, 0.34, 0.13),
        new THREE.Vector3(0, 0.26, 0.18),
      ]);
      const spoutGeom = new THREE.TubeGeometry(spoutCurve, 32, 0.013, 16, false);
      const spoutMesh = new THREE.Mesh(spoutGeom, chromeFaucetMat);
      faucetGroup.add(spoutMesh);

      // Aerator Nozzle Tip Mesh
      const nozzleGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.014, 16);
      const nozzleMesh = new THREE.Mesh(nozzleGeom, chromeFaucetMat);
      nozzleMesh.position.set(0, 0.26, 0.18);
      faucetGroup.add(nozzleMesh);

      // Touchless Optical Sensor Indicator (Cyan LED dot if upgrade active)
      if (config.upgrades.slimSensorFaucet) {
        const sensorRingGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16);
        const sensorMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
        const sensorRing = new THREE.Mesh(sensorRingGeom, sensorMat);
        sensorRing.rotation.x = Math.PI / 2;
        sensorRing.position.set(0, 0.31, 0.15);
        faucetGroup.add(sensorRing);
      }

      sinkGroup.add(faucetGroup);

      // Water Stream Integration (emanates from faucet nozzle tip and drops into drain hole)
      // Tip at Y=0.263, Drain at Y=-0.171 -> Height = 0.434m, Center Y = 0.046m
      const streamHeight = 0.434;
      const waterGeom = new THREE.CylinderGeometry(0.007, 0.009, streamHeight, 16);
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transmission: 0.88,
        opacity: 0.85,
        transparent: true,
        roughness: 0.05,
        ior: 1.33,
      });
      const waterStreamMesh = new THREE.Mesh(waterGeom, waterMat);
      waterStreamMesh.position.set(drainX, 0.046, drainZ);
      waterStreamMesh.visible = waterActive;
      sinkGroup.add(waterStreamMesh);
      waterStreamMeshRef.current = waterStreamMesh;

      // Animated Translucent Water Ripple Disc at drain bottom
      const rippleGeom = new THREE.RingGeometry(0.012, 0.055, 32);
      const rippleMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      const rippleDisc = new THREE.Mesh(rippleGeom, rippleMat);
      rippleDisc.rotation.x = -Math.PI / 2;
      rippleDisc.position.set(drainX, -basinCavityDepth + 0.011, drainZ);
      rippleDisc.visible = waterActive;
      sinkGroup.add(rippleDisc);
      waterRippleDiscRef.current = rippleDisc;

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
    markInteraction();
  }, [config, disposeHierarchy, markInteraction]);

  // Three.js Scene Setup, Interactive Throttling & Resource Cleanup
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

    // Renderer with optimized WebGL settings
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // PMREM Generator with subtle neutral studio/interior gradient for realistic PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x18202c);

    // Ceiling diffuse softbox panel (broad white luminaire for clean specular highlights)
    const ceilingSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    ceilingSoftbox.position.set(0, 5, 0);
    ceilingSoftbox.rotation.x = Math.PI / 2;
    envScene.add(ceilingSoftbox);

    // Front fill studio softbox (neutral studio reflector)
    const frontSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf1f5f9, side: THREE.DoubleSide })
    );
    frontSoftbox.position.set(0, 2.5, 6);
    frontSoftbox.rotation.y = Math.PI;
    envScene.add(frontSoftbox);

    // Left daylight accent reflector
    const leftReflector = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: 0xa5c9ea, side: THREE.DoubleSide })
    );
    leftReflector.position.set(-6, 2.5, 0);
    leftReflector.rotation.y = Math.PI / 2;
    envScene.add(leftReflector);

    // Right warm fill reflector
    const rightReflector = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: 0xfef3c7, side: THREE.DoubleSide })
    );
    rightReflector.position.set(6, 2.5, 0);
    rightReflector.rotation.y = -Math.PI / 2;
    envScene.add(rightReflector);

    // Floor reflection plane
    const envFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ color: 0x0a0f1d, side: THREE.DoubleSide })
    );
    envFloor.rotation.x = -Math.PI / 2;
    envFloor.position.set(0, -1, 0);
    envScene.add(envFloor);

    const envMapTarget = pmremGenerator.fromScene(envScene, 0.04);
    scene.environment = envMapTarget.texture;

    disposeHierarchy(envScene);
    pmremGenerator.dispose();

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
    controls.minDistance = 0.8;
    controls.maxDistance = 6.5;
    controls.target.set(0, 0.85, 0);
    controlsRef.current = controls;

    // Interaction listeners to drive throttling and wake up RAF
    const onInteraction = () => {
      markInteraction();
    };
    container.addEventListener('pointerdown', onInteraction, { passive: true });
    container.addEventListener('pointermove', onInteraction, { passive: true });
    container.addEventListener('wheel', onInteraction, { passive: true });
    container.addEventListener('touchstart', onInteraction, { passive: true });
    container.addEventListener('touchmove', onInteraction, { passive: true });
    controls.addEventListener('start', onInteraction);
    controls.addEventListener('change', onInteraction);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        markInteraction();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Showroom Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.65);
    scene.add(hemiLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    mainKeyLight.position.set(3.5, 4.5, 3.2);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
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

    // Throttled Animation Loop: Reduces CPU/GPU by throttling idle state & background animations
    const IDLE_THROTTLE_FPS = 30;
    const IDLE_FRAME_TIME = 1000 / IDLE_THROTTLE_FPS; // ~33.3ms
    const INTERACTION_TIMEOUT_MS = 1800; // 1.8s threshold for active interactions
    let clock = new THREE.Clock();

    const animate = (timestamp: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // 1. Completely pause rendering when browser tab is inactive/hidden
      if (document.hidden) return;

      const now = timestamp || performance.now();
      const timeSinceInteraction = now - lastInteractionTimeRef.current;
      const isUserInteracting = timeSinceInteraction < INTERACTION_TIMEOUT_MS;
      const isCameraTransitioning = targetCameraPosRef.current !== null;

      // Check if dishwasher door is still moving
      const targetRot = dishwasherOpenRef.current ? Math.PI / 2.2 : 0;
      const isDoorMoving = dishwasherDoorGroupRef.current &&
        Math.abs(dishwasherDoorGroupRef.current.rotation.x - targetRot) > 0.002;

      // Check if background mechanical animations are running
      const isDynamicBackground =
        fanActiveRef.current || waterActiveRef.current || burnerActiveRef.current || isDoorMoving;

      // 2. Idle State: Neither interacting nor animating -> Skip rendering entirely
      if (!isUserInteracting && !isCameraTransitioning && !isDynamicBackground) {
        if (!needsRenderRef.current) {
          return;
        }
      }

      // 3. Idle Background Animation State: Throttle rendering to 30 FPS to conserve GPU/CPU
      if (!isUserInteracting && !isCameraTransitioning) {
        if (now - lastRenderTimeRef.current < IDLE_FRAME_TIME && !needsRenderRef.current) {
          return;
        }
      }

      lastRenderTimeRef.current = now;
      needsRenderRef.current = false;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Animate fan rotation if active
      if (fanBladesRef.current && fanActiveRef.current) {
        fanBladesRef.current.rotation.y += delta * 12;
      }

      // Animate water flow wobble & ripple disc pulse if active
      if (waterStreamMeshRef.current && waterActiveRef.current) {
        waterStreamMeshRef.current.rotation.y = Math.sin(elapsedTime * 6) * 0.08;
      }
      if (waterRippleDiscRef.current && waterActiveRef.current) {
        const rippleScale = 1.0 + Math.sin(elapsedTime * 8) * 0.16;
        waterRippleDiscRef.current.scale.set(rippleScale, rippleScale, 1);
        if (waterRippleDiscRef.current.material instanceof THREE.Material) {
          waterRippleDiscRef.current.material.opacity = 0.45 + Math.sin(elapsedTime * 8) * 0.2;
        }
      }

      // Animate burner ring pulsing
      if (burnerActiveRef.current && burnerRingsRef.current.length > 0) {
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
        dishwasherDoorGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          dishwasherDoorGroupRef.current.rotation.x,
          targetRot,
          0.08
        );
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = newW / newH;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newW, newH);
          markInteraction();
        }
      }
    });
    resizeObserver.observe(container);

    // Complete Resource Cleanup on Unmount (Eliminate WebGL memory leaks)
    return () => {
      // 1. Cancel animation frame
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = 0;
      }

      // 2. Disconnect observers & remove event listeners
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      container.removeEventListener('pointerdown', onInteraction);
      container.removeEventListener('pointermove', onInteraction);
      container.removeEventListener('wheel', onInteraction);
      container.removeEventListener('touchstart', onInteraction);
      container.removeEventListener('touchmove', onInteraction);
      controls.removeEventListener('start', onInteraction);
      controls.removeEventListener('change', onInteraction);

      // 3. Dispose OrbitControls
      controls.dispose();
      controlsRef.current = null;

      // 4. Dispose environment map and all 3D geometries, materials, and textures in the scene
      if (envMapTarget) {
        envMapTarget.dispose();
      }
      scene.environment = null;
      disposeHierarchy(scene);
      scene.clear();
      sceneRef.current = null;

      // 5. Dispose WebGL renderer and force WebGL context loss
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch (e) {
        // Ignore potential WebGL extension errors
      }
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      rendererRef.current = null;

      // 6. Nullify all references for complete garbage collection
      cameraRef.current = null;
      kitchenGroupRef.current = null;
      waterStreamMeshRef.current = null;
      waterRippleDiscRef.current = null;
      burnerRingsRef.current = [];
      burnerLightsRef.current = [];
      fanBladesRef.current = null;
      ledLightRef.current = null;
      dishwasherDoorGroupRef.current = null;
      cabinetMaterialRef.current = null;
      countertopMaterialRef.current = null;
      targetCameraPosRef.current = null;
      targetLookAtRef.current = null;
    };
  }, [rebuildKitchenScene, disposeHierarchy, markInteraction]);

  // Re-run kitchen reconstruction on configuration change
  useEffect(() => {
    rebuildKitchenScene();
  }, [rebuildKitchenScene]);

  // Sync Water flow state
  useEffect(() => {
    if (waterStreamMeshRef.current) {
      waterStreamMeshRef.current.visible = waterActive;
    }
    if (waterRippleDiscRef.current) {
      waterRippleDiscRef.current.visible = waterActive;
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

  // Keyboard navigation on 3D canvas
  const handleCanvasKeyDown = (e: React.KeyboardEvent) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    markInteraction();

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const spherical = new THREE.Spherical();
      const offset = new THREE.Vector3().copy(cameraRef.current.position).sub(controls.target);
      spherical.setFromVector3(offset);
      spherical.theta += 0.08;
      offset.setFromSpherical(spherical);
      cameraRef.current.position.copy(controls.target).add(offset);
      controls.update();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const spherical = new THREE.Spherical();
      const offset = new THREE.Vector3().copy(cameraRef.current.position).sub(controls.target);
      spherical.setFromVector3(offset);
      spherical.theta -= 0.08;
      offset.setFromSpherical(spherical);
      cameraRef.current.position.copy(controls.target).add(offset);
      controls.update();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const spherical = new THREE.Spherical();
      const offset = new THREE.Vector3().copy(cameraRef.current.position).sub(controls.target);
      spherical.setFromVector3(offset);
      spherical.phi = Math.max(0.1, spherical.phi - 0.08);
      offset.setFromSpherical(spherical);
      cameraRef.current.position.copy(controls.target).add(offset);
      controls.update();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const spherical = new THREE.Spherical();
      const offset = new THREE.Vector3().copy(cameraRef.current.position).sub(controls.target);
      spherical.setFromVector3(offset);
      spherical.phi = Math.min(Math.PI / 2 - 0.05, spherical.phi + 0.08);
      offset.setFromSpherical(spherical);
      cameraRef.current.position.copy(controls.target).add(offset);
      controls.update();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      const offset = new THREE.Vector3().copy(cameraRef.current.position).sub(controls.target);
      if (offset.length() > 1.2) {
        offset.multiplyScalar(0.9);
        cameraRef.current.position.copy(controls.target).add(offset);
        controls.update();
      }
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      const offset = new THREE.Vector3().copy(cameraRef.current.position).sub(controls.target);
      if (offset.length() < 7.0) {
        offset.multiplyScalar(1.1);
        cameraRef.current.position.copy(controls.target).add(offset);
        controls.update();
      }
    } else if (e.key === '1') {
      e.preventDefault();
      handleApplyPreset('perspective');
    } else if (e.key === '2') {
      e.preventDefault();
      handleApplyPreset('front');
    } else if (e.key === '3') {
      e.preventDefault();
      handleApplyPreset('top');
    } else if (e.key === '4') {
      e.preventDefault();
      handleApplyPreset('sink');
    } else if (e.key === '5') {
      e.preventDefault();
      handleApplyPreset('cooktop');
    } else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      handleApplyPreset('perspective');
    }
  };

  // Generate accessible configuration text summary for screen readers
  const accessibleSummary = lang === 'ja'
    ? `パナソニック Sクラス システムキッチン 3Dモデル表示中。レイアウト: ${config.layout} (2550mm × 650mm × 850mm)、扉色: ${config.cabinetFinish}、シンク位置: ${config.sinkLocation === 'left' ? '左勝手 (L)' : '右勝手 (R)'}、フロアユニット: ${config.floorUnit === 'front-dishwasher' ? 'フロントオープン食洗機ユニット' : 'スライド引き出しユニット'}。稼働状態: 水流 ${waterActive ? '稼働' : '停止'}、IH ${burnerActive ? '点灯' : '消灯'}、ファン ${fanActive ? '回転' : '停止'}、LED照明 ${ledActive ? '点灯' : '消灯'}。キーボード操作案内: 矢印キーで視点回転、+/-キーでズーム、1〜5キーで視点プリセット切替、Rキーでリセット。`
    : lang === 'mm'
    ? `Panasonic S-Class မီးဖိုချောင် 3D မော်ဒယ်။ အပြင်အဆင်: ${config.layout} (2550mm × 650mm × 850mm)၊ ဘေစင်နေရာ: ${config.sinkLocation === 'left' ? 'ဘယ်' : 'ညာ'}၊ ခလုတ်များ: မြှားခလုတ်များဖြင့် လှည့်ကြည့်ပါ၊ +/- ဖြင့် ချုံ့/ချဲ့ပါ၊ 1-5 ဖြင့် အမြင်ပြောင်းပါ။`
    : `Panasonic S-Class System Kitchen 3D Interactive Model. Layout: ${config.layout} (2550mm x 650mm x 850mm), Cabinet finish: ${config.cabinetFinish}, Sink: ${config.sinkLocation === 'left' ? 'Left-handed' : 'Right-handed'}, Floor unit: ${config.floorUnit}. Keyboard controls: Arrow keys to rotate view, +/- to zoom, 1-5 keys for presets, R to reset camera.`;

  return (
    <section 
      role="region" 
      aria-label={lang === 'ja' ? '3Dシステムキッチン インタラクティブビューポート' : '3D System Kitchen Interactive Viewport'}
      className="relative w-full h-full min-h-[420px] lg:min-h-[520px] flex flex-col rounded-2xl overflow-hidden glass-panel border border-slate-700/60 shadow-2xl"
    >
      {/* 3D WebGL Canvas Container with Accessibility Attributes */}
      <div 
        ref={containerRef} 
        id="three-canvas-viewport" 
        role="region"
        tabIndex={0}
        aria-label={lang === 'ja' ? '3Dキッチンモデル インタラクティブ操作画面' : '3D Kitchen Model Interactive Viewport'}
        aria-describedby="three-viewport-summary"
        onKeyDown={handleCanvasKeyDown}
        className="w-full h-full flex-1 relative cursor-grab active:cursor-grabbing select-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset focus-visible:outline-none"
      />

      {/* Accessible Text Summary for Screen Readers */}
      <div id="three-viewport-summary" className="sr-only">
        {accessibleSummary}
      </div>

      {/* Top Floating Overlay Controls: Dimension badge & Viewport Tools */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none gap-2 z-10">
        {/* Dimensions & Active Layout Spec Pill */}
        <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-xs shadow-lg text-slate-200">
          <span className="w-2 h-2 rounded-full bg-[#00a86b] animate-pulse" aria-hidden="true" />
          <span className="font-semibold text-emerald-400">2550mm × 650mm × 850mm</span>
          <span className="text-slate-500" aria-hidden="true">|</span>
          <span className="text-slate-300">
            {config.sinkLocation === 'left' ? 'Sink Left (L)' : 'Sink Right (R)'}
          </span>
        </div>

        {/* Top-Right Quick View Presets & 2D Blueprint Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
          {onOpenBlueprint && (
            <button
              type="button"
              id="open-blueprint-btn"
              onClick={onOpenBlueprint}
              aria-label={t.view_blueprint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/80 hover:bg-[#00a86b]/20 hover:border-[#00a86b]/40 rounded-lg border border-transparent transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
              title={t.view_blueprint}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="hidden sm:inline">{t.view_blueprint}</span>
            </button>
          )}

          <button
            type="button"
            id="reset-cam-btn"
            onClick={() => handleApplyPreset('perspective')}
            aria-label={t.reset_camera}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
            title={t.reset_camera}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Bottom Interactive Simulation Dashboard: Water, Burner, Fan, Dishwasher Toggles */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Camera Angle Presets Toolbar */}
        <nav 
          aria-label={lang === 'ja' ? 'カメラ視点切替プリセット' : 'Camera view presets'} 
          className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-xl overflow-x-auto"
        >
          <div className="px-2 py-1 text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Camera className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <span className="hidden md:inline">{t.camera_presets}</span>
          </div>

          <button
            type="button"
            id="cam-preset-perspective"
            aria-pressed={currentPreset === 'perspective'}
            aria-label={t.cam_perspective}
            onClick={() => handleApplyPreset('perspective')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              currentPreset === 'perspective'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_perspective}
          </button>

          <button
            type="button"
            id="cam-preset-front"
            aria-pressed={currentPreset === 'front'}
            aria-label={t.cam_front}
            onClick={() => handleApplyPreset('front')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              currentPreset === 'front'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_front}
          </button>

          <button
            type="button"
            id="cam-preset-top"
            aria-pressed={currentPreset === 'top'}
            aria-label={t.cam_top}
            onClick={() => handleApplyPreset('top')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              currentPreset === 'top'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_top}
          </button>

          <button
            type="button"
            id="cam-preset-sink"
            aria-pressed={currentPreset === 'sink'}
            aria-label={t.cam_sink}
            onClick={() => handleApplyPreset('sink')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              currentPreset === 'sink'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_sink}
          </button>

          <button
            type="button"
            id="cam-preset-cooktop"
            aria-pressed={currentPreset === 'cooktop'}
            aria-label={t.cam_cooktop}
            onClick={() => handleApplyPreset('cooktop')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              currentPreset === 'cooktop'
                ? 'bg-[#00a86b] text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {t.cam_cooktop}
          </button>
        </nav>

        {/* 3D Functional Simulation Toggles */}
        <div 
          role="toolbar" 
          aria-label={lang === 'ja' ? '3D機能シミュレーション操作' : '3D equipment simulation controls'}
          className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-xl"
        >
          {/* Water Stream Toggle */}
          <button
            type="button"
            id="toggle-water-btn"
            aria-pressed={waterActive}
            aria-label={t.ctrl_water}
            onClick={() => setWaterActive(!waterActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              waterActive
                ? 'bg-blue-600/80 text-blue-100 border border-blue-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_water}
          >
            <Droplets className={`w-3.5 h-3.5 ${waterActive ? 'text-cyan-300 animate-bounce' : 'text-slate-400'}`} aria-hidden="true" />
            <span className="hidden sm:inline">{t.ctrl_water}</span>
          </button>

          {/* IH Burner Glow Toggle */}
          <button
            type="button"
            id="toggle-burner-btn"
            aria-pressed={burnerActive}
            aria-label={t.ctrl_burner}
            onClick={() => setBurnerActive(!burnerActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              burnerActive
                ? 'bg-red-600/80 text-red-100 border border-red-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_burner}
          >
            <Flame className={`w-3.5 h-3.5 ${burnerActive ? 'text-amber-300' : 'text-slate-400'}`} aria-hidden="true" />
            <span className="hidden sm:inline">{t.ctrl_burner}</span>
          </button>

          {/* Hood Fan Rotation Toggle */}
          <button
            type="button"
            id="toggle-fan-btn"
            aria-pressed={fanActive}
            aria-label={t.ctrl_fan}
            onClick={() => setFanActive(!fanActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              fanActive
                ? 'bg-emerald-600/80 text-emerald-100 border border-emerald-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_fan}
          >
            <Fan className={`w-3.5 h-3.5 ${fanActive ? 'text-emerald-300 animate-spin' : 'text-slate-400'}`} aria-hidden="true" />
            <span className="hidden sm:inline">{t.ctrl_fan}</span>
          </button>

          {/* Cabinet LED Light Toggle */}
          <button
            type="button"
            id="toggle-led-btn"
            aria-pressed={ledActive}
            aria-label={t.ctrl_led}
            onClick={() => setLedActive(!ledActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
              ledActive
                ? 'bg-amber-600/80 text-amber-100 border border-amber-400/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title={t.ctrl_led}
          >
            <Lightbulb className={`w-3.5 h-3.5 ${ledActive ? 'text-amber-300' : 'text-slate-400'}`} aria-hidden="true" />
            <span className="hidden sm:inline">{t.ctrl_led}</span>
          </button>

          {/* Dishwasher Open/Close if dishwasher selected */}
          {config.floorUnit === 'front-dishwasher' && (
            <button
              type="button"
              id="toggle-dishwasher-btn"
              aria-pressed={dishwasherOpen}
              aria-label={dishwasherOpen ? t.ctrl_door_close : t.ctrl_door_open}
              onClick={() => setDishwasherOpen(!dishwasherOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
                dishwasherOpen
                  ? 'bg-purple-600/80 text-purple-100 border border-purple-400/40 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title={t.ctrl_dishwasher}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{dishwasherOpen ? t.ctrl_door_close : t.ctrl_door_open}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default KitchenViewport3D;
