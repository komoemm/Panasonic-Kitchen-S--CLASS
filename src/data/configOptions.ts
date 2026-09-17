import { 
  PlanLayoutOption, 
  PlanDetailOption, 
  FloorUnitOption, 
  UpgradeOption, 
  CabinetFinishOption 
} from '../types';

export const PLAN_LAYOUTS: PlanLayoutOption[] = [
  {
    id: 'type-i',
    nameKey: 'layout_type_i_name',
    subNameKey: 'layout_type_i_sub',
    descriptionKey: 'layout_type_i_desc',
    basePrice: 850000,
    dimensions: 'W2550 × D650 × H850 mm',
    badge: 'Popular',
  },
  {
    id: 'type-l',
    nameKey: 'layout_type_l_name',
    subNameKey: 'layout_type_l_sub',
    descriptionKey: 'layout_type_l_desc',
    basePrice: 1150000,
    dimensions: 'W2550 × D1800 × H850 mm',
  },
  {
    id: 'face-to-face',
    nameKey: 'layout_face_to_face_name',
    subNameKey: 'layout_face_to_face_sub',
    descriptionKey: 'layout_face_to_face_desc',
    basePrice: 1280000,
    dimensions: 'W2550 × D933 × H850 mm',
    badge: 'Open Living',
  },
  {
    id: 'type-ii',
    nameKey: 'layout_type_ii_name',
    subNameKey: 'layout_type_ii_sub',
    descriptionKey: 'layout_type_ii_desc',
    basePrice: 1350000,
    dimensions: 'W2550 + W1800 × D650 mm',
  },
  {
    id: 'island',
    nameKey: 'layout_island_name',
    subNameKey: 'layout_island_sub',
    descriptionKey: 'layout_island_desc',
    basePrice: 1480000,
    dimensions: 'W2550 × D933 × H850 mm',
    badge: 'Flagship',
  },
];

export const PLAN_DETAILS: PlanDetailOption[] = [
  {
    id: 'type-i-standard',
    nameKey: 'detail_standard_name',
    descriptionKey: 'detail_standard_desc',
    hasFloorCabinet: true,
    hasWallCabinet: true,
    hasRangeHood: true,
    hoodPosition: 'side',
  },
  {
    id: 'type-i-floor-hood',
    nameKey: 'detail_floor_hood_name',
    descriptionKey: 'detail_floor_hood_desc',
    hasFloorCabinet: true,
    hasWallCabinet: false,
    hasRangeHood: true,
    hoodPosition: 'side',
  },
  {
    id: 'type-i-side-hood',
    nameKey: 'detail_side_hood_name',
    descriptionKey: 'detail_side_hood_desc',
    hasFloorCabinet: true,
    hasWallCabinet: true,
    hasRangeHood: true,
    hoodPosition: 'side',
  },
  {
    id: 'type-i-center-hood',
    nameKey: 'detail_center_hood_name',
    descriptionKey: 'detail_center_hood_desc',
    hasFloorCabinet: true,
    hasWallCabinet: false,
    hasRangeHood: true,
    hoodPosition: 'center',
  },
  {
    id: 'type-i-floor-only',
    nameKey: 'detail_floor_only_name',
    descriptionKey: 'detail_floor_only_desc',
    hasFloorCabinet: true,
    hasWallCabinet: false,
    hasRangeHood: false,
    hoodPosition: 'none',
  },
  {
    id: 'type-i-wall-only',
    nameKey: 'detail_wall_only_name',
    descriptionKey: 'detail_wall_only_desc',
    hasFloorCabinet: false,
    hasWallCabinet: true,
    hasRangeHood: false,
    hoodPosition: 'none',
  },
];

export const FLOOR_UNITS: FloorUnitOption[] = [
  {
    id: 'high-storage',
    nameKey: 'floor_high_storage_name',
    descriptionKey: 'floor_high_storage_desc',
    priceDelta: 0,
    badge: 'Standard',
  },
  {
    id: 'front-dishwasher',
    nameKey: 'floor_dishwasher_name',
    descriptionKey: 'floor_dishwasher_desc',
    priceDelta: 180000,
    badge: '+¥180,000',
  },
];

export const UPGRADES: UpgradeOption[] = [
  {
    id: 'sugoPikaSink',
    nameKey: 'upgrade_sugo_pika_name',
    descriptionKey: 'upgrade_sugo_pika_desc',
    priceDelta: 45000,
    iconName: 'Droplets',
    category: 'sink',
  },
  {
    id: 'tripleWideIH',
    nameKey: 'upgrade_triple_ih_name',
    descriptionKey: 'upgrade_triple_ih_desc',
    priceDelta: 75000,
    iconName: 'Flame',
    category: 'cooktop',
  },
  {
    id: 'autoCleanHood',
    nameKey: 'upgrade_auto_hood_name',
    descriptionKey: 'upgrade_auto_hood_desc',
    priceDelta: 60000,
    iconName: 'Fan',
    category: 'hood',
  },
  {
    id: 'slimSensorFaucet',
    nameKey: 'upgrade_sensor_faucet_name',
    descriptionKey: 'upgrade_sensor_faucet_desc',
    priceDelta: 35000,
    iconName: 'Sparkles',
    category: 'faucet',
  },
];

export const CABINET_FINISHES: CabinetFinishOption[] = [
  {
    id: 'charcoal-slate',
    nameKey: 'finish_slate_name',
    colorHex: '#222426',
    roughness: 0.68,
    metalness: 0.05,
    priceDelta: 45000,
  },
  {
    id: 'oak-wood',
    nameKey: 'finish_oak_name',
    colorHex: '#d2ab79',
    roughness: 0.60,
    metalness: 0.0,
    priceDelta: 30000,
  },
  {
    id: 'white-w',
    nameKey: 'finish_white_name',
    colorHex: '#f6f6f8',
    roughness: 0.32,
    metalness: 0.02,
    priceDelta: 0,
  },
];
