import React, { useState, useCallback, useRef } from 'react';
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
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const announcementTimeoutRef = useRef<number | null>(null);

  const announce = useCallback((msg: string) => {
    if (announcementTimeoutRef.current) {
      window.clearTimeout(announcementTimeoutRef.current);
    }
    // Briefly clear to re-trigger assistive tech if message is identical
    setLiveAnnouncement('');
    announcementTimeoutRef.current = window.setTimeout(() => {
      setLiveAnnouncement(msg);
    }, 50);
  }, []);

  const stepTitles = [
    t.step_1_title,
    t.step_2_title,
    t.step_3_title,
    t.step_4_title,
    t.step_5_title,
    t.step_6_title,
    t.step_7_title,
  ];

  const handleStepChange = (step: number) => {
    onSetStep(step);
    const stepName = stepTitles[step - 1];
    announce(
      lang === 'ja'
        ? `ステップ ${step}：${stepName} を表示しました。`
        : lang === 'mm'
        ? `အဆင့် ${step}：${stepName} ကို ပြသနေပါသည်။`
        : `Navigated to Step ${step}: ${stepName}.`
    );
  };

  const handleSelectLayout = (layoutId: PlanLayoutId) => {
    const layout = PLAN_LAYOUTS.find((l) => l.id === layoutId);
    onChangeConfig({
      ...config,
      layout: layoutId,
    });
    const layoutName = layout ? t[layout.nameKey] : layoutId;
    announce(
      lang === 'ja'
        ? `プランレイアウトを「${layoutName}」に変更しました。基本価格: ${formatYen(layout?.basePrice || 0)}`
        : lang === 'mm'
        ? `အပြင်အဆင်ကို ${layoutName} သို့ ပြောင်းလဲခဲ့သည်။`
        : `Selected layout ${layoutName}. Base price: ${formatYen(layout?.basePrice || 0)}`
    );
  };

  const handleSelectDetail = (detailId: PlanDetailId) => {
    let newPlanType = config.planType;
    if (detailId === 'type-i-standard') {
      newPlanType = 'standard-default-locked';
    } else if (newPlanType === 'standard-default-locked') {
      newPlanType = 'standard-s';
    }

    const detail = PLAN_DETAILS.find((d) => d.id === detailId);
    onChangeConfig({
      ...config,
      detail: detailId,
      planType: newPlanType,
    });
    const detailName = detail ? t[detail.nameKey] : detailId;
    announce(
      lang === 'ja'
        ? `プラン詳細を「${detailName}」に変更しました。`
        : lang === 'mm'
        ? `အသေးစိတ်အစီအစဉ်ကို ${detailName} သို့ ပြောင်းလဲခဲ့သည်။`
        : `Selected plan detail: ${detailName}.`
    );
  };

  const handleSelectPlanType = (typeId: PlanTypeId) => {
    if (config.detail === 'type-i-standard') return; // Locked
    onChangeConfig({
      ...config,
      planType: typeId,
    });
    const typeName = typeId === 'premium-s' ? t.plan_premium_name : t.plan_standard_name;
    announce(
      lang === 'ja'
        ? `プランタイプを「${typeName}」に変更しました。`
        : lang === 'mm'
        ? `အမျိုးအစားကို ${typeName} သို့ ပြောင်းလဲခဲ့သည်။`
        : `Selected plan grade: ${typeName}.`
    );
  };

  const handleSelectFloorUnit = (unitId: FloorUnitId) => {
    const unit = FLOOR_UNITS.find((u) => u.id === unitId);
    onChangeConfig({
      ...config,
      floorUnit: unitId,
    });
    const unitName = unit ? t[unit.nameKey] : unitId;
    announce(
      lang === 'ja'
        ? `フロアユニットを「${unitName}」に変更しました。`
        : lang === 'mm'
        ? `ကြမ်းပြင်ယူနစ်ကို ${unitName} သို့ ပြောင်းလဲခဲ့သည်။`
        : `Selected floor unit: ${unitName}.`
    );
  };

  const handleToggleUpgrade = (upgradeKey: UpgradeKey) => {
    const willBeChecked = !config.upgrades[upgradeKey];
    onChangeConfig({
      ...config,
      upgrades: {
        ...config.upgrades,
        [upgradeKey]: willBeChecked,
      },
    });
    const upgrade = UPGRADES.find((u) => u.id === upgradeKey);
    const upgradeName = upgrade ? t[upgrade.nameKey] : upgradeKey;
    announce(
      lang === 'ja'
        ? `「${upgradeName}」を${willBeChecked ? '追加' : '解除'}しました。`
        : lang === 'mm'
        ? `${upgradeName} ကို ${willBeChecked ? 'ထည့်သွင်း' : 'ဖယ်ရှား'}ခဲ့သည်။`
        : `${willBeChecked ? 'Added' : 'Removed'} ${upgradeName}.`
    );
  };

  const handleSelectSinkLocation = (loc: SinkLocation) => {
    onChangeConfig({
      ...config,
      sinkLocation: loc,
    });
    const locName = loc === 'left' ? t.sink_left_name : t.sink_right_name;
    announce(
      lang === 'ja'
        ? `シンク位置を「${locName}」に変更しました。3DモデルのシンクとIHの位置が反転しました。`
        : lang === 'mm'
        ? `ဘေစင်နေရာကို ${locName} သို့ ပြောင်းလဲခဲ့သည်။`
        : `Sink location set to ${locName}. The 3D model positions have mirrored.`
    );
  };

  const handleSelectCabinetFinish = (finishId: CabinetFinishId) => {
    const finish = CABINET_FINISHES.find((f) => f.id === finishId);
    onChangeConfig({
      ...config,
      cabinetFinish: finishId,
    });
    const finishName = finish ? t[finish.nameKey] : finishId;
    announce(
      lang === 'ja'
        ? `扉カラーを「${finishName}」に変更しました。`
        : lang === 'mm'
        ? `တံခါးအရောင်ကို ${finishName} သို့ ပြောင်းလဲခဲ့သည်။`
        : `Cabinet finish updated to ${finishName}.`
    );
  };

  // Keyboard navigation helper for radio lists
  const handleRadioKeyDown = <T extends string>(
    e: React.KeyboardEvent,
    ids: T[],
    currentId: T,
    onSelect: (id: T) => void,
    idPrefix: string
  ) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const currentIndex = ids.indexOf(currentId);
      const nextIndex = (currentIndex + 1) % ids.length;
      const nextId = ids[nextIndex];
      onSelect(nextId);
      const el = document.getElementById(`${idPrefix}${nextId}`);
      el?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const currentIndex = ids.indexOf(currentId);
      const prevIndex = (currentIndex - 1 + ids.length) % ids.length;
      const prevId = ids[prevIndex];
      onSelect(prevId);
      const el = document.getElementById(`${idPrefix}${prevId}`);
      el?.focus();
    }
  };

  // Keyboard navigation helper for step pills
  const handleStepPillKeyDown = (e: React.KeyboardEvent, stepNum: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextStep = Math.min(7, stepNum + 1);
      handleStepChange(nextStep);
      const nextBtn = document.getElementById(`wizard-step-pill-${nextStep}`);
      nextBtn?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevStep = Math.max(1, stepNum - 1);
      handleStepChange(prevStep);
      const prevBtn = document.getElementById(`wizard-step-pill-${prevStep}`);
      prevBtn?.focus();
    }
  };

  // Helper icons for upgrades
  const getUpgradeIcon = (id: UpgradeKey) => {
    switch (id) {
      case 'sugoPikaSink':
        return <Droplets className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />;
      case 'tripleWideIH':
        return <Flame className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />;
      case 'autoCleanHood':
        return <Fan className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />;
      case 'slimSensorFaucet':
        return <Sparkles className="w-5 h-5 text-blue-400 shrink-0" aria-hidden="true" />;
    }
  };

  return (
    <section 
      aria-labelledby="step-wizard-heading" 
      className="flex flex-col h-full glass-panel rounded-2xl border border-slate-700/60 overflow-hidden shadow-2xl"
    >
      {/* Visually Hidden Screen Reader Main Heading */}
      <h2 id="step-wizard-heading" className="sr-only">
        {t.step_indicator} {currentStep} {t.of} 7: {stepTitles[currentStep - 1]}
      </h2>

      {/* Screen Reader Live Announcement Region */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Step Progress Tracker Nav Bar */}
      <nav 
        aria-label={lang === 'ja' ? 'ステップ進行度ナビゲーション' : 'Step progress navigation'} 
        className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            {t.step_indicator} {currentStep} {t.of} 7
          </span>
          <span className="text-xs font-medium text-slate-400" aria-hidden="true">
            {stepTitles[currentStep - 1]}
          </span>
        </div>

        {/* 7-Step Pill Progress Indicators */}
        <ol role="list" className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => {
            const isCurrent = s === currentStep;
            return (
              <li key={s} className="w-full">
                <button
                  type="button"
                  id={`wizard-step-pill-${s}`}
                  onClick={() => handleStepChange(s)}
                  onKeyDown={(e) => handleStepPillKeyDown(e, s)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${s}: ${stepTitles[s - 1]}`}
                  className={`w-full h-2.5 sm:h-3 rounded-full transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                    isCurrent
                      ? 'bg-gradient-to-r from-emerald-500 to-[#00a86b] shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400'
                      : s < currentStep
                      ? 'bg-emerald-600/60 hover:bg-emerald-500'
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                  title={`Step ${s}: ${stepTitles[s - 1]}`}
                />
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step Content Area with Smooth Scroll */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        {/* STEP 1: PLAN LAYOUT SELECTION */}
        {currentStep === 1 && (
          <fieldset className="space-y-3 border-0 p-0 m-0">
            <legend className="w-full mb-1">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40" aria-hidden="true">
                  1
                </span>
                {t.step_1_title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{t.step_1_desc}</p>
            </legend>

            <div 
              role="radiogroup" 
              aria-label={t.step_1_title} 
              className="grid grid-cols-1 gap-2.5 pt-1"
            >
              {PLAN_LAYOUTS.map((layout) => {
                const isSelected = config.layout === layout.id;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    key={layout.id}
                    id={`layout-option-${layout.id}`}
                    onClick={() => handleSelectLayout(layout.id)}
                    onKeyDown={(e) =>
                      handleRadioKeyDown(
                        e,
                        PLAN_LAYOUTS.map((l) => l.id),
                        config.layout,
                        handleSelectLayout,
                        'layout-option-'
                      )
                    }
                    className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
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
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> 選択中
                        </span>
                      ) : (
                        <span className="text-slate-500">選択する</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* STEP 2: PLAN LAYOUT DETAIL SELECTION */}
        {currentStep === 2 && (
          <fieldset className="space-y-3 border-0 p-0 m-0">
            <legend className="w-full mb-1">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40" aria-hidden="true">
                  2
                </span>
                {t.step_2_title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{t.step_2_desc}</p>
            </legend>

            <div 
              role="radiogroup" 
              aria-label={t.step_2_title} 
              className="grid grid-cols-1 gap-2.5 pt-1"
            >
              {PLAN_DETAILS.map((detail) => {
                const isSelected = config.detail === detail.id;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    key={detail.id}
                    id={`detail-option-${detail.id}`}
                    onClick={() => handleSelectDetail(detail.id)}
                    onKeyDown={(e) =>
                      handleRadioKeyDown(
                        e,
                        PLAN_DETAILS.map((d) => d.id),
                        config.detail,
                        handleSelectDetail,
                        'detail-option-'
                      )
                    }
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
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
                          <Check className="w-4 h-4" aria-hidden="true" /> 選択中
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {t[detail.descriptionKey]}
                    </p>

                    {/* Component configuration badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80 text-[11px]" aria-hidden="true">
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
          </fieldset>
        )}

        {/* STEP 3: PLAN TYPE SELECTION */}
        {currentStep === 3 && (
          <fieldset className="space-y-3 border-0 p-0 m-0">
            <legend className="w-full mb-1">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40" aria-hidden="true">
                  3
                </span>
                {t.step_3_title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{t.step_3_desc}</p>
            </legend>

            {/* Condition: If Type I Standard: Locked warning notice */}
            {config.detail === 'type-i-standard' ? (
              <div 
                role="status"
                aria-live="polite"
                className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex items-start gap-3 shadow-lg"
              >
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h4 className="text-sm font-bold text-amber-300">
                    {t.plan_standard_locked_title}
                  </h4>
                  <p className="text-xs text-amber-200/80 mt-1">
                    {t.plan_standard_locked_desc}
                  </p>
                  <p className="text-[11px] text-amber-300/70 mt-2 font-mono">
                    Type I Standard Package (+¥0) Default Locked
                  </p>
                </div>
              </div>
            ) : (
              <div 
                role="radiogroup" 
                aria-label={t.step_3_title} 
                className="grid grid-cols-1 gap-3 pt-1"
              >
                {/* Standard S-Class */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={config.planType === 'standard-s'}
                  tabIndex={config.planType === 'standard-s' ? 0 : -1}
                  id="plan-type-standard-s"
                  onClick={() => handleSelectPlanType('standard-s')}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      ['standard-s', 'premium-s'] as PlanTypeId[],
                      config.planType,
                      handleSelectPlanType,
                      'plan-type-'
                    )
                  }
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
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
                  type="button"
                  role="radio"
                  aria-checked={config.planType === 'premium-s'}
                  tabIndex={config.planType === 'premium-s' ? 0 : -1}
                  id="plan-type-premium-s"
                  onClick={() => handleSelectPlanType('premium-s')}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      ['standard-s', 'premium-s'] as PlanTypeId[],
                      config.planType,
                      handleSelectPlanType,
                      'plan-type-'
                    )
                  }
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
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
          </fieldset>
        )}

        {/* STEP 4: FLOOR UNIT TYPE SELECTION */}
        {currentStep === 4 && (
          <fieldset className="space-y-3 border-0 p-0 m-0">
            <legend className="w-full mb-1">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40" aria-hidden="true">
                  4
                </span>
                {t.step_4_title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{t.step_4_desc}</p>
            </legend>

            <div 
              role="radiogroup" 
              aria-label={t.step_4_title} 
              className="grid grid-cols-1 gap-3 pt-1"
            >
              {FLOOR_UNITS.map((unit) => {
                const isSelected = config.floorUnit === unit.id;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    key={unit.id}
                    id={`floor-unit-${unit.id}`}
                    onClick={() => handleSelectFloorUnit(unit.id)}
                    onKeyDown={(e) =>
                      handleRadioKeyDown(
                        e,
                        FLOOR_UNITS.map((u) => u.id),
                        config.floorUnit,
                        handleSelectFloorUnit,
                        'floor-unit-'
                      )
                    }
                    className={`text-left p-4 rounded-xl border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
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
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> 選択中
                        </span>
                      ) : (
                        <span className="text-slate-500">選択する</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* STEP 5: UNIT SPECIFICATIONS & UPGRADES */}
        {currentStep === 5 && (
          <fieldset className="space-y-3 border-0 p-0 m-0">
            <legend className="w-full mb-1">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40" aria-hidden="true">
                  5
                </span>
                {t.step_5_title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{t.step_5_desc}</p>
            </legend>

            <div 
              role="group" 
              aria-label={t.step_5_title} 
              className="grid grid-cols-1 gap-2.5 pt-1"
            >
              {UPGRADES.map((upgrade, index) => {
                const isChecked = !!config.upgrades[upgrade.id];
                return (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    key={upgrade.id}
                    id={`upgrade-item-${upgrade.id}`}
                    onClick={() => handleToggleUpgrade(upgrade.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextId = UPGRADES[(index + 1) % UPGRADES.length].id;
                        document.getElementById(`upgrade-item-${nextId}`)?.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevId = UPGRADES[(index - 1 + UPGRADES.length) % UPGRADES.length].id;
                        document.getElementById(`upgrade-item-${prevId}`)?.focus();
                      }
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/40'
                        : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Visual Checkbox Box */}
                    <div
                      aria-hidden="true"
                      className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
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
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* STEP 6: SINK LOCATION & HANDEDNESS (+ CABINET FINISH) */}
        {currentStep === 6 && (
          <div className="space-y-4">
            {/* Fieldset 1: Sink Location & Handedness */}
            <fieldset className="space-y-3 border-0 p-0 m-0">
              <legend className="w-full mb-1">
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40" aria-hidden="true">
                    6
                  </span>
                  {t.step_6_title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{t.step_6_desc}</p>
              </legend>

              {/* Handedness Switcher Cards (Left vs Right with 3D coordinate mirroring) */}
              <div 
                role="radiogroup" 
                aria-label={t.step_6_title} 
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {/* Left-Handed Sink */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={config.sinkLocation === 'left'}
                  tabIndex={config.sinkLocation === 'left' ? 0 : -1}
                  id="sink-loc-left"
                  onClick={() => handleSelectSinkLocation('left')}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      ['left', 'right'] as SinkLocation[],
                      config.sinkLocation,
                      handleSelectSinkLocation,
                      'sink-loc-'
                    )
                  }
                  className={`text-left p-4 rounded-xl border transition-all relative cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
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
                      <span className="p-1 rounded-full bg-emerald-500 text-white" aria-hidden="true">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="w-full h-12 bg-slate-950 rounded-lg p-2 flex items-center justify-between text-xs text-slate-400 border border-slate-800 font-mono mb-2" aria-hidden="true">
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
                  type="button"
                  role="radio"
                  aria-checked={config.sinkLocation === 'right'}
                  tabIndex={config.sinkLocation === 'right' ? 0 : -1}
                  id="sink-loc-right"
                  onClick={() => handleSelectSinkLocation('right')}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      ['left', 'right'] as SinkLocation[],
                      config.sinkLocation,
                      handleSelectSinkLocation,
                      'sink-loc-'
                    )
                  }
                  className={`text-left p-4 rounded-xl border transition-all relative cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
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
                      <span className="p-1 rounded-full bg-emerald-500 text-white" aria-hidden="true">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="w-full h-12 bg-slate-950 rounded-lg p-2 flex items-center justify-between text-xs text-slate-400 border border-slate-800 font-mono mb-2" aria-hidden="true">
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
            </fieldset>

            {/* Fieldset 2: Cabinet Door Finish Swatches */}
            <fieldset className="pt-2 border-t border-slate-800">
              <legend className="w-full mb-2 text-sm font-bold text-slate-200">
                {t.cabinet_finish_title}
              </legend>
              <div 
                role="radiogroup" 
                aria-label={t.cabinet_finish_title} 
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              >
                {CABINET_FINISHES.map((finish) => {
                  const isSelected = config.cabinetFinish === finish.id;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      key={finish.id}
                      id={`finish-${finish.id}`}
                      onClick={() => handleSelectCabinetFinish(finish.id)}
                      onKeyDown={(e) =>
                        handleRadioKeyDown(
                          e,
                          CABINET_FINISHES.map((f) => f.id),
                          config.cabinetFinish,
                          handleSelectCabinetFinish,
                          'finish-'
                        )
                      }
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                          : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full border border-white/20 shadow-inner shrink-0"
                        style={{ backgroundColor: finish.colorHex }}
                        aria-hidden="true"
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
            </fieldset>
          </div>
        )}

        {/* STEP 7: LIVE QUOTATION SUMMARY & PRICE CALCULATOR */}
        {currentStep === 7 && (
          <section aria-labelledby="step-7-heading" className="space-y-4">
            <div>
              <h3 id="step-7-heading" className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/40" aria-hidden="true">
                  7
                </span>
                {t.step_7_title}
              </h3>
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
              <table className="w-full text-left text-xs" aria-label={t.quote_breakdown}>
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-medium">
                  <tr>
                    <th scope="col" className="p-3">{t.quote_item}</th>
                    <th scope="col" className="p-3 text-right">{t.quote_price}</th>
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
                type="button"
                id="view-full-quote-btn"
                onClick={onOpenQuotationModal}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-[#00a86b] hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-950 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>{t.view_quotation_btn}</span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Bottom Step Navigation Footer Bar */}
      <nav 
        aria-label={lang === 'ja' ? 'ステップ移動' : 'Wizard step controls'} 
        className="p-3.5 sm:p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3"
      >
        {/* Previous Button */}
        <button
          type="button"
          id="wizard-prev-btn"
          disabled={currentStep === 1}
          onClick={() => handleStepChange(Math.max(1, currentStep - 1))}
          aria-label={t.btn_prev}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none ${
            currentStep === 1
              ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-850'
              : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 cursor-pointer'
          }`}
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.btn_prev}</span>
        </button>

        {/* Live Running Total in Footer */}
        <div className="text-center hidden sm:block" aria-live="polite" aria-atomic="true">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{t.live_subtotal}</div>
          <div className="text-sm font-bold text-emerald-400">{formatYen(priceCalc.grandTotal)}</div>
        </div>

        {/* Next / Finish Button */}
        {currentStep < 7 ? (
          <button
            type="button"
            id="wizard-next-btn"
            onClick={() => handleStepChange(currentStep + 1)}
            aria-label={t.btn_next}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-[#00a86b] hover:from-emerald-500 hover:to-emerald-400 shadow-md shadow-emerald-950 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
          >
            <span>{t.btn_next}</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            id="wizard-finish-btn"
            onClick={onOpenQuotationModal}
            aria-label={t.btn_finish}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-950 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>{t.btn_finish}</span>
          </button>
        )}
      </nav>
    </section>
  );
};

export default StepWizard;
