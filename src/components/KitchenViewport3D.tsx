import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { KitchenConfig, CameraPresetId, Language } from '../types';
import { CABINET_FINISHES } from '../data/configOptions';
import { TRANSLATIONS } from '../i18n/translations';
import { 
  Maximize2, 
  Minimize2,
  RotateCcw, 
  Droplets, 
  Flame, 
  Fan, 
  Lightbulb, 
  Layers, 
  Eye,
  Camera,
  Boxes,
  Split,
  Box,
  Disc,
  Grid
} from 'lucide-react';

export type WallFinishId = 'microcement' | 'tile' | 'accent_slate';

interface KitchenViewport3DProps {
  config: KitchenConfig;
  lang: Language;
  activeFocus?: 'sink' | 'cooktop' | 'hood' | 'perspective' | CameraPresetId;
  onSelectFinish?: (finishId: import('../types').CabinetFinishId) => void;
  onOpenQuotation?: () => void;
  onOpenBlueprint?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const KitchenViewport3D: React.FC<KitchenViewport3DProps> = ({
  config,
  lang,
  activeFocus,
  onSelectFinish,
  onOpenBlueprint,
  isSidebarOpen = true,
  onToggleSidebar,
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

  // Exploded View and Component Isolation States
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [activeIsolateView, setActiveIsolateView] = useState<'all' | 'base' | 'wall' | 'counter'>('all');

  // Architectural Studio Wall & Backsplash Finish State
  const [wallFinish, setWallFinish] = useState<WallFinishId>('microcement');

  // Internal Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Dynamic mesh & group references for animations, exploded views & isolation
  const kitchenGroupRef = useRef<THREE.Group | null>(null);
  const wallGroupRef = useRef<THREE.Group | null>(null);
  const counterGroupRef = useRef<THREE.Group | null>(null);
  const baseCabinetGroupRef = useRef<THREE.Group | null>(null);
  const drawerFrontsGroupRef = useRef<THREE.Group | null>(null);
  const plinthGroupRef = useRef<THREE.Group | null>(null);

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

  // Target and current animated exploded values for 60fps buttery lerping
  const targetExplodedFactorRef = useRef<number>(0);
  const currentExplodedFactorRef = useRef<number>(0);

  // Materials cache
  const cabinetMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const countertopMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const backsplashMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const boundaryWallMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

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

  // Exploded factor synchronization
  useEffect(() => {
    targetExplodedFactorRef.current = explodedFactor;
    markInteraction();
  }, [explodedFactor, markInteraction]);

  // Toggle Exploded View handler
  const handleToggleExploded = useCallback(() => {
    setIsExploded((prev) => {
      const next = !prev;
      const targetVal = next ? 1 : 0;
      setExplodedFactor(targetVal);
      targetExplodedFactorRef.current = targetVal;
      return next;
    });
    markInteraction();
  }, [markInteraction]);

  // Handle Component Isolation view with automatic camera adjustments
  const handleSetIsolateView = useCallback((mode: 'all' | 'base' | 'wall' | 'counter') => {
    setActiveIsolateView(mode);

    // Apply visibility immediately to groups
    if (wallGroupRef.current) wallGroupRef.current.visible = (mode === 'all' || mode === 'wall');
    if (counterGroupRef.current) counterGroupRef.current.visible = (mode === 'all' || mode === 'counter');
    if (baseCabinetGroupRef.current) baseCabinetGroupRef.current.visible = (mode === 'all' || mode === 'base');
    if (drawerFrontsGroupRef.current) drawerFrontsGroupRef.current.visible = (mode === 'all' || mode === 'base');
    if (plinthGroupRef.current) plinthGroupRef.current.visible = (mode === 'all' || mode === 'base');

    // Smoothly orient camera to focus on isolated target
    if (mode === 'base') {
      targetCameraPosRef.current = new THREE.Vector3(0, 1.15, 2.55);
      targetLookAtRef.current = new THREE.Vector3(0, 0.45, 0);
    } else if (mode === 'wall') {
      targetCameraPosRef.current = new THREE.Vector3(0, 2.05, 2.10);
      targetLookAtRef.current = new THREE.Vector3(0, 1.95, 0);
    } else if (mode === 'counter') {
      targetCameraPosRef.current = new THREE.Vector3(0, 1.85, 1.75);
      targetLookAtRef.current = new THREE.Vector3(0, 0.88, 0);
    } else {
      // Return to standard perspective
      targetCameraPosRef.current = new THREE.Vector3(2.35, 1.65, 2.65);
      targetLookAtRef.current = new THREE.Vector3(0, 0.88, 0);
    }

    markInteraction();
  }, [markInteraction]);

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
  const createWoodGrainTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base Japanese Oak warm tone
    ctx.fillStyle = '#d2ab79';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle fine vertical wood grain lines and undulating rings
    for (let x = 0; x < 512; x += 2) {
      const alpha = 0.035 + 0.03 * Math.sin(x * 0.12) + 0.02 * Math.cos(x * 0.05);
      const isDarker = (x % 6 === 0) || Math.random() > 0.82;
      ctx.fillStyle = isDarker ? `rgba(145, 95, 45, ${alpha})` : `rgba(235, 195, 140, ${alpha * 0.7})`;
      ctx.fillRect(x, 0, 1.5, 512);
    }

    // Add very fine noise texture for authentic timber tactile depth
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }, []);

  // Procedural microcement fine architectural noise bump map
  const createMicrocementTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base neutral soft grey
    ctx.fillStyle = '#e2e0dc';
    ctx.fillRect(0, 0, 512, 512);

    // Fine organic trowel marks and subtle microcement clouding
    for (let i = 0; i < 35; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const rad = 40 + Math.random() * 80;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const isDark = Math.random() > 0.5;
      grad.addColorStop(0, isDark ? 'rgba(215, 212, 207, 0.22)' : 'rgba(235, 233, 230, 0.22)');
      grad.addColorStop(1, 'rgba(226, 224, 220, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // High frequency procedural tactile stippling
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }, []);

  // Procedural Japanese 100x50mm subway ceramic tile bump / diffuse map
  const createSubwayTileTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base ceramic Japanese off-white
    ctx.fillStyle = '#eceae6';
    ctx.fillRect(0, 0, 512, 512);

    // Render 100mm x 50mm brick bond grid
    const tileW = 128; // 4 tiles wide across canvas
    const tileH = 64;  // 8 tiles high
    const groutWidth = 3;

    ctx.fillStyle = '#b8b5b0'; // Grout line color

    // Draw horizontal grout lines
    for (let y = 0; y <= 512; y += tileH) {
      ctx.fillRect(0, y - groutWidth / 2, 512, groutWidth);
    }

    // Draw staggered vertical grout lines (running brick bond)
    let row = 0;
    for (let y = 0; y < 512; y += tileH) {
      const xOffset = (row % 2 === 1) ? tileW / 2 : 0;
      for (let x = -tileW; x <= 512 + tileW; x += tileW) {
        ctx.fillRect(x + xOffset - groutWidth / 2, y, groutWidth, tileH);
      }
      row++;
    }

    // Subtle individual tile variation & ceramic glaze bevel sheen
    for (let r = 0; r < 8; r++) {
      const xOffset = (r % 2 === 1) ? tileW / 2 : 0;
      for (let c = -1; c < 5; c++) {
        const tx = c * tileW + xOffset + groutWidth;
        const ty = r * tileH + groutWidth;
        const tw = tileW - groutWidth * 2;
        const th = tileH - groutWidth * 2;

        // Subtle tile gradient for authentic ceramic bevel reflection
        const tileGrad = ctx.createLinearGradient(tx, ty, tx, ty + th);
        const slightVar = (Math.random() - 0.5) * 6;
        const baseVal = Math.round(236 + slightVar);
        tileGrad.addColorStop(0, `rgba(255, 255, 255, 0.28)`);
        tileGrad.addColorStop(0.3, `rgba(${baseVal}, ${baseVal - 2}, ${baseVal - 6}, 0.05)`);
        tileGrad.addColorStop(1, `rgba(215, 212, 208, 0.25)`);
        ctx.fillStyle = tileGrad;
        ctx.fillRect(tx, ty, tw, th);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    return texture;
  }, []);

  // Update wall finish materials dynamically in real-time
  const updateWallMaterials = useCallback((finish: WallFinishId) => {
    if (!backsplashMaterialRef.current) return;

    if (finish === 'microcement') {
      const noiseTex = createMicrocementTexture();
      backsplashMaterialRef.current.color.setHex(0xe2e0dc);
      backsplashMaterialRef.current.roughness = 0.78;
      backsplashMaterialRef.current.metalness = 0.02;
      backsplashMaterialRef.current.map = noiseTex;
      backsplashMaterialRef.current.bumpMap = noiseTex;
      backsplashMaterialRef.current.bumpScale = 0.003;
      backsplashMaterialRef.current.needsUpdate = true;
    } else if (finish === 'tile') {
      const tileTex = createSubwayTileTexture();
      backsplashMaterialRef.current.color.setHex(0xeceae6);
      backsplashMaterialRef.current.roughness = 0.35;
      backsplashMaterialRef.current.metalness = 0.05;
      backsplashMaterialRef.current.map = tileTex;
      backsplashMaterialRef.current.bumpMap = tileTex;
      backsplashMaterialRef.current.bumpScale = 0.008;
      backsplashMaterialRef.current.needsUpdate = true;
    } else if (finish === 'accent_slate') {
      backsplashMaterialRef.current.color.setHex(0x3b3e42);
      backsplashMaterialRef.current.roughness = 0.85;
      backsplashMaterialRef.current.metalness = 0.08;
      backsplashMaterialRef.current.map = null;
      backsplashMaterialRef.current.bumpMap = null;
      backsplashMaterialRef.current.needsUpdate = true;
    }

    markInteraction();
  }, [createMicrocementTexture, createSubwayTileTexture, markInteraction]);

