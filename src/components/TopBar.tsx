import React from 'react';
import { Language, PriceCalculation } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { formatYen } from '../utils/pricing';
import { Layers, FileText, Globe } from 'lucide-react';

interface TopBarProps {
  lang: Language;
  onSelectLang: (l: Language) => void;
  priceCalc: PriceCalculation;
  onOpenQuotationModal: () => void;
  onOpenBlueprintModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  lang,
  onSelectLang,
  priceCalc,
  onOpenQuotationModal,
  onOpenBlueprintModal,
}) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ja;

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'mm', label: 'မြန်မာ', flag: '🇲🇲' },
  ];

  return (
    <header className="w-full glass-panel border-b border-slate-800/80 sticky top-0 z-30 px-4 lg:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#00a86b]">
                Panasonic
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400">
                S-CLASS
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              {t.brand_title}
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hidden md:inline-block">
                3D Configurator
              </span>
            </h1>
          </div>
        </div>

        {/* Right Controls: Live Total + 2D Blueprint + Language Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 2D Blueprint Button */}
          <button
            id="topbar-blueprint-btn"
            onClick={onOpenBlueprintModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/60 transition-colors cursor-pointer"
            title={t.view_blueprint}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{t.view_blueprint}</span>
          </button>

          {/* Live Quotation Price Badge */}
          <button
            id="topbar-quotation-badge"
            onClick={onOpenQuotationModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-emerald-950/70 hover:to-emerald-900/80 border border-emerald-500/40 shadow-sm transition-all text-left cursor-pointer group"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase tracking-tight hidden xs:block">
                {t.live_subtotal}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-300 font-mono">
                {formatYen(priceCalc.grandTotal)}
              </span>
            </div>
          </button>

          {/* i18n Language Selector Buttons */}
          <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-800 shadow-inner">
            <div className="px-1.5 text-slate-500 hidden sm:block">
              <Globe className="w-3.5 h-3.5" />
            </div>
            {languages.map((l) => (
              <button
                key={l.code}
                id={`lang-btn-${l.code}`}
                onClick={() => onSelectLang(l.code)}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-all ${
                  lang === l.code
                    ? 'bg-[#00a86b] text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="mr-1">{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
