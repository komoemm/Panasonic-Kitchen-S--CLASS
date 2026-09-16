import { KitchenConfig, PriceCalculation, PriceSummaryItem, Language } from '../types';
import { PLAN_LAYOUTS, FLOOR_UNITS, UPGRADES, CABINET_FINISHES } from '../data/configOptions';
import { TRANSLATIONS } from '../i18n/translations';

export function calculateKitchenPrice(config: KitchenConfig, lang: Language): PriceCalculation {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ja;
  const items: PriceSummaryItem[] = [];

  // 1. Base Plan Layout
  const layout = PLAN_LAYOUTS.find((l) => l.id === config.layout) || PLAN_LAYOUTS[0];
  const basePrice = layout.basePrice;
  items.push({
    id: 'base-layout',
    categoryKey: 'step_1_title',
    name: t[layout.nameKey] || layout.id,
    detail: `${layout.dimensions} (${t[layout.subNameKey] || ''})`,
    price: basePrice,
  });

  // 2. Plan Type Cost (if not Type I standard default)
  let planTypeCost = 0;
  if (config.detail !== 'type-i-standard') {
    if (config.planType === 'premium-s') {
      planTypeCost = 50000;
      items.push({
        id: 'plan-type',
        categoryKey: 'step_3_title',
        name: t.plan_premium_name,
        detail: t.plan_premium_desc,
        price: planTypeCost,
      });
    } else {
      items.push({
        id: 'plan-type',
        categoryKey: 'step_3_title',
        name: t.plan_standard_name,
        detail: t.plan_standard_desc,
        price: 0,
      });
    }
  } else {
    items.push({
      id: 'plan-type',
      categoryKey: 'step_3_title',
      name: t.plan_standard_locked_title,
      detail: t.plan_standard_locked_desc,
      price: 0,
    });
  }

  // 3. Floor Unit Type
  const floorUnit = FLOOR_UNITS.find((f) => f.id === config.floorUnit) || FLOOR_UNITS[0];
  const floorUnitCost = floorUnit.priceDelta;
  items.push({
    id: 'floor-unit',
    categoryKey: 'step_4_title',
    name: t[floorUnit.nameKey] || floorUnit.id,
    detail: t[floorUnit.descriptionKey] || '',
    price: floorUnitCost,
  });

  // 4. Upgrades
  let upgradesCost = 0;
  UPGRADES.forEach((upg) => {
    if (config.upgrades[upg.id]) {
      upgradesCost += upg.priceDelta;
      items.push({
        id: `upgrade-${upg.id}`,
        categoryKey: 'step_5_title',
        name: t[upg.nameKey] || upg.id,
        detail: t[upg.descriptionKey] || '',
        price: upg.priceDelta,
      });
    }
  });

  // 5. Cabinet Door Finish
  const finish = CABINET_FINISHES.find((f) => f.id === config.cabinetFinish) || CABINET_FINISHES[0];
  const finishCost = finish.priceDelta;
  items.push({
    id: 'cabinet-finish',
    categoryKey: 'cabinet_finish_title',
    name: t[finish.nameKey] || finish.id,
    detail: finish.id.toUpperCase(),
    price: finishCost,
  });

  // 6. Sink Handedness Layout detail
  const sinkName = config.sinkLocation === 'left' ? t.sink_left_name : t.sink_right_name;
  const sinkDesc = config.sinkLocation === 'left' ? t.sink_left_desc : t.sink_right_desc;
  items.push({
    id: 'sink-handedness',
    categoryKey: 'step_6_title',
    name: sinkName,
    detail: sinkDesc,
    price: 0,
  });

  const subtotal = basePrice + planTypeCost + floorUnitCost + upgradesCost + finishCost;
  const tax = Math.round(subtotal * 0.10);
  const grandTotal = subtotal + tax;

  return {
    basePrice,
    floorUnitCost,
    upgradesCost,
    finishCost,
    planTypeCost,
    subtotal,
    tax,
    grandTotal,
    items,
  };
}

export function formatYen(amount: number): string {
  return '¥' + amount.toLocaleString('ja-JP');
}