  useEffect(() => {
    updateWallMaterials(wallFinish);
  }, [wallFinish, updateWallMaterials]);

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
    // Japanese luxury finishes:
    // - charcoal: { color: 0x222426, roughness: 0.68, metalness: 0.05 } (Deep architectural slate)
    // - white: { color: 0xf6f6f8, roughness: 0.32, metalness: 0.02 } (Matte satin lacquer)
    // - oak: { color: 0xd2ab79, roughness: 0.60, metalness: 0.0 } with procedural fine grain texture canvas
    const finishId = config.cabinetFinish;
    let cabinetMat: THREE.MeshStandardMaterial;

    if (finishId === 'white-w') {
      cabinetMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf6f6f8),
        roughness: 0.32,
        metalness: 0.02,
      });
    } else if (finishId === 'oak-wood') {
      const woodTexture = createWoodGrainTexture();
      cabinetMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xd2ab79),
        roughness: 0.60,
        metalness: 0.0,
        map: woodTexture || undefined,
      });
    } else {
      // 'charcoal-slate' (Deep architectural slate)
      cabinetMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x222426),
        roughness: 0.68,
        metalness: 0.05,
      });
    }
    cabinetMaterialRef.current = cabinetMat;

    // Countertop material: Organic White Quartz (#fafafa) - constant across all finishes
    const countertopMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xfafafa),
      roughness: 0.18,
      metalness: 0.03,
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

    // Jet black ceramic glass with subtle high gloss (roughness: 0.05, metalness: 0.2)
    const ceramicGlassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x060709),
      roughness: 0.05,
      metalness: 0.2,
      envMapIntensity: 1.15,
    });

    // Slim minimalist matte black handles (not neon-reflective)
    const matteBlackHandleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x181a1d),
      roughness: 0.85,
      metalness: 0.15,
    });

    // Floating Plinth Base: Brushed Titanium (#929497) - constant across all finishes
    const plinthMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x929497),
      metalness: 0.85,
      roughness: 0.3,
      envMapIntensity: 1.1,
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
    // Recessed floating plinth: height ~140mm (0.14m), inset by 80mm from all sides
    const plinthHeight = 0.14;
    const plinthInset = 0.08;
    const baseCarcassHeight = counterHeight - counterSlabThickness - plinthHeight; // 0.67m

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
    // 1. COMPONENT GROUPS (Wall, Counter, Base Cabinet, Drawers, Plinth)
    // ----------------------------------------------------
    const wallGroup = new THREE.Group();
    const counterGroup = new THREE.Group();
    const baseCabinetGroup = new THREE.Group();
    const drawerFrontsGroup = new THREE.Group();
    const plinthGroup = new THREE.Group();

    wallGroupRef.current = wallGroup;
    counterGroupRef.current = counterGroup;
    baseCabinetGroupRef.current = baseCabinetGroup;
    drawerFrontsGroupRef.current = drawerFrontsGroup;
    plinthGroupRef.current = plinthGroup;

    // Apply active isolation visibility
    wallGroup.visible = (activeIsolateView === 'all' || activeIsolateView === 'wall');
    counterGroup.visible = (activeIsolateView === 'all' || activeIsolateView === 'counter');
    baseCabinetGroup.visible = (activeIsolateView === 'all' || activeIsolateView === 'base');
    drawerFrontsGroup.visible = (activeIsolateView === 'all' || activeIsolateView === 'base');
    plinthGroup.visible = (activeIsolateView === 'all' || activeIsolateView === 'base');

    if (showFloorCabinet) {
      // Recessed Floating Plinth Base (height ~140mm, inset by 80mm from all sides)
      // Material: Brushed stainless steel/titanium (color: 0x909296, metalness: 0.85, roughness: 0.3)
      const plinthWidth = counterWidth - plinthInset * 2;
      const plinthDepth = counterDepth - plinthInset * 2;
      const plinthGeom = new THREE.BoxGeometry(plinthWidth, plinthHeight, plinthDepth);
      const plinth = new THREE.Mesh(plinthGeom, plinthMat);
      plinth.position.set(0, plinthHeight / 2, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      plinthGroup.add(plinth);

      // Continuous L-Type Plinth Return (if Type L): seamlessly wraps toe-kick underneath protruding wing
      if (isLType) {
        const returnLen = 1.15;
        const returnWidth = 0.65;
        const returnPlinthWidth = returnWidth - plinthInset * 2;
        const returnPlinthLen = returnLen - plinthInset; // Inset from front outer edge
        const returnPlinthX = -counterWidth / 2 + plinthInset + returnPlinthWidth / 2;
        const returnPlinthZ = counterDepth / 2 - plinthInset + returnPlinthLen / 2;

        const returnPlinthGeom = new THREE.BoxGeometry(returnPlinthWidth, plinthHeight, returnPlinthLen);
        const returnPlinth = new THREE.Mesh(returnPlinthGeom, plinthMat);
        returnPlinth.position.set(returnPlinthX, plinthHeight / 2, returnPlinthZ);
        returnPlinth.castShadow = true;
        returnPlinth.receiveShadow = true;
        plinthGroup.add(returnPlinth);
      }

      // Soft contact shadow beneath the floating plinth for realistic floor grounding
      const baseShadowCanvas = document.createElement('canvas');
      baseShadowCanvas.width = 256;
      baseShadowCanvas.height = 128;
      const baseShadowCtx = baseShadowCanvas.getContext('2d');
      if (baseShadowCtx) {
        const grad = baseShadowCtx.createRadialGradient(128, 64, 15, 128, 64, 120);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.40)');
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.12)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        baseShadowCtx.fillStyle = grad;
        baseShadowCtx.fillRect(0, 0, 256, 128);
      }
      const baseShadowTex = new THREE.CanvasTexture(baseShadowCanvas);
      const baseShadowGeom = new THREE.PlaneGeometry(plinthWidth + 0.18, plinthDepth + 0.18);
      const baseShadowMat = new THREE.MeshBasicMaterial({
        map: baseShadowTex,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const baseContactShadow = new THREE.Mesh(baseShadowGeom, baseShadowMat);
      baseContactShadow.rotation.x = -Math.PI / 2;
      baseContactShadow.position.set(0, 0.002, 0);
      plinthGroup.add(baseContactShadow);

      // Base Cabinet Carcass (Hollowed/Recessed underneath the sink basin)
      const carcassMat = new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.7, metalness: 0.05 });
      const sinkIsLeft = config.sinkLocation === 'left';
      const sinkCarcassWidth = 0.82;
      const mainCarcassWidth = counterWidth - 0.02 - sinkCarcassWidth;

      // Carcass under non-sink main area (full height suspended above plinth)
      const mainCarcassGeom = new THREE.BoxGeometry(mainCarcassWidth, baseCarcassHeight, counterDepth - 0.04);
      const mainCarcass = new THREE.Mesh(mainCarcassGeom, carcassMat);
      const mainCarcassX = sinkIsLeft 
        ? (-counterWidth / 2 + 0.01 + sinkCarcassWidth + mainCarcassWidth / 2) 
        : (-counterWidth / 2 + 0.01 + mainCarcassWidth / 2);
      mainCarcass.position.set(mainCarcassX, plinthHeight + baseCarcassHeight / 2, -0.01);
      mainCarcass.castShadow = true;
      mainCarcass.receiveShadow = true;
      baseCabinetGroup.add(mainCarcass);

      // Carcass under sink basin (recessed height 0.44m so cavity & drain are completely unobstructed)
      const sinkCarcassHeight = 0.44;
      const sinkCarcassGeom = new THREE.BoxGeometry(sinkCarcassWidth, sinkCarcassHeight, counterDepth - 0.04);
      const sinkCarcass = new THREE.Mesh(sinkCarcassGeom, carcassMat);
      const sinkCarcassX = sinkIsLeft 
        ? (-counterWidth / 2 + 0.01 + sinkCarcassWidth / 2) 
        : (counterWidth / 2 - 0.01 - sinkCarcassWidth / 2);
      sinkCarcass.position.set(sinkCarcassX, plinthHeight + sinkCarcassHeight / 2, -0.01);
      sinkCarcass.castShadow = true;
      sinkCarcass.receiveShadow = true;
      baseCabinetGroup.add(sinkCarcass);

      // Modular Cabinet Front Doors / Drawers (Suspended cleanly above floating plinth)
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
          dwDoor.position.set(0, (baseCarcassHeight - 0.01) / 2, 0.01);
          dwDoor.castShadow = true;
          doorPivot.add(dwDoor);

          // Top minimalist control trim
          const trimGeom = new THREE.BoxGeometry(w - 0.02, 0.08, 0.024);
          const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6, metalness: 0.3 });
          const trim = new THREE.Mesh(trimGeom, trimMat);
          trim.position.set(0, baseCarcassHeight - 0.01 - 0.04, 0.012);
          doorPivot.add(trim);

          // Panasonic Blue LED indicator strip
          const ledStripGeom = new THREE.BoxGeometry(0.16, 0.006, 0.026);
          const ledStripMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
          const ledStrip = new THREE.Mesh(ledStripGeom, ledStripMat);
          ledStrip.position.set(0, baseCarcassHeight - 0.01 - 0.035, 0.013);
          doorPivot.add(ledStrip);

          // Slim horizontal minimalist handle in matte black (not neon-reflective)
          const dwHandleGeom = new THREE.BoxGeometry(0.48, 0.012, 0.016);
          const dwHandle = new THREE.Mesh(dwHandleGeom, matteBlackHandleMat);
          dwHandle.position.set(0, baseCarcassHeight - 0.01 - 0.065, 0.02);
          doorPivot.add(dwHandle);

          // Interior rack simulation (visible when opened)
          const rackGeom = new THREE.BoxGeometry(w - 0.08, 0.04, 0.45);
          const rackMat = new THREE.MeshStandardMaterial({ color: 0x8892b0, wireframe: true });
          const rack = new THREE.Mesh(rackGeom, rackMat);
          rack.position.set(0, baseCarcassHeight * 0.5, -0.22);
          doorPivot.add(rack);

          dwGroup.add(doorPivot);
          drawerFrontsGroup.add(dwGroup);
          dishwasherDoorGroupRef.current = doorPivot;
        } else {
          // Standard High Storage drawers (3 stacked drawers per section, suspended above plinth)
          const drawerCount = 3;
          const drawerGap = 0.005;
          const drawerHeight = (baseCarcassHeight - drawerGap * (drawerCount + 1)) / drawerCount;

          for (let d = 0; d < drawerCount; d++) {
            const drawerY = plinthHeight + drawerGap + d * (drawerHeight + drawerGap) + drawerHeight / 2;
            const drawerGeom = new THREE.BoxGeometry(w - 0.015, drawerHeight, 0.02);
            const drawer = new THREE.Mesh(drawerGeom, cabinetMat);
            drawer.position.set(xPos, drawerY, counterDepth / 2 - 0.005);
            drawer.castShadow = true;
            drawerFrontsGroup.add(drawer);

            // Slim horizontal minimalist handles in matte black (not neon-reflective)
            const handleGeom = new THREE.BoxGeometry(w * 0.72, 0.011, 0.015);
            const handle = new THREE.Mesh(handleGeom, matteBlackHandleMat);
            handle.position.set(xPos, drawerY + drawerHeight / 2 - 0.022, counterDepth / 2 + 0.007);
            handle.castShadow = true;
            drawerFrontsGroup.add(handle);
          }
        }
      });

      // Peninsula rear finish panel (if Peninsula or Island)
      if (isPeninsula) {
        const backPanelGeom = new THREE.BoxGeometry(counterWidth - 0.02, baseCarcassHeight, 0.02);
        const backPanel = new THREE.Mesh(backPanelGeom, cabinetMat);
        backPanel.position.set(0, plinthHeight + baseCarcassHeight / 2, -counterDepth / 2 + 0.01);
        backPanel.castShadow = true;
        baseCabinetGroup.add(backPanel);
      }

      // Worktop / Countertop Slab with Sink Cutout
      // Dimensions: cutout 0.74m width x 0.44m depth centered at sinkX
      const cutoutW = 0.74;
      const cutoutD = 0.44;
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
      counterGroup.add(outerSlab);

      // 2) Inner slab (spanning cooktop and middle preparation area)
      const innerSlabW = sinkIsLeft ? (maxX - cutoutX2) : (cutoutX1 - minX);
      const innerSlabX = sinkIsLeft ? (cutoutX2 + maxX) / 2 : (minX + cutoutX1) / 2;
      const innerSlabGeom = new THREE.BoxGeometry(innerSlabW, counterSlabThickness, counterDepth);
      const innerSlab = new THREE.Mesh(innerSlabGeom, countertopMat);
      innerSlab.position.set(innerSlabX, counterHeight - counterSlabThickness / 2, 0);
      innerSlab.castShadow = true;
      innerSlab.receiveShadow = true;
      counterGroup.add(innerSlab);

      // 3) Rear counter strip behind sink cutout
      const rearStripD = cutoutZ1 - minZ;
      const rearStripGeom = new THREE.BoxGeometry(cutoutW, counterSlabThickness, rearStripD);
      const rearStrip = new THREE.Mesh(rearStripGeom, countertopMat);
      rearStrip.position.set(sinkX, counterHeight - counterSlabThickness / 2, (minZ + cutoutZ1) / 2);
      rearStrip.castShadow = true;
      rearStrip.receiveShadow = true;
      counterGroup.add(rearStrip);

      // 4) Front counter strip in front of sink cutout
      const frontStripD = maxZ - cutoutZ2;
      const frontStripGeom = new THREE.BoxGeometry(cutoutW, counterSlabThickness, frontStripD);
      const frontStrip = new THREE.Mesh(frontStripGeom, countertopMat);
      frontStrip.position.set(sinkX, counterHeight - counterSlabThickness / 2, (cutoutZ2 + maxZ) / 2);
      frontStrip.castShadow = true;
      frontStrip.receiveShadow = true;
      counterGroup.add(frontStrip);

      // Worktop front edge chamfer detail
      const edgeGeom = new THREE.CylinderGeometry(0.008, 0.008, counterWidth, 16);
      const edgeMesh = new THREE.Mesh(edgeGeom, countertopMat);
      edgeMesh.rotation.z = Math.PI / 2;
      edgeMesh.position.set(0, counterHeight - 0.008, counterDepth / 2);
      counterGroup.add(edgeMesh);

      // ----------------------------------------------------
      // L-Type Return Extension (if Type L)
      // ----------------------------------------------------
      if (isLType) {
        const returnLen = 1.15;
        const returnWidth = 0.65;
        const returnX = -counterWidth / 2 + returnWidth / 2;
        const returnZ = counterDepth / 2 + returnLen / 2;

        // 1) Base cabinet recessed carcass
        const lReturnCarcass = new THREE.Mesh(
          new THREE.BoxGeometry(returnWidth - 0.04, baseCarcassHeight, returnLen - 0.02),
          carcassMat
        );
        lReturnCarcass.position.set(returnX - 0.01, plinthHeight + baseCarcassHeight / 2, returnZ);
        lReturnCarcass.castShadow = true;
        lReturnCarcass.receiveShadow = true;
        baseCabinetGroup.add(lReturnCarcass);

        // Countertop slab extension
        const lReturnTop = new THREE.Mesh(
          new THREE.BoxGeometry(returnWidth, counterSlabThickness, returnLen),
          countertopMat
        );
        lReturnTop.position.set(returnX, counterHeight - counterSlabThickness / 2, returnZ);
        lReturnTop.castShadow = true;
        lReturnTop.receiveShadow = true;
        counterGroup.add(lReturnTop);

        // Countertop front edge chamfer for return wing
        const returnEdgeGeom = new THREE.CylinderGeometry(0.008, 0.008, returnWidth, 16);
        const returnEdgeMesh = new THREE.Mesh(returnEdgeGeom, countertopMat);
        returnEdgeMesh.rotation.z = Math.PI / 2;
        returnEdgeMesh.position.set(returnX, counterHeight - 0.008, counterDepth / 2 + returnLen);
        counterGroup.add(returnEdgeMesh);

        // 2) INNER FACADE (facing the interior workspace towards +X):
        // 3-tier realistic divided drawer facade matching main cabinet styling (18mm thick, 3mm shadow gaps)
        const returnDrawerCount = 3;
        const returnDrawerGap = 0.003; // 3mm dark shadow gap
        const returnDrawerThickness = 0.018; // 18mm thickness
        const returnDrawerHeight = (baseCarcassHeight - returnDrawerGap * (returnDrawerCount + 1)) / returnDrawerCount;
        const returnDrawerLength = returnLen - 0.04; // Length along Z-axis
        const innerFacadeX = returnX + returnWidth / 2 - returnDrawerThickness / 2;

        for (let d = 0; d < returnDrawerCount; d++) {
          const drawerY = plinthHeight + returnDrawerGap + d * (returnDrawerHeight + returnDrawerGap) + returnDrawerHeight / 2;
          
          // Drawer facade panel (extending along Z axis)
          const drawerGeom = new THREE.BoxGeometry(returnDrawerThickness, returnDrawerHeight, returnDrawerLength);
          const drawer = new THREE.Mesh(drawerGeom, cabinetMat);
          drawer.position.set(innerFacadeX, drawerY, returnZ);
          drawer.castShadow = true;
          drawer.receiveShadow = true;
          drawerFrontsGroup.add(drawer);

          // Matching minimalist horizontal handle in matte dark charcoal/black on each drawer tier
          const handleLength = returnDrawerLength * 0.68;
          const handleGeom = new THREE.BoxGeometry(0.015, 0.011, handleLength);
          const handle = new THREE.Mesh(handleGeom, matteBlackHandleMat);
          handle.position.set(innerFacadeX + returnDrawerThickness / 2 + 0.008, drawerY + returnDrawerHeight / 2 - 0.022, returnZ);
          handle.castShadow = true;
          drawerFrontsGroup.add(handle);
        }

        // 3) OUTER FACADE (facing outward into the room towards -X):
        // Architectural vertical panel divide lines (subtle 2mm recessed seams spaced evenly ~450mm apart)
        // Panasonic S-CLASS island end-panel aesthetic
        const outerFacadeThickness = 0.018;
        const outerFacadeX = returnX - returnWidth / 2 + outerFacadeThickness / 2;
        const seamGap = 0.002; // 2mm recessed shadow seam
        const numPanels = 3;
        const panelLength = (returnLen - (numPanels - 1) * seamGap) / numPanels; // ~380-450mm panels
        const panelStartZ = counterDepth / 2;

        for (let p = 0; p < numPanels; p++) {
          const pCenterZ = panelStartZ + p * (panelLength + seamGap) + panelLength / 2;
          const panelGeom = new THREE.BoxGeometry(outerFacadeThickness, baseCarcassHeight, panelLength);
          const panel = new THREE.Mesh(panelGeom, cabinetMat);
          panel.position.set(outerFacadeX, plinthHeight + baseCarcassHeight / 2, pCenterZ);
          panel.castShadow = true;
          panel.receiveShadow = true;
          baseCabinetGroup.add(panel);
        }

        // 4) FRONT CAP END PANEL (facing +Z at the terminal end of the return counter)
        const endPanelThickness = 0.018;
        const endPanelGeom = new THREE.BoxGeometry(returnWidth, baseCarcassHeight, endPanelThickness);
        const endPanel = new THREE.Mesh(endPanelGeom, cabinetMat);
        endPanel.position.set(returnX, plinthHeight + baseCarcassHeight / 2, counterDepth / 2 + returnLen - endPanelThickness / 2);
        endPanel.castShadow = true;
        endPanel.receiveShadow = true;
        baseCabinetGroup.add(endPanel);
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
        baseCabinetGroup.add(pCarcass);

        const pTop = new THREE.Mesh(
          new THREE.BoxGeometry(pLen, counterSlabThickness, pDepth),
          countertopMat
        );
        pTop.position.set(0, counterHeight - counterSlabThickness / 2, pZ);
        counterGroup.add(pTop);
      }

      // ----------------------------------------------------
      // 2. SEAMLESS UNDERMOUNT WHITE QUARTZ SINK & LUXURY FAUCET
      // ----------------------------------------------------
      const sinkGroup = new THREE.Group();
      sinkGroup.position.set(sinkX, counterHeight, sinkZ);

      // Seamless Undermount White Quartz Material (matching countertop, color: 0xf8f8fa, roughness: 0.25)
      const quartzSinkMat = new THREE.MeshStandardMaterial({
        color: 0xf8f8fa,
        roughness: 0.25,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });

      // Hollow basin cavity dimensions: depth = -180mm (0.18m)
      const basinCavityDepth = 0.18;
      const basinInnerW = cutoutW; // 0.74m
      const basinInnerD = cutoutD; // 0.44m

      // Top slightly beveled inner edges framing the seamless undermount cutout
      const bevelThick = 0.004;
      const bevelBack = new THREE.Mesh(new THREE.BoxGeometry(basinInnerW, bevelThick, bevelThick), quartzSinkMat);
      bevelBack.position.set(0, -bevelThick / 2, -basinInnerD / 2 + bevelThick / 2);
      sinkGroup.add(bevelBack);

      const bevelFront = new THREE.Mesh(new THREE.BoxGeometry(basinInnerW, bevelThick, bevelThick), quartzSinkMat);
      bevelFront.position.set(0, -bevelThick / 2, basinInnerD / 2 - bevelThick / 2);
      sinkGroup.add(bevelFront);

      const bevelLeft = new THREE.Mesh(new THREE.BoxGeometry(bevelThick, bevelThick, basinInnerD - bevelThick * 2), quartzSinkMat);
      bevelLeft.position.set(-basinInnerW / 2 + bevelThick / 2, -bevelThick / 2, 0);
      sinkGroup.add(bevelLeft);

      const bevelRight = new THREE.Mesh(new THREE.BoxGeometry(bevelThick, bevelThick, basinInnerD - bevelThick * 2), quartzSinkMat);
      bevelRight.position.set(basinInnerW / 2 - bevelThick / 2, -bevelThick / 2, 0);
      sinkGroup.add(bevelRight);

      // Hollow Basin Cavity: Bottom Floor Plate (-180mm depth)
      const floorThick = 0.012;
      const basinFloor = new THREE.Mesh(
        new THREE.BoxGeometry(basinInnerW, floorThick, basinInnerD),
        quartzSinkMat
      );
      basinFloor.position.set(0, -basinCavityDepth + floorThick / 2, 0);
      basinFloor.receiveShadow = true;
      sinkGroup.add(basinFloor);

      // 4 Vertical Inner Basin Walls extending down -180mm
      const wallThick = 0.012;
      const wallH = basinCavityDepth;
      const wallBack = new THREE.Mesh(new THREE.BoxGeometry(basinInnerW, wallH, wallThick), quartzSinkMat);
      wallBack.position.set(0, -wallH / 2, -basinInnerD / 2 - wallThick / 2);
      wallBack.receiveShadow = true;
      sinkGroup.add(wallBack);

      const wallFront = new THREE.Mesh(new THREE.BoxGeometry(basinInnerW, wallH, wallThick), quartzSinkMat);
      wallFront.position.set(0, -wallH / 2, basinInnerD / 2 + wallThick / 2);
      wallFront.receiveShadow = true;
      sinkGroup.add(wallFront);

      const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, basinInnerD + wallThick * 2), quartzSinkMat);
      wallLeft.position.set(-basinInnerW / 2 - wallThick / 2, -wallH / 2, 0);
      wallLeft.receiveShadow = true;
      sinkGroup.add(wallLeft);

      const wallRight = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, basinInnerD + wallThick * 2), quartzSinkMat);
      wallRight.position.set(basinInnerW / 2 + wallThick / 2, -wallH / 2, 0);
      wallRight.receiveShadow = true;
      sinkGroup.add(wallRight);

      // Bottom slightly beveled inner edges / fillets along the 4 base perimeters
      const bFilletSize = 0.008;
      const bFilletBack = new THREE.Mesh(new THREE.BoxGeometry(basinInnerW - bFilletSize * 2, bFilletSize, bFilletSize), quartzSinkMat);
      bFilletBack.position.set(0, -basinCavityDepth + floorThick + bFilletSize / 2, -basinInnerD / 2 + bFilletSize / 2);
      sinkGroup.add(bFilletBack);

      const bFilletFront = new THREE.Mesh(new THREE.BoxGeometry(basinInnerW - bFilletSize * 2, bFilletSize, bFilletSize), quartzSinkMat);
      bFilletFront.position.set(0, -basinCavityDepth + floorThick + bFilletSize / 2, basinInnerD / 2 - bFilletSize / 2);
      sinkGroup.add(bFilletFront);

      const bFilletLeft = new THREE.Mesh(new THREE.BoxGeometry(bFilletSize, bFilletSize, basinInnerD - bFilletSize * 2), quartzSinkMat);
      bFilletLeft.position.set(-basinInnerW / 2 + bFilletSize / 2, -basinCavityDepth + floorThick + bFilletSize / 2, 0);
      sinkGroup.add(bFilletLeft);

      const bFilletRight = new THREE.Mesh(new THREE.BoxGeometry(bFilletSize, bFilletSize, basinInnerD - bFilletSize * 2), quartzSinkMat);
      bFilletRight.position.set(basinInnerW / 2 - bFilletSize / 2, -basinCavityDepth + floorThick + bFilletSize / 2, 0);
      sinkGroup.add(bFilletRight);

      // Subtle inner ambient occlusion shadow planes near top rim for realistic hollow cavity depth
      const innerShadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shBack = new THREE.Mesh(new THREE.PlaneGeometry(basinInnerW, 0.04), innerShadowMat);
      shBack.position.set(0, -0.02, -basinInnerD / 2 + 0.001);
      sinkGroup.add(shBack);

      const shFront = new THREE.Mesh(new THREE.PlaneGeometry(basinInnerW, 0.04), innerShadowMat);
      shFront.position.set(0, -0.02, basinInnerD / 2 - 0.001);
      shFront.rotation.y = Math.PI;
      sinkGroup.add(shFront);

      const shLeft = new THREE.Mesh(new THREE.PlaneGeometry(basinInnerD, 0.04), innerShadowMat);
      shLeft.position.set(-basinInnerW / 2 + 0.001, -0.02, 0);
      shLeft.rotation.y = Math.PI / 2;
      sinkGroup.add(shLeft);

      const shRight = new THREE.Mesh(new THREE.PlaneGeometry(basinInnerD, 0.04), innerShadowMat);
      shRight.position.set(basinInnerW / 2 - 0.001, -0.02, 0);
      shRight.rotation.y = -Math.PI / 2;
      sinkGroup.add(shRight);

      // Soft interior fill light for sink cavity visibility
      const sinkCavityLight = new THREE.PointLight(0xffffff, 0.45, 1.8, 1.2);
      sinkCavityLight.position.set(0, 0.15, 0);
      sinkGroup.add(sinkCavityLight);

      // ----------------------------------------------------
      // UPPER RIGHT WIRE SPONGE/SOAP BASKET (Grid of thin silver cylinders)
      // ----------------------------------------------------
      const basketGroup = new THREE.Group();
      const basketW = 0.18;
      const basketD = 0.068;
      const basketH = 0.036;
      const basketCenterX = 0.22;
      const basketCenterZ = -0.165;
      const basketTopY = -0.022;
      const basketBottomY = basketTopY - basketH; // -0.058

      const chromeWireMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.98,
        roughness: 0.1,
        envMapIntensity: 1.35,
      });

      const wireRadius = 0.0014; // Thin silver cylinder wire

      // Helper functions to add thin silver wire cylinders
      const addWireX = (x: number, y: number, z: number, len: number) => {
        const geom = new THREE.CylinderGeometry(wireRadius, wireRadius, len, 8);
        const mesh = new THREE.Mesh(geom, chromeWireMat);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        basketGroup.add(mesh);
      };

      const addWireZ = (x: number, y: number, z: number, len: number) => {
        const geom = new THREE.CylinderGeometry(wireRadius, wireRadius, len, 8);
        const mesh = new THREE.Mesh(geom, chromeWireMat);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        basketGroup.add(mesh);
      };

      const addWireY = (x: number, y: number, z: number, len: number) => {
        const geom = new THREE.CylinderGeometry(wireRadius, wireRadius, len, 8);
        const mesh = new THREE.Mesh(geom, chromeWireMat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        basketGroup.add(mesh);
      };

      // Top Perimeter Wire Frame
      addWireX(basketCenterX, basketTopY, basketCenterZ - basketD / 2, basketW);
      addWireX(basketCenterX, basketTopY, basketCenterZ + basketD / 2, basketW);
      addWireZ(basketCenterX - basketW / 2, basketTopY, basketCenterZ, basketD);
      addWireZ(basketCenterX + basketW / 2, basketTopY, basketCenterZ, basketD);

      // Bottom Perimeter Wire Frame
      addWireX(basketCenterX, basketBottomY, basketCenterZ - basketD / 2, basketW);
      addWireX(basketCenterX, basketBottomY, basketCenterZ + basketD / 2, basketW);
      addWireZ(basketCenterX - basketW / 2, basketBottomY, basketCenterZ, basketD);
      addWireZ(basketCenterX + basketW / 2, basketBottomY, basketCenterZ, basketD);

      // 4 Corner Vertical Upright Wires
      const cornerY = (basketTopY + basketBottomY) / 2;
      addWireY(basketCenterX - basketW / 2, cornerY, basketCenterZ - basketD / 2, basketH);
      addWireY(basketCenterX + basketW / 2, cornerY, basketCenterZ - basketD / 2, basketH);
      addWireY(basketCenterX - basketW / 2, cornerY, basketCenterZ + basketD / 2, basketH);
      addWireY(basketCenterX + basketW / 2, cornerY, basketCenterZ + basketD / 2, basketH);

      // Intermediate Front & Side Wire Rails
      const midY = (basketTopY + basketBottomY) / 2;
      addWireX(basketCenterX, midY, basketCenterZ + basketD / 2, basketW);
      addWireZ(basketCenterX - basketW / 2, midY, basketCenterZ, basketD);
      addWireZ(basketCenterX + basketW / 2, midY, basketCenterZ, basketD);

      // Bottom Drainage Grid (mesh grid of thin silver cylinders)
      const gridRows = 5;
      for (let r = 0; r < gridRows; r++) {
        const wireZ = (basketCenterZ - basketD / 2) + (basketD / (gridRows + 1)) * (r + 1);
        addWireX(basketCenterX, basketBottomY, wireZ, basketW - 0.004);
      }
      const gridCols = 7;
      for (let c = 0; c < gridCols; c++) {
        const wireX = (basketCenterX - basketW / 2) + (basketW / (gridCols + 1)) * (c + 1);
        addWireZ(wireX, basketBottomY + 0.001, basketCenterZ, basketD - 0.004);
      }

      // 2 Chrome Mounting Brackets hooking to rear quartz wall
      const bracket1X = basketCenterX - basketW / 3;
      const bracket2X = basketCenterX + basketW / 3;
      [bracket1X, bracket2X].forEach((bX) => {
        const bHookGeom = new THREE.CylinderGeometry(0.0018, 0.0018, 0.035, 8);
        const bHook = new THREE.Mesh(bHookGeom, chromeWireMat);
        bHook.rotation.x = Math.PI / 2;
        bHook.position.set(bX, basketTopY + 0.005, -basinInnerD / 2 + 0.012);
        basketGroup.add(bHook);
      });

      // Realistic Sponge inside wire basket
      const spongeYellowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 });
      const spongeGreenMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.95 });
      const spongeGroup = new THREE.Group();
      spongeGroup.position.set(basketCenterX - 0.042, basketBottomY + 0.012, basketCenterZ);
      const spongeBase = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, 0.042), spongeYellowMat);
      spongeGroup.add(spongeBase);
      const spongeTop = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.005, 0.042), spongeGreenMat);
      spongeTop.position.set(0, 0.0115, 0);
      spongeGroup.add(spongeTop);
      basketGroup.add(spongeGroup);

      // Rounded Soap Bar inside wire basket
      const soapMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
      const soap = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.016, 0.038), soapMat);
      soap.position.set(basketCenterX + 0.045, basketBottomY + 0.010, basketCenterZ);
      basketGroup.add(soap);

      sinkGroup.add(basketGroup);

      // ----------------------------------------------------
      // LUXURY GOOSE-NECK FAUCET & CIRCULAR STRAINER DRAIN HOLE
      // ----------------------------------------------------
      // Faucet positioned neatly behind the wire basket area:
      // basketCenterX = 0.22, so faucet is centered at X = 0.22
      // Deck behind basin: cutout rear edge is at -basinInnerD / 2 = -0.22, counter rear is -0.325
      const faucetX = 0.22;
      const faucetZ = -0.265;
      const reachZ = 0.205; // Forward reach of swan neck spout
      const drainX = faucetX; // 0.22 (perfect alignment!)
      const drainZ = faucetZ + reachZ; // -0.060 (perfect alignment directly inside basin cavity!)

      // Circular Chrome Strainer Drain Hole at the bottom basin
      const drainY = -basinCavityDepth + floorThick; // -0.168
      const drainRimGeom = new THREE.RingGeometry(0.042, 0.064, 36);
      const chromeDrainMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.98,
        roughness: 0.1,
        side: THREE.DoubleSide,
      });
      const drainRim = new THREE.Mesh(drainRimGeom, chromeDrainMat);
      drainRim.rotation.x = -Math.PI / 2;
      drainRim.position.set(drainX, drainY + 0.001, drainZ);
      sinkGroup.add(drainRim);

      // Deep dark plumbing drain chamber
      const drainChamberGeom = new THREE.CylinderGeometry(0.042, 0.036, 0.05, 32);
      const darkDrainMat = new THREE.MeshStandardMaterial({
        color: 0x05070c,
        roughness: 0.95,
        metalness: 0.05,
      });
      const drainChamber = new THREE.Mesh(drainChamberGeom, darkDrainMat);
      drainChamber.position.set(drainX, drainY - 0.025, drainZ);
      sinkGroup.add(drainChamber);

      // Chrome Strainer Perforated Disc / Basket
      const strainerDiscGeom = new THREE.CylinderGeometry(0.026, 0.026, 0.003, 32);
      const strainerDisc = new THREE.Mesh(strainerDiscGeom, chromeDrainMat);
      strainerDisc.position.set(drainX, drainY + 0.002, drainZ);
      sinkGroup.add(strainerDisc);

      // Center Handle Pin / Post
      const pinGeom = new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 16);
      const pinMesh = new THREE.Mesh(pinGeom, chromeDrainMat);
      pinMesh.position.set(drainX, drainY + 0.009, drainZ);
      sinkGroup.add(pinMesh);

      const pinCapGeom = new THREE.SphereGeometry(0.0055, 16, 16);
      const pinCap = new THREE.Mesh(pinCapGeom, chromeDrainMat);
      pinCap.position.set(drainX, drainY + 0.016, drainZ);
      sinkGroup.add(pinCap);

      // Strainer Perforation Grate Slot Ring
      const slotRingGeom = new THREE.RingGeometry(0.027, 0.041, 32);
      const slotRingMat = new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide });
      const slotRing = new THREE.Mesh(slotRingGeom, slotRingMat);
      slotRing.rotation.x = -Math.PI / 2;
      slotRing.position.set(drainX, drainY + 0.0015, drainZ);
      sinkGroup.add(slotRing);

      // Luxury Swan-Neck Faucet (Mirror Polished Chrome: color: 0xffffff, metalness: 0.98, roughness: 0.1)
      const mirrorChromeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.98,
        roughness: 0.1,
        envMapIntensity: 1.5,
      });

      const faucetGroup = new THREE.Group();
      faucetGroup.position.set(faucetX, 0, faucetZ);

      // Deck escutcheon base flange
      const baseFlangeGeom = new THREE.CylinderGeometry(0.028, 0.030, 0.012, 32);
      const baseFlange = new THREE.Mesh(baseFlangeGeom, mirrorChromeMat);
      baseFlange.position.set(0, 0.006, 0);
      faucetGroup.add(baseFlange);

      const baseCollarGeom = new THREE.CylinderGeometry(0.023, 0.027, 0.010, 32);
      const baseCollar = new THREE.Mesh(baseCollarGeom, mirrorChromeMat);
      baseCollar.position.set(0, 0.016, 0);
      faucetGroup.add(baseCollar);

      // Vertical faucet body column
      const colGeom = new THREE.CylinderGeometry(0.020, 0.021, 0.11, 32);
      const colMesh = new THREE.Mesh(colGeom, mirrorChromeMat);
      colMesh.position.set(0, 0.075, 0);
      faucetGroup.add(colMesh);

      // Single-lever mixer handle (right side)
      const leverHubGeom = new THREE.CylinderGeometry(0.011, 0.011, 0.024, 20);
      const leverHub = new THREE.Mesh(leverHubGeom, mirrorChromeMat);
      leverHub.rotation.z = Math.PI / 2;
      leverHub.position.set(0.024, 0.075, 0);
      faucetGroup.add(leverHub);

      // Mixer control lever (slender cylindrical rod)
      const leverRodGeom = new THREE.CylinderGeometry(0.0035, 0.0035, 0.065, 16);
      const leverRod = new THREE.Mesh(leverRodGeom, mirrorChromeMat);
      leverRod.rotation.z = -0.55;
      leverRod.rotation.x = 0.25;
      leverRod.position.set(0.048, 0.10, 0.012);
      faucetGroup.add(leverRod);

      // Red/blue cold/hot micro dot
      const indexDotGeom = new THREE.PlaneGeometry(0.005, 0.002);
      const indexDotMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const indexDot = new THREE.Mesh(indexDotGeom, indexDotMat);
      indexDot.position.set(0.025, 0.088, 0.011);
      faucetGroup.add(indexDot);

      // Tall Elegant Swan-Neck Spout Arch
      const swanCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.13, 0),
        new THREE.Vector3(0, 0.26, 0.005),
        new THREE.Vector3(0, 0.41, 0.045),
        new THREE.Vector3(0, 0.40, 0.125),
        new THREE.Vector3(0, 0.33, 0.185),
        new THREE.Vector3(0, 0.25, reachZ),
      ]);
      const swanGeom = new THREE.TubeGeometry(swanCurve, 48, 0.0115, 20, false);
      const swanMesh = new THREE.Mesh(swanGeom, mirrorChromeMat);
      faucetGroup.add(swanMesh);

      // Pull-down aerator spray nozzle tip
      const nozzleGeom = new THREE.CylinderGeometry(0.0125, 0.0125, 0.024, 24);
      const nozzleMesh = new THREE.Mesh(nozzleGeom, mirrorChromeMat);
      nozzleMesh.position.set(0, 0.238, reachZ);
      faucetGroup.add(nozzleMesh);

      // Aerator bottom screen disc
      const aeratorGeom = new THREE.CylinderGeometry(0.010, 0.010, 0.002, 20);
      const aeratorMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.3 });
      const aerator = new THREE.Mesh(aeratorGeom, aeratorMat);
      aerator.position.set(0, 0.226, reachZ);
      faucetGroup.add(aerator);

      // Touchless optical sensor indicator window
      const sensorGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.003, 16);
      const sensorMat = new THREE.MeshBasicMaterial({
        color: config.upgrades.slimSensorFaucet ? 0x00f2fe : 0x1e293b,
      });
      const sensorMesh = new THREE.Mesh(sensorGeom, sensorMat);
      sensorMesh.rotation.x = Math.PI / 2;
      sensorMesh.position.set(0, 0.33, 0.16);
      faucetGroup.add(sensorMesh);

      sinkGroup.add(faucetGroup);

      // Water Stream: connects directly from nozzle bottom (Y=0.226) into circular strainer drain hole (Y=-0.166)
      // Tip at Y=0.226, Drain at Y=-0.166 -> streamHeight = 0.392m, streamCenterY = 0.030m
      const nozzleTipY = 0.226;
      const drainBottomY = drainY + 0.002; // -0.166
      const streamHeight = nozzleTipY - drainBottomY; // 0.392m
      const streamCenterY = (nozzleTipY + drainBottomY) / 2; // 0.030m

      const waterGeom = new THREE.CylinderGeometry(0.006, 0.0085, streamHeight, 20);
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transmission: 0.88,
        opacity: 0.85,
        transparent: true,
        roughness: 0.05,
        ior: 1.33,
      });
      const waterStreamMesh = new THREE.Mesh(waterGeom, waterMat);
      waterStreamMesh.position.set(drainX, streamCenterY, drainZ);
      waterStreamMesh.visible = waterActive;
      sinkGroup.add(waterStreamMesh);
      waterStreamMeshRef.current = waterStreamMesh;

      // Animated water ripple disc at the drain hole
      const rippleGeom = new THREE.RingGeometry(0.012, 0.055, 32);
      const rippleMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      const rippleDisc = new THREE.Mesh(rippleGeom, rippleMat);
      rippleDisc.rotation.x = -Math.PI / 2;
      rippleDisc.position.set(drainX, drainY + 0.003, drainZ);
      rippleDisc.visible = waterActive;
      sinkGroup.add(rippleDisc);
      waterRippleDiscRef.current = rippleDisc;

      counterGroup.add(sinkGroup);

      // ----------------------------------------------------
      // 3. PANASONIC TRIPLE-WIDE IH & EXHAUST GRILLES
      // ----------------------------------------------------
      const cooktopGroup = new THREE.Group();
      const cooktopZ = 0.035;
      cooktopGroup.position.set(cooktopX, counterHeight, cooktopZ);

      // Ceramic Glass Cooktop Plate (Horizontal Triple-Wide IH format: W900mm x D350mm)
      const cooktopWidth = 0.90;
      const cooktopDepth = 0.35;
      const glassThickness = 0.005;

      const glassPlateGeom = new THREE.BoxGeometry(cooktopWidth, glassThickness, cooktopDepth);
      const glassPlate = new THREE.Mesh(glassPlateGeom, ceramicGlassMat);
      glassPlate.position.set(0, glassThickness / 2, 0);
      glassPlate.receiveShadow = true;
      cooktopGroup.add(glassPlate);

      // Slim perimeter beveled frame
      const frameGeom = new THREE.BoxGeometry(cooktopWidth + 0.008, glassThickness - 0.001, cooktopDepth + 0.008);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x1c1f24,
        roughness: 0.5,
        metalness: 0.5,
      });
      const frame = new THREE.Mesh(frameGeom, frameMat);
      frame.position.set(0, glassThickness / 2 - 0.0005, 0);
      cooktopGroup.add(frame);

      // Panasonic Horizontal Triple-Wide IH: 3 induction burner zones lined up side-by-side
      const burnerPositions = [-0.28, 0, 0.28];
      burnerRingsRef.current = [];
      burnerLightsRef.current = [];

      burnerPositions.forEach((bX, bIdx) => {
        // Outer luminous ring (Panasonic glowing guide ring)
        const ringGeom = new THREE.RingGeometry(0.08, 0.095, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: bIdx === 1 ? 0xff6200 : (bIdx === 0 ? 0xff3b30 : 0x00d2ff),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: burnerActive ? 0.95 : 0.22,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(bX, glassThickness + 0.001, 0.005);
        cooktopGroup.add(ringMesh);
        burnerRingsRef.current.push(ringMesh);

        // Inner glowing coil circle
        const innerRingGeom = new THREE.RingGeometry(0.025, 0.048, 32);
        const innerRingMat = new THREE.MeshBasicMaterial({
          color: bIdx === 1 ? 0xffaa00 : (bIdx === 0 ? 0xff7b00 : 0x00f0ff),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: burnerActive ? 0.8 : 0.15,
        });
        const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.set(bX, glassThickness + 0.001, 0.005);
        cooktopGroup.add(innerRing);
        burnerRingsRef.current.push(innerRing);

        // Center crosshair marker for pot alignment
        const crossHGeom = new THREE.PlaneGeometry(0.024, 0.002);
        const crossVGeom = new THREE.PlaneGeometry(0.002, 0.024);
        const crossMat = new THREE.MeshBasicMaterial({
          color: 0x9098a0,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        });
        const crossH = new THREE.Mesh(crossHGeom, crossMat);
        crossH.rotation.x = -Math.PI / 2;
        crossH.position.set(bX, glassThickness + 0.0011, 0.005);
        cooktopGroup.add(crossH);

        const crossV = new THREE.Mesh(crossVGeom, crossMat);
        crossV.rotation.x = -Math.PI / 2;
        crossV.position.set(bX, glassThickness + 0.0011, 0.005);
        cooktopGroup.add(crossV);

        // Point light for cooking glow
        const bLight = new THREE.PointLight(
          bIdx === 1 ? 0xff6e00 : (bIdx === 0 ? 0xff4500 : 0x00e5ff),
          burnerActive ? 0.85 : 0,
          0.65
        );
        bLight.position.set(cooktopX + bX, counterHeight + 0.06, cooktopZ + 0.005);
        counterGroup.add(bLight);
        burnerLightsRef.current.push(bLight);
      });

      // Front capacitive touch control strip
      const touchBarGeom = new THREE.BoxGeometry(cooktopWidth * 0.82, 0.001, 0.034);
      const touchBarMat = new THREE.MeshBasicMaterial({ color: 0x14181f });
      const touchBar = new THREE.Mesh(touchBarGeom, touchBarMat);
      touchBar.position.set(0, glassThickness + 0.0008, cooktopDepth / 2 - 0.024);
      cooktopGroup.add(touchBar);

      // Touch sensor control icons for each of the 3 burner positions
      burnerPositions.forEach((bX) => {
        const btnGeom = new THREE.PlaneGeometry(0.04, 0.014);
        const btnMat = new THREE.MeshBasicMaterial({ color: 0x3b4252, side: THREE.DoubleSide });
        const btn = new THREE.Mesh(btnGeom, btnMat);
        btn.rotation.x = -Math.PI / 2;
        btn.position.set(bX, glassThickness + 0.0012, cooktopDepth / 2 - 0.024);
        cooktopGroup.add(btn);
      });

      // 3 SLIM HORIZONTAL VENTILATION GRILLES (Directly behind the cooktop glass)
      // Specifications: black air vent slots, width 180mm x depth 35mm each, flush with counter
      const grilleZ = -cooktopDepth / 2 - 0.012 - 0.035 / 2;
      const grilleOffsets = [-0.28, 0, 0.28]; // Aligned with the 3 burner zones

      const grilleMat = new THREE.MeshStandardMaterial({
        color: 0x181a1d,
        roughness: 0.75,
        metalness: 0.35,
      });
      const grilleCavityMat = new THREE.MeshBasicMaterial({ color: 0x050608 });
      const slatMat = new THREE.MeshStandardMaterial({
        color: 0x22262c,
        roughness: 0.6,
        metalness: 0.45,
      });

      grilleOffsets.forEach((gX) => {
        const grilleUnit = new THREE.Group();
        grilleUnit.position.set(gX, 0.0015, grilleZ);

        // Outer flush black frame (width 180mm x depth 35mm x height 3mm)
        const gFrameGeom = new THREE.BoxGeometry(0.18, 0.003, 0.035);
        const gFrame = new THREE.Mesh(gFrameGeom, grilleMat);
        grilleUnit.add(gFrame);

        // Recessed black air intake slot cavity
        const gCavityGeom = new THREE.BoxGeometry(0.172, 0.0035, 0.027);
        const gCavity = new THREE.Mesh(gCavityGeom, grilleCavityMat);
        gCavity.position.set(0, 0.0005, 0);
        grilleUnit.add(gCavity);

        // 4 slim horizontal aerodynamic exhaust louvers / slats
        const numSlats = 4;
        for (let s = 0; s < numSlats; s++) {
          const slatOffsetZ = -0.009 + s * 0.006;
          const slatGeom = new THREE.BoxGeometry(0.17, 0.0015, 0.0024);
          const slat = new THREE.Mesh(slatGeom, slatMat);
          slat.position.set(0, 0.0015, slatOffsetZ);
          grilleUnit.add(slat);
        }

        cooktopGroup.add(grilleUnit);
      });

      counterGroup.add(cooktopGroup);
    }

    kitchen.add(plinthGroup);
    kitchen.add(baseCabinetGroup);
    kitchen.add(drawerFrontsGroup);
    kitchen.add(counterGroup);

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

        // Slim horizontal minimalist handles in matte black
        const uHandleGeom = new THREE.BoxGeometry(uDoorWidth * 0.65, 0.01, 0.014);
        const uHandle = new THREE.Mesh(uHandleGeom, matteBlackHandleMat);
        uHandle.position.set(uDoorX, wallCabY - wallCabHeight / 2 + 0.03, -counterDepth / 2 + wallCabDepth + 0.008);
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

      wallGroup.add(wallCabinetGroup);
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

      wallGroup.add(hoodGroup);
    }

    kitchen.add(wallGroup);

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
    scene.background = new THREE.Color(0xf4f4f6);

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
    renderer.setClearColor(0xf4f4f6, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // PMREM Generator with subtle neutral studio/interior gradient for realistic PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xf4f4f6);

    // Ceiling diffuse softbox panel (broad white luminaire for clean specular highlights)
    const ceilingSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    ceilingSoftbox.position.set(0, 6, 0);
    ceilingSoftbox.rotation.x = Math.PI / 2;
    envScene.add(ceilingSoftbox);

    // Front fill studio softbox (neutral studio reflector)
    const frontSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    frontSoftbox.position.set(0, 3, 7);
    frontSoftbox.rotation.y = Math.PI;
    envScene.add(frontSoftbox);

    // Left daylight accent reflector
    const leftReflector = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8eef5, side: THREE.DoubleSide })
    );
    leftReflector.position.set(-7, 3, 0);
    leftReflector.rotation.y = Math.PI / 2;
    envScene.add(leftReflector);

    // Right warm fill reflector
    const rightReflector = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfcf9f2, side: THREE.DoubleSide })
    );
    rightReflector.position.set(7, 3, 0);
    rightReflector.rotation.y = -Math.PI / 2;
    envScene.add(rightReflector);

    // Floor reflection plane
    const envFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial({ color: 0xd8d8db, side: THREE.DoubleSide })
    );
    envFloor.rotation.x = -Math.PI / 2;
    envFloor.position.set(0, -0.5, 0);
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

    // Panasonic Luxury Showroom Lighting Setup
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdedede, 0.9);
    scene.add(hemiLight);

    const primaryDirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    primaryDirLight.position.set(4, 7, 5);
    primaryDirLight.castShadow = true;
    primaryDirLight.shadow.mapSize.width = 2048;
    primaryDirLight.shadow.mapSize.height = 2048;
    primaryDirLight.shadow.radius = 3.5;
    primaryDirLight.shadow.bias = -0.0001;
    primaryDirLight.shadow.camera.near = 0.5;
    primaryDirLight.shadow.camera.far = 25;
    primaryDirLight.shadow.camera.left = -4.5;
    primaryDirLight.shadow.camera.right = 4.5;
    primaryDirLight.shadow.camera.top = 4.5;
    primaryDirLight.shadow.camera.bottom = -4.5;
    scene.add(primaryDirLight);

    // Architectural Showroom Floor
    const floorGeom = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8db,
      roughness: 0.6,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Studio Boundary Walls (Left and Back, color: #e4e2de)
    const boundaryWallMat = new THREE.MeshStandardMaterial({
      color: 0xe4e2de,
      roughness: 0.88,
    });
    boundaryWallMaterialRef.current = boundaryWallMat;

    // Back Studio Boundary Wall
    const backWallGeom = new THREE.PlaneGeometry(24, 12);
    const backWall = new THREE.Mesh(backWallGeom, boundaryWallMat);
    backWall.position.set(0, 5, -0.65 / 2 - 0.05);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left Studio Boundary Wall
    const leftWallGeom = new THREE.PlaneGeometry(24, 12);
    const leftWall = new THREE.Mesh(leftWallGeom, boundaryWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-6, 5, 5);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Dedicated Kitchen Backsplash Panel positioned precisely between countertop surface (Y=0.85m) and wall cabinets (Y=1.55m)
    // Height = 0.70m, Center Y = 1.20m, Width = 3.60m, Depth offset Z = -0.325 - 0.005m
    const backsplashGeom = new THREE.PlaneGeometry(3.6, 0.70);
    const initialNoise = createMicrocementTexture();
    const backsplashMat = new THREE.MeshStandardMaterial({
      color: 0xe2e0dc,
      roughness: 0.78,
      metalness: 0.02,
      map: initialNoise,
      bumpMap: initialNoise,
      bumpScale: 0.003,
    });
    backsplashMaterialRef.current = backsplashMat;

    const backsplashPanel = new THREE.Mesh(backsplashGeom, backsplashMat);
    backsplashPanel.position.set(0, 1.20, -0.65 / 2 - 0.004);
    backsplashPanel.receiveShadow = true;
    scene.add(backsplashPanel);

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

      // Check if exploded view is still lerping
      const isExplodedTransitioning =
        Math.abs(currentExplodedFactorRef.current - targetExplodedFactorRef.current) > 0.001;

      // Check if background mechanical animations are running
      const isDynamicBackground =
        fanActiveRef.current || waterActiveRef.current || burnerActiveRef.current || isDoorMoving || isExplodedTransitioning;

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

      // Smooth Exploded View Lerping
      currentExplodedFactorRef.current = THREE.MathUtils.lerp(
        currentExplodedFactorRef.current,
        targetExplodedFactorRef.current,
        0.08
      );
      const ef = currentExplodedFactorRef.current;

      // Apply explosive offsets according to architecture specification:
      // wallGroup moves +Y by (explodedFactor * 0.45m)
      if (wallGroupRef.current) {
        wallGroupRef.current.position.y = ef * 0.45;
      }
      // counterGroup moves +Y by (explodedFactor * 0.15m)
      if (counterGroupRef.current) {
        counterGroupRef.current.position.y = ef * 0.15;
      }
      // drawerFrontsGroup moves +Z by (explodedFactor * 0.35m) forward
      if (drawerFrontsGroupRef.current) {
        drawerFrontsGroupRef.current.position.z = ef * 0.35;
      }
      // plinthGroup moves -Y by (explodedFactor * 0.10m) downward
      if (plinthGroupRef.current) {
        plinthGroupRef.current.position.y = -ef * 0.10;
      }

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

    // Resize Observer attached to containerRef
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width || (containerRef.current?.clientWidth ?? 0);
        const height = entry.contentRect.height || (containerRef.current?.clientHeight ?? 0);
        if (width > 0 && height > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height);
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

  // Synchronously update camera projection matrix and renderer size across the 300ms sidebar transition
  useEffect(() => {
    let frameId: number;
    const startTime = performance.now();
    const duration = 350; // slightly exceeds 300ms CSS duration for crisp settling

    const handleTransitionResize = (time: number) => {
      if (containerRef.current && cameraRef.current && rendererRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        if (width > 0 && height > 0) {
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height);
          markInteraction();
        }
      }
      if (time - startTime < duration) {
        frameId = requestAnimationFrame(handleTransitionResize);
      }
    };

    frameId = requestAnimationFrame(handleTransitionResize);
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isSidebarOpen, markInteraction]);

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

      {/* Top Floating Overlay Controls: Dimension badge, Material Swatch Selector & Viewport Tools */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none gap-2 z-10">
        <div className="flex flex-wrap items-center gap-2 pointer-events-none">
          {/* Dimensions & Active Layout Spec Pill */}
          <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-xs shadow-lg text-slate-200">
            <span className="w-2 h-2 rounded-full bg-[#00a86b] animate-pulse" aria-hidden="true" />
            <span className="font-semibold text-emerald-400">2550mm × 650mm × 850mm</span>
            <span className="text-slate-500" aria-hidden="true">|</span>
            <span className="text-slate-300">
              {config.sinkLocation === 'left' ? 'Sink Left (L)' : 'Sink Right (R)'}
            </span>
          </div>

          {/* Floating Material Swatch Selector (Japanese Luxury Finishes) */}
          <div 
            role="toolbar"
            aria-label={lang === 'ja' ? '扉面材マテリアル選択' : 'Cabinet Material Finishes'}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-lg"
          >
            <span className="text-[11px] font-medium text-slate-400 pl-1 pr-0.5 hidden sm:inline">
              {lang === 'ja' ? '面材' : 'Finish'}:
            </span>

            {/* 1) Charcoal Slate (#222426) */}
            <button
              type="button"
              id="swatch-charcoal-slate"
              onClick={() => onSelectFinish && onSelectFinish('charcoal-slate')}
              aria-label={lang === 'ja' ? 'チャコールスレート (マット濃色無地)' : 'Charcoal Slate (Architectural Slate)'}
              title={lang === 'ja' ? 'チャコールスレート (マット深灰色)' : 'Charcoal Slate'}
              className={`group relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                config.cabinetFinish === 'charcoal-slate'
                  ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-md'
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#222426' }}
            >
              <span className="w-full h-full rounded-full border border-white/20" />
            </button>

            {/* 2) Japanese Oak (#d2ab79 with wood ring icon) */}
            <button
              type="button"
              id="swatch-oak-wood"
              onClick={() => onSelectFinish && onSelectFinish('oak-wood')}
              aria-label={lang === 'ja' ? 'オークナチュラル (繊細木目調)' : 'Japanese Oak Natural (Fine Grain Wood)'}
              title={lang === 'ja' ? 'オークナチュラル (木目調)' : 'Japanese Oak Wood'}
              className={`group relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                config.cabinetFinish === 'oak-wood'
                  ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-md'
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#d2ab79' }}
            >
              <Disc className="w-3 h-3 text-amber-950/70" aria-hidden="true" />
            </button>

            {/* 3) Silk White (#f6f6f8 with dark border) */}
            <button
              type="button"
              id="swatch-white-w"
              onClick={() => onSelectFinish && onSelectFinish('white-w')}
              aria-label={lang === 'ja' ? 'シルクホワイト (マットサテン塗装)' : 'Silk White (Matte Satin Lacquer)'}
              title={lang === 'ja' ? 'シルクホワイト (サテン白)' : 'Silk White'}
              className={`group relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                config.cabinetFinish === 'white-w'
                  ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-md'
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#f6f6f8' }}
            >
              <span className="w-full h-full rounded-full border border-slate-400/80" />
            </button>
          </div>

          {/* Floating Wall Style HUD Selector (Microcement, Subway Tile, Accent Slate) */}
          <div 
            role="toolbar"
            aria-label={lang === 'ja' ? '壁・バックパネル仕上げ選択' : 'Architectural Wall & Backsplash Finishes'}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-lg"
          >
            <span className="text-[11px] font-medium text-slate-400 pl-1 pr-0.5 hidden sm:inline">
              {lang === 'ja' ? '壁・パネル' : 'Wall'}:
            </span>

            {/* 1) Microcement (#e2e0dc) */}
            <button
              type="button"
              id="wall-finish-microcement"
              onClick={() => setWallFinish('microcement')}
              aria-label={lang === 'ja' ? 'マイクロセメント (暖色系モルタル調)' : 'Microcement (Warm Soft Grey)'}
              title={lang === 'ja' ? 'マイクロセメント (暖色系モルタル調)' : 'Microcement (Warm Soft Grey)'}
              className={`group relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                wallFinish === 'microcement'
                  ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-md'
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#e2e0dc' }}
            >
              <span className="w-full h-full rounded-full border border-slate-400/60" />
            </button>

            {/* 2) Ceramic Subway Tile (#eceae6 with grid icon) */}
            <button
              type="button"
              id="wall-finish-tile"
              onClick={() => setWallFinish('tile')}
              aria-label={lang === 'ja' ? 'サブウェイタイル (白磁器タイル調)' : 'Japanese Ceramic Subway Tile'}
              title={lang === 'ja' ? 'サブウェイタイル (白磁器タイル調)' : 'Japanese Ceramic Subway Tile'}
              className={`group relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                wallFinish === 'tile'
                  ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-md'
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#eceae6' }}
            >
              <Grid className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
            </button>

            {/* 3) Accent Slate (#3b3e42) */}
            <button
              type="button"
              id="wall-finish-slate"
              onClick={() => setWallFinish('accent_slate')}
              aria-label={lang === 'ja' ? 'ディープスレート (濃色高級天然石調)' : 'Deep Architectural Slate'}
              title={lang === 'ja' ? 'ディープスレート (濃色高級天然石調)' : 'Deep Architectural Slate'}
              className={`group relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                wallFinish === 'accent_slate'
                  ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-md'
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#3b3e42' }}
            >
              <span className="w-full h-full rounded-full border border-slate-500/50" />
            </button>
          </div>
        </div>

        {/* Top-Right Quick View Presets, Exploded & Isolation Tools & 2D Blueprint Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
          {/* Exploded View Toggle Button */}
          <button
            type="button"
            id="toggle-exploded-btn"
            onClick={handleToggleExploded}
            aria-pressed={isExploded}
            title={t.ctrl_exploded || "Exploded View"}
            aria-label={t.ctrl_exploded || "Exploded View"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
              isExploded
                ? 'bg-amber-500/25 border-amber-400/70 text-amber-300 shadow-sm'
                : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border-transparent'
            }`}
          >
            <Split className={`w-3.5 h-3.5 ${isExploded ? 'text-amber-400' : 'text-slate-400'}`} aria-hidden="true" />
            <span className="hidden sm:inline font-medium">{t.ctrl_exploded || "Exploded"}</span>
          </button>

          {/* Component Isolation Mode Selector */}
          <div 
            role="group" 
            aria-label="Component Isolation" 
            className="hidden md:flex items-center gap-0.5 bg-slate-950/70 p-0.5 rounded-lg border border-slate-800"
          >
            <button
              type="button"
              id="isolate-view-all"
              onClick={() => handleSetIsolateView('all')}
              title={t.isolate_all || "All Components"}
              aria-pressed={activeIsolateView === 'all'}
              className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all cursor-pointer ${
                activeIsolateView === 'all'
                  ? 'bg-[#00a86b] text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.isolate_all || "All"}
            </button>
            <button
              type="button"
              id="isolate-view-base"
              onClick={() => handleSetIsolateView('base')}
              title={t.isolate_base || "Base Carcass & Drawers"}
              aria-pressed={activeIsolateView === 'base'}
              className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all cursor-pointer ${
                activeIsolateView === 'base'
                  ? 'bg-[#00a86b] text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.isolate_base || "Base"}
            </button>
            <button
              type="button"
              id="isolate-view-counter"
              onClick={() => handleSetIsolateView('counter')}
              title={t.isolate_counter || "Countertop & Equipment"}
              aria-pressed={activeIsolateView === 'counter'}
              className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all cursor-pointer ${
                activeIsolateView === 'counter'
                  ? 'bg-[#00a86b] text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.isolate_counter || "Counter"}
            </button>
            <button
              type="button"
              id="isolate-view-wall"
              onClick={() => handleSetIsolateView('wall')}
              title={t.isolate_wall || "Wall Cabinet & Hood"}
              aria-pressed={activeIsolateView === 'wall'}
              className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all cursor-pointer ${
                activeIsolateView === 'wall'
                  ? 'bg-[#00a86b] text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.isolate_wall || "Wall"}
            </button>
          </div>

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

          {onToggleSidebar && (
            <button
              type="button"
              id="top-focus-toggle-btn"
              onClick={onToggleSidebar}
              title={isSidebarOpen ? "Hide sidebar to inspect 3D kitchen in full view" : "Show sidebar configurator"}
              aria-label={isSidebarOpen ? "Hide sidebar to inspect 3D kitchen in full view" : "Show sidebar configurator"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/80 hover:bg-[#00a86b]/20 hover:border-[#00a86b]/40 rounded-lg border border-transparent transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
            >
              {isSidebarOpen ? (
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              )}
              <span className="hidden sm:inline font-semibold">
                {isSidebarOpen ? (lang === 'ja' ? '集中モード' : 'Focus Mode') : (lang === 'ja' ? '設定を表示' : 'Expand 3D')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Exploded Factor Slider when Exploded View is active */}
      {isExploded && (
        <div className="absolute top-16 right-4 z-20 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-2xl flex items-center gap-3">
          <Split className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span>{t.ctrl_exploded || 'Exploded Separation'}</span>
              <span className="text-amber-400 font-semibold">{Math.round(explodedFactor * 100)}%</span>
            </div>
            <input
              type="range"
              id="exploded-factor-slider"
              min="0"
              max="1"
              step="0.01"
              value={explodedFactor}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setExplodedFactor(val);
                targetExplodedFactorRef.current = val;
                markInteraction();
              }}
              className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              aria-label={t.ctrl_exploded_slider || 'Exploded view separation slider'}
            />
          </div>
        </div>
      )}

      {/* Sleek Floating Glassmorphism Focus Toggle Button Anchored at Right Edge of Viewport */}
      {onToggleSidebar && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
          <button
            type="button"
            id="floating-focus-mode-btn"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Hide sidebar to inspect 3D kitchen in full view" : "Show sidebar configurator"}
            aria-label={isSidebarOpen ? "Hide sidebar to inspect 3D kitchen in full view" : "Show sidebar configurator"}
            className="group flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800/95 active:scale-95 backdrop-blur-md border border-slate-700/80 hover:border-emerald-500/60 shadow-2xl text-slate-200 hover:text-white transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
          >
            {isSidebarOpen ? (
              <Maximize2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" aria-hidden="true" />
            ) : (
              <Minimize2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold tracking-wide">
              {isSidebarOpen ? "Focus Mode" : "Expand 3D"}
            </span>
          </button>
        </div>
      )}

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
