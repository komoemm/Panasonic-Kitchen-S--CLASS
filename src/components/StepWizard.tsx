import React from 'react';
import { 
  KitchenConfig, 
  Language, 
  PlanLayoutId, 
  PlanDetailId, 
  PlanTypeId, 
  FloorUnitId, 
  UpgradeKey, 
  SinkLocation, 
  CabinetFinishId,
  PriceCalculation
} from '../types';
import { 
  PLAN_LAYOUTS, 
  PLAN_DETAILS, 
  FLOOR_UNITS, 
  UPGRADES, 
  CABINET_FINISHES 
} from '../data/configOptions';
import { TRANSLATIONS } from '../i18n/translations';
import { formatYen } from '../utils/pricing';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  Droplets, 
  Flame, 
  Fan, 
  Sparkles, 
  Layers, 
  ArrowLeftRight, 
  Printer, 
  Copy, 
  CheckCircle2,
  FileText
} from 'lucide-react';

interface StepWizardProps {
  currentStep: number;
  onSetStep: (step: number) => void;
  config: KitchenConfig;
  onChangeConfig: (newConfig: KitchenConfig) => void;
  priceCalc: PriceCalculation;
  lang: Language;
  onOpenQuotationModal: () => void;
}

export const StepWizard: React.FC<StepWizardProps> = ({
  currentStep,
  onSetStep,
  config,
  onChangeConfig,
  priceCalc,
  lang,
  onOpenQuotationModal,
}) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ja;

  const stepTitles = [
    t.step_1_title,
    t.step_2_title,
    t.step_3_title,
    t.step_4_title,
    t.step_5_title,
    t.step_6_title,
    t.step_7_title,
  ];

  const handleSelectLayout = (layoutId: PlanLayoutId) => {
    onChangeConfig({
      ...config,
      layout: layoutId,
    });
  };

  const handleSelectDetail = (detailId: PlanDetailId) => {
    // If selecting Type I standard, lock planType to standard-default-locked
    let newPlanType = config.planType;
    if (detailId === 'type-i-standard') {
      newPlanType = 'standard-default-locked';
    } else if (newPlanType === 'standard-default-locked') {
      newPlanType = 'standard-s';
    }

    onChangeConfig({
      ...config,
      detail: detailId,
      planType: newPlanType,
    });
  };

  const handleSelectPlanType = (typeId: PlanTypeId) => {
    if (config.detail === 'type-i-standard') return; // Locked
    onChangeConfig({
      ...config,
      planType: typeId,
    });
  };

  const handleSelectFloorUnit = (unitId: FloorUnitId) => {
    onChangeConfig({
      ...config,
      floorUnit: unitId,
    });
  };

  const handleToggleUpgrade = (upgradeKey: UpgradeKey) => {
    onChangeConfig({
      ...config,
      upgrades: {
        ...config.upgrades,
        [upgradeKey]: !config.upgrades[upgradeKey],
      },
    });
  };

  const handleSelectSinkLocation = (loc: SinkLocation) => {
    onChangeConfig({
      ...config,
      sinkLocation: loc,
    });
  };

  const handleSelectCabinetFinish = (finishId: CabinetFinishId) => {
    onChangeConfig({
      ...config,
      cabinetFinish: finishId,
    });
  };

  // Helper icons for upgrades
  const getUpgradeIcon = (id: UpgradeKey) => {
    switch (id) {
      case 'sugoPikaSink':
        return <Droplets className="w-5 h-5 text-cyan-400" />;
      case 'tripleWideIH':
        return <Flame className="w-5 h-5 text-red-400" />;
      case 'autoCleanHood':
        return <Fan className="w-5 h-5 text-emerald-400" />;
      case 'slimSensorFaucet':
        return <Sparkles className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-700/60 overflow-hidden shadow-2xl">
      {/* Step Progress Tracker Bar */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            {t.step_indicator} {currentStep} {t.of} 7
          </span>
          <span className="text-xs font-medium text-slate-400">
            {stepTitles[currentStep - 1]}
          </span>
        </div>

        {/* 7-Step Pill Progress Indicators */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <button
              key={s}
              id={`wizard-step-pill-${s}`}
              onClick={() => onSetStep(s)}
              className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${
                s === currentStep
                  ? 'bg-gradient-to-r from-emerald-500 to-[#00a86b] shadow-md shadow-emerald-500/30'
                  : s < currentStep
                  ? 'bg-emerald-600/60 hover:bg-emerald-500'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title={`Step ${s}: ${stepTitles[s - 1]}`}
            />
          ))}
        </div>
      </div>

      {/* Step Content Area with Smooth Scroll */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        {/* STEP 1: PLAN LAYOUT SELECTION */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
                  1
                </span>
                {t.step_1_title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.step_1_desc}</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {PLAN_LAYOUTS.map((layout) => {
                const isSelected = config.layout === layout.id;
                return (
                  <button
                    key={layout.id}
                    id={`layout-option-${layout.id}`}
                    onClick={() => handleSelectLayout(layout.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                        : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-100">
                            {t[layout.nameKey] || layout.id}
                          </span>
                          {layout.badge && (
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {layout.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-400/90 font-medium mt-0.5">
                          {t[layout.subNameKey]}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-sm font-bold text-white">
                          {formatYen(layout.basePrice)}
                        </span>
                        <span className="text-[10px] text-slate-500">(税抜)</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                      {t[layout.descriptionKey]}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{layout.dimensions}</span>
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <Check className="w-3.5 h-3.5" /> 選択中
                        </span>
                      ) : (
                        <span className="text-slate-500">選択する</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: PLAN LAYOUT DETAIL SELECTION */}
        {currentStep === 2 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
                  2
                </span>
                {t.step_2_title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.step_2_desc}</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {PLAN_DETAILS.map((detail) => {
                const isSelected = config.detail === detail.id;
                return (
                  <button
                    key={detail.id}
                    id={`detail-option-${detail.id}`}
                    onClick={() => handleSelectDetail(detail.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                        : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100">
                        {t[detail.nameKey] || detail.id}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                          <Check className="w-4 h-4" /> 選択中
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {t[detail.descriptionKey]}
                    </p>

                    {/* Component configuration badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          detail.hasFloorCabinet
                            ? 'bg-slate-800 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        フロアキャビネット
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          detail.hasWallCabinet
                            ? 'bg-slate-800 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        ウォールキャビネット (吊戸棚)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          detail.hasRangeHood
                            ? 'bg-slate-800 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        レンジフード
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: PLAN TYPE SELECTION */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
                  3
                </span>
                {t.step_3_title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.step_3_desc}</p>
            </div>

            {/* Condition: If Type I Standard: Locked warning notice */}
            {config.detail === 'type-i-standard' ? (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex items-start gap-3 shadow-lg">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-300">
                    {t.plan_standard_locked_title}
                  </h3>
                  <p className="text-xs text-amber-200/80 mt-1">
                    {t.plan_standard_locked_desc}
                  </p>
                  <p className="text-[11px] text-amber-300/70 mt-2 font-mono">
                    Type I Standard Package (+¥0) Default Locked
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 pt-1">
                {/* Standard S-Class */}
                <button
                  id="plan-type-standard"
                  onClick={() => handleSelectPlanType('standard-s')}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    config.planType === 'standard-s'
                      ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                      : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100">
                      {t.plan_standard_name}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">+¥0</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {t.plan_standard_desc}
                  </p>
                </button>

                {/* Premium S-Class */}
                <button
                  id="plan-type-premium"
                  onClick={() => handleSelectPlanType('premium-s')}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    config.planType === 'premium-s'
                      ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                      : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100">
                      {t.plan_premium_name}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      +¥50,000
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {t.plan_premium_desc}
                  </p>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: FLOOR UNIT TYPE SELECTION */}
        {currentStep === 4 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
                  4
                </span>
                {t.step_4_title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.step_4_desc}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {FLOOR_UNITS.map((unit) => {
                const isSelected = config.floorUnit === unit.id;
                return (
                  <button
                    key={unit.id}
                    id={`floor-unit-${unit.id}`}
                    onClick={() => handleSelectFloorUnit(unit.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                        : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100">
                        {t[unit.nameKey] || unit.id}
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        {unit.priceDelta === 0 ? '+¥0' : `+¥${unit.priceDelta.toLocaleString('ja-JP')}`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1.5">
                      {t[unit.descriptionKey]}
                    </p>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {unit.id === 'front-dishwasher' 
                          ? '3D: フロントオープン食洗機パネル表示' 
                          : '3D: スライド引き出しハンドル表示'}
                      </span>
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <Check className="w-3.5 h-3.5" /> 選択中
                        </span>
                      ) : (
                        <span className="text-slate-500">選択する</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: UNIT SPECIFICATIONS & UPGRADES */}
        {currentStep === 5 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
                  5
                </span>
                {t.step_5_title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.step_5_desc}</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {UPGRADES.map((upgrade) => {
                const isChecked = !!config.upgrades[upgrade.id];
                return (
                  <div
                    key={upgrade.id}
                    id={`upgrade-item-${upgrade.id}`}
                    onClick={() => handleToggleUpgrade(upgrade.id)}
                    className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/40'
                        : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Checkbox box */}
                    <div
                      className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isChecked
                          ? 'bg-[#00a86b] border-[#00a86b] text-white shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getUpgradeIcon(upgrade.id)}
                          <span className="font-bold text-sm text-slate-100">
                            {t[upgrade.nameKey] || upgrade.id}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-400 shrink-0">
                          +¥{upgrade.priceDelta.toLocaleString('ja-JP')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {t[upgrade.descriptionKey]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 6: SINK LOCATION & HANDEDNESS (+ CABINET FINISH) */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
                  6
                </span>
                {t.step_6_title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.step_6_desc}</p>
            </div>

            {/* Handedness Switcher Cards (Left vs Right with 3D coordinate mirroring) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Left-Handed Sink */}
              <button
                id="sink-loc-left"
                onClick={() => handleSelectSinkLocation('left')}
                className={`text-left p-4 rounded-xl border transition-all relative ${
                  config.sinkLocation === 'left'
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                    : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-100">
                    {t.sink_left_name}
                  </span>
                  {config.sinkLocation === 'left' && (
                    <span className="p-1 rounded-full bg-emerald-500 text-white">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div className="w-full h-12 bg-slate-950 rounded-lg p-2 flex items-center justify-between text-xs text-slate-400 border border-slate-800 font-mono mb-2">
                  <span className="px-2 py-1 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                    シンク (X: -0.75m)
                  </span>
                  <ArrowLeftRight className="w-4 h-4 text-slate-600" />
                  <span className="px-2 py-1 rounded bg-red-950/80 text-red-300 border border-red-800">
                    IH (X: +0.75m)
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {t.sink_left_desc}
                </p>
              </button>

              {/* Right-Handed Sink */}
              <button
                id="sink-loc-right"
                onClick={() => handleSelectSinkLocation('right')}
                className={`text-left p-4 rounded-xl border transition-all relative ${
                  config.sinkLocation === 'right'
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                    : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-100">
                    {t.sink_right_name}
                  </span>
                  {config.sinkLocation === 'right' && (
                    <span className="p-1 rounded-full bg-emerald-500 text-white">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <div className="w-full h-12 bg-slate-950 rounded-lg p-2 flex items-center justify-between text-xs text-slate-400 border border-slate-800 font-mono mb-2">
                  <span className="px-2 py-1 rounded bg-red-950/80 text-red-300 border border-red-800">
                    IH (X: -0.75m)
                  </span>
                  <ArrowLeftRight className="w-4 h-4 text-slate-600" />
                  <span className="px-2 py-1 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                    シンク (X: +0.75m)
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {t.sink_right_desc}
                </p>
              </button>
            </div>

            {/* Cabinet Door Finish Swatches */}
            <div className="pt-2 border-t border-slate-800">
              <h3 className="text-sm font-bold text-slate-200 mb-2">
                {t.cabinet_finish_title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {CABINET_FINISHES.map((finish) => {
                  const isSelected = config.cabinetFinish === finish.id;
                  return (
                    <button
                      key={finish.id}
                      id={`finish-${finish.id}`}
                      onClick={() => handleSelectCabinetFinish(finish.id)}
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                          : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full border border-white/20 shadow-inner shrink-0"
                        style={{ backgroundColor: finish.colorHex }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200 truncate">
                          {t[finish.nameKey] || finish.id}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-semibold">
                          {finish.priceDelta === 0 ? '+¥0' : `+¥${finish.priceDelta.toLocaleString('ja-JP')}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: LIVE QUOTATION SUMMARY & PRICE CALCULATOR */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40">
                  7
                </span>
                {t.step_7_title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.step_7_desc}</p>
            </div>

            {/* Grand Total Hero Display Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-emerald-500/40 shadow-xl">
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                {t.quote_grand_total}
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">
                {formatYen(priceCalc.grandTotal)}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                <span>{t.quote_subtotal}: {formatYen(priceCalc.subtotal)}</span>
                <span>{t.quote_tax}: {formatYen(priceCalc.tax)}</span>
              </div>
            </div>

            {/* Itemized Table Breakdown */}
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-medium">
                  <tr>
                    <th className="p-3">{t.quote_item}</th>
                    <th className="p-3 text-right">{t.quote_price}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {priceCalc.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/40">
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{item.name}</div>
                        {item.detail && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.detail}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {item.price === 0 ? '込 / +¥0' : formatYen(item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons for Step 7: Open Full Detailed Quotation / Print */}
            <div className="pt-2">
              <button
                id="view-full-quote-btn"
                onClick={onOpenQuotationModal}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-[#00a86b] hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-950 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{t.view_quotation_btn}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Step Navigation Footer */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
        {/* Previous Button */}
        <button
          id="wizard-prev-btn"
          disabled={currentStep === 1}
          onClick={() => onSetStep(Math.max(1, currentStep - 1))}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            currentStep === 1
              ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-850'
              : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t.btn_prev}</span>
        </button>

        {/* Live Running Total in Footer */}
        <div className="text-center hidden sm:block">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{t.live_subtotal}</div>
          <div className="text-sm font-bold text-emerald-400">{formatYen(priceCalc.grandTotal)}</div>
        </div>

        {/* Next / Finish Button */}
        {currentStep < 7 ? (
          <button
            id="wizard-next-btn"
            onClick={() => onSetStep(currentStep + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-[#00a86b] hover:from-emerald-500 hover:to-emerald-400 shadow-md shadow-emerald-950 transition-all cursor-pointer"
          >
            <span>{t.btn_next}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            id="wizard-finish-btn"
            onClick={onOpenQuotationModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-950 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{t.btn_finish}</span>
          </button>
        )}
      </div>
    </div>
  );
};
