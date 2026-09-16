export type Language = 'ja' | 'en' | 'mm';

export type PlanLayoutId = 'type-i' | 'type-l' | 'face-to-face' | 'type-ii' | 'island';

export interface PlanLayoutOption {
  id: PlanLayoutId;
  nameKey: string;
  subNameKey: string;
  descriptionKey: string;
  basePrice: number;
  dimensions: string;
  badge?: string;
}

export type PlanDetailId = 
  | 'type-i-standard'
  | 'type-i-floor-hood'
  | 'type-i-side-hood'
  | 'type-i-center-hood'
  | 'type-i-floor-only'
  | 'type-i-wall-only';

export interface PlanDetailOption {
  id: PlanDetailId;
  nameKey: string;
  descriptionKey: string;
  hasFloorCabinet: boolean;
  hasWallCabinet: boolean;
  hasRangeHood: boolean;
  hoodPosition: 'center' | 'side' | 'none';
}

export type PlanTypeId = 'standard-s' | 'premium-s' | 'standard-default-locked';

export interface PlanTypeOption {
  id: PlanTypeId;
  nameKey: string;
  descriptionKey: string;
  priceDelta: number;
}

export type FloorUnitId = 'high-storage' | 'front-dishwasher';

export interface FloorUnitOption {
  id: FloorUnitId;
  nameKey: string;
  descriptionKey: string;
  priceDelta: number;
  badge?: string;
}

export type UpgradeKey = 'sugoPikaSink' | 'tripleWideIH' | 'autoCleanHood' | 'slimSensorFaucet';

export interface UpgradeOption {
  id: UpgradeKey;
  nameKey: string;
  descriptionKey: string;
  priceDelta: number;
  iconName: string;
  category: 'sink' | 'cooktop' | 'hood' | 'faucet';
}

export type SinkLocation = 'left' | 'right';

export type CabinetFinishId = 'white-w' | 'oak-wood' | 'charcoal-slate';

export interface CabinetFinishOption {
  id: CabinetFinishId;
  nameKey: string;
  colorHex: string;
  roughness: number;
  metalness: number;
  priceDelta: number;
}

export interface KitchenConfig {
  layout: PlanLayoutId;
  detail: PlanDetailId;
  planType: PlanTypeId;
  floorUnit: FloorUnitId;
  upgrades: Record<UpgradeKey, boolean>;
  sinkLocation: SinkLocation;
  cabinetFinish: CabinetFinishId;
}

export interface PriceSummaryItem {
  id: string;
  categoryKey: string;
  name: string;
  detail?: string;
  price: number;
}

export interface PriceCalculation {
  basePrice: number;
  floorUnitCost: number;
  upgradesCost: number;
  finishCost: number;
  planTypeCost: number;
  subtotal: number;
  tax: number;
  grandTotal: number;
  items: PriceSummaryItem[];
}

export type CameraPresetId = 'perspective' | 'front' | 'top' | 'sink' | 'cooktop';
