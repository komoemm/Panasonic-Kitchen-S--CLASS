import React, { useState } from 'react';
import { KitchenConfig, Language } from './types';
import { calculateKitchenPrice } from './utils/pricing';
import { TopBar } from './components/TopBar';
import { KitchenViewport3D } from './components/KitchenViewport3D';
import { StepWizard } from './components/StepWizard';
import { QuotationModal } from './components/QuotationModal';
import { BlueprintModal } from './components/BlueprintModal';

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
        {/* Left / Center 3D Interactive Viewport (7 cols on desktop) */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col h-[460px] sm:h-[540px] lg:h-[calc(100vh-100px)] min-h-[440px]">
          <KitchenViewport3D
            config={config}
            lang={lang}
            onOpenQuotation={() => setIsQuotationModalOpen(true)}
            onOpenBlueprint={() => setIsBlueprintModalOpen(true)}
          />
        </section>

        {/* Right 7-Step Configurator Wizard Panel (5 cols on desktop) */}
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col h-[520px] sm:h-[600px] lg:h-[calc(100vh-100px)] min-h-[500px]">
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

      {/* Itemized Printable Official Quotation Modal */}
      <QuotationModal
        isOpen={isQuotationModalOpen}
        onClose={() => setIsQuotationModalOpen(false)}
        config={config}
        priceCalc={priceCalc}
        lang={lang}
      />

      {/* 2D Architectural Blueprint Dimension Diagram Modal */}
      <BlueprintModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
        config={config}
        lang={lang}
      />
    </div>
  );
}
