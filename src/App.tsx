import React, { useState, Suspense, lazy } from 'react';
import { KitchenConfig, Language } from './types';
import { calculateKitchenPrice } from './utils/pricing';
import { TopBar } from './components/TopBar';
import { StepWizard } from './components/StepWizard';
import { KitchenViewportSkeleton } from './components/KitchenViewportSkeleton';

// Code Splitting with React.lazy for Google Lighthouse performance & Core Web Vitals optimization
const KitchenViewport3D = lazy(() => import('./components/KitchenViewport3D'));
const QuotationModal = lazy(() => import('./components/QuotationModal'));
const BlueprintModal = lazy(() => import('./components/BlueprintModal'));

export default function App() {
  const [lang, setLang] = useState<Language>('ja');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState<boolean>(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState<boolean>(false);

  // Default initial configuration
  const [config, setConfig] = useState<KitchenConfig>({
    layout: 'type-i',
    detail: 'type-i-standard',
    planType: 'standard-default-locked',
    floorUnit: 'high-storage',
    upgrades: {
      sugoPikaSink: true,
      tripleWideIH: true,
      autoCleanHood: true,
      slimSensorFaucet: true,
    },
    sinkLocation: 'left',
    cabinetFinish: 'white-w',
  });

  const priceCalc = calculateKitchenPrice(config, lang);

  return (
    <div className="min-h-screen flex flex-col bg-[#080c15] text-slate-100 selection:bg-[#00a86b] selection:text-white">
      {/* Top Header Bar */}
      <TopBar
        lang={lang}
        onSelectLang={setLang}
        priceCalc={priceCalc}
        onOpenQuotationModal={() => setIsQuotationModalOpen(true)}
        onOpenBlueprintModal={() => setIsBlueprintModalOpen(true)}
      />

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left / Center 3D Interactive Viewport with Suspense Skeleton (7 cols on desktop) */}
        <section 
          aria-label={lang === 'ja' ? '3Dモデル表示領域' : '3D Model Viewport Area'}
          className="lg:col-span-7 xl:col-span-8 flex flex-col h-[460px] sm:h-[540px] lg:h-[calc(100vh-100px)] min-h-[440px]"
        >
          <Suspense fallback={<KitchenViewportSkeleton lang={lang} />}>
            <KitchenViewport3D
              config={config}
              lang={lang}
              onOpenQuotation={() => setIsQuotationModalOpen(true)}
              onOpenBlueprint={() => setIsBlueprintModalOpen(true)}
            />
          </Suspense>
        </section>

        {/* Right 7-Step Configurator Wizard Panel (5 cols on desktop) */}
        <section 
          aria-label={lang === 'ja' ? '7ステップ見積シミュレーター設定' : '7-Step Kitchen Configuration Wizard'}
          className="lg:col-span-5 xl:col-span-4 flex flex-col h-[520px] sm:h-[600px] lg:h-[calc(100vh-100px)] min-h-[500px]"
        >
          <StepWizard
            currentStep={currentStep}
            onSetStep={setCurrentStep}
            config={config}
            onChangeConfig={setConfig}
            priceCalc={priceCalc}
            lang={lang}
            onOpenQuotationModal={() => setIsQuotationModalOpen(true)}
          />
        </section>
      </main>

      {/* Itemized Printable Official Quotation Modal (Lazy Loaded on demand) */}
      {isQuotationModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-2xl">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">
                {lang === 'ja' ? '見積書データを読み込み中...' : 'Loading quotation...'}
              </span>
            </div>
          </div>
        }>
          <QuotationModal
            isOpen={isQuotationModalOpen}
            onClose={() => setIsQuotationModalOpen(false)}
            config={config}
            priceCalc={priceCalc}
            lang={lang}
          />
        </Suspense>
      )}

      {/* 2D Architectural Blueprint Diagram Modal (Lazy Loaded on demand) */}
      {isBlueprintModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-2xl">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">
                {lang === 'ja' ? '2D図面データを読み込み中...' : 'Loading architectural blueprint...'}
              </span>
            </div>
          </div>
        }>
          <BlueprintModal
            isOpen={isBlueprintModalOpen}
            onClose={() => setIsBlueprintModalOpen(false)}
            config={config}
            lang={lang}
          />
        </Suspense>
      )}
    </div>
  );
}

