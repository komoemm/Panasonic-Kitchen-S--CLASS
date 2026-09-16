import React from 'react';
import { KitchenConfig, Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { X, Layers, Compass, Ruler } from 'lucide-react';

interface BlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: KitchenConfig;
  lang: Language;
}

export const BlueprintModal: React.FC<BlueprintModalProps> = ({
  isOpen,
  onClose,
  config,
  lang,
}) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ja;

  if (!isOpen) return null;

  const isLeft = config.sinkLocation === 'left';
  // SVG coordinates:
  // Kitchen counter: W=600px (representing 2550mm), H=150px (representing 650mm)
  // Sink box: W=160px, H=110px. If Left: X=50px, if Right: X=390px.
  // Cooktop box: W=180px, H=90px. If Left: X=370px, if Right: X=50px.
  // Dishwasher: Center X=230px, W=140px.

  const sinkX = isLeft ? 50 : 390;
  const cooktopX = isLeft ? 370 : 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-panel-elevated rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900/95 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">
              {t.blueprint_title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Blueprint Content */}
        <div className="p-6 sm:p-8 space-y-6 bg-[#0c121e]">
          {/* Dimension Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">間口 (Width)</div>
                <div className="font-bold text-slate-100">2,550 mm</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">奥行 (Depth)</div>
                <div className="font-bold text-slate-100">650 mm</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">天面高 (Height)</div>
                <div className="font-bold text-slate-100">850 mm</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">シンク配置 (Hand)</div>
                <div className="font-bold text-emerald-400">
                  {isLeft ? 'シンク左 (L)' : 'シンク右 (R)'}
                </div>
              </div>
            </div>
          </div>

          {/* Architectural SVG Plan Blueprint */}
          <div className="relative p-4 sm:p-6 rounded-2xl bg-slate-950 border border-cyan-500/20 shadow-inner flex flex-col items-center">
            <div className="text-xs font-mono text-cyan-400/80 mb-2 w-full flex justify-between">
              <span>PLAN VIEW (平面図 - 1:20)</span>
              <span>PANASONIC S-CLASS KITCHEN MODULE</span>
            </div>

            <svg
              viewBox="0 0 700 280"
              className="w-full max-w-2xl h-auto stroke-cyan-400/70"
            >
              <defs>
                <pattern
                  id="grid-pattern"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>

              {/* Grid Background */}
              <rect width="700" height="280" fill="url(#grid-pattern)" />

              {/* Overall Countertop Outline (2550mm) */}
              <rect
                x="50"
                y="50"
                width="600"
                height="150"
                fill="#0f172a"
                stroke="#00a86b"
                strokeWidth="2.5"
                rx="4"
              />

              {/* Dimension Callout Top (2550mm) */}
              <line x1="50" y1="28" x2="650" y2="28" stroke="#00f2fe" strokeWidth="1.5" />
              <line x1="50" y1="22" x2="50" y2="34" stroke="#00f2fe" strokeWidth="1.5" />
              <line x1="650" y1="22" x2="650" y2="34" stroke="#00f2fe" strokeWidth="1.5" />
              <text x="350" y="24" fill="#00f2fe" fontSize="11" textAnchor="middle" fontFamily="monospace">
                2,550 mm
              </text>

              {/* Dimension Callout Left (650mm) */}
              <line x1="28" y1="50" x2="28" y2="200" stroke="#00f2fe" strokeWidth="1.5" />
              <line x1="22" y1="50" x2="34" y2="50" stroke="#00f2fe" strokeWidth="1.5" />
              <line x1="22" y1="200" x2="34" y2="200" stroke="#00f2fe" strokeWidth="1.5" />
              <text
                x="22"
                y="125"
                fill="#00f2fe"
                fontSize="11"
                textAnchor="middle"
                fontFamily="monospace"
                transform="rotate(-90 22 125)"
              >
                650 mm
              </text>

              {/* Sink Unit */}
              <rect
                x={sinkX}
                y="70"
                width="160"
                height="110"
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth="1.8"
                rx="6"
              />
              {/* Drain ring */}
              <circle
                cx={sinkX + 115}
                cy="125"
                r="14"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              {/* Faucet Mount */}
              <circle
                cx={sinkX + 80}
                cy="64"
                r="8"
                fill="#38bdf8"
              />
              <text
                x={sinkX + 80}
                y="105"
                fill="#93c5fd"
                fontSize="10"
                textAnchor="middle"
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {config.upgrades.sugoPikaSink ? 'スゴピカシンク' : '標準シンク'}
              </text>

              {/* Center Work Prep Zone or Dishwasher indicator */}
              <rect
                x="230"
                y="55"
                width="120"
                height="140"
                fill="transparent"
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x="290"
                y="120"
                fill="#94a3b8"
                fontSize="10"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                調理スペース
              </text>
              <text
                x="290"
                y="138"
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                {config.floorUnit === 'front-dishwasher' ? '(食洗機内蔵)' : '(大容量スライド)'}
              </text>

              {/* IH Cooktop Unit */}
              <rect
                x={cooktopX}
                y="75"
                width="180"
                height="100"
                fill="#18181b"
                stroke="#f43f5e"
                strokeWidth="1.8"
                rx="3"
              />
              {/* 3 Burners for Triple Wide IH */}
              {config.upgrades.tripleWideIH ? (
                <>
                  <circle cx={cooktopX + 38} cy="120" r="22" fill="#000" stroke="#f43f5e" strokeWidth="1.5" />
                  <circle cx={cooktopX + 90} cy="120" r="22" fill="#000" stroke="#00f2fe" strokeWidth="1.5" />
                  <circle cx={cooktopX + 142} cy="120" r="22" fill="#000" stroke="#f43f5e" strokeWidth="1.5" />
                  <text
                    x={cooktopX + 90}
                    y="165"
                    fill="#f43f5e"
                    fontSize="9"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    トリプルワイド IH (横3口並び)
                  </text>
                </>
              ) : (
                <>
                  <circle cx={cooktopX + 55} cy="120" r="24" fill="#000" stroke="#f43f5e" strokeWidth="1.5" />
                  <circle cx={cooktopX + 125} cy="120" r="24" fill="#000" stroke="#f43f5e" strokeWidth="1.5" />
                  <text
                    x={cooktopX + 90}
                    y="165"
                    fill="#f43f5e"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    標準IHクッキングヒーター
                  </text>
                </>
              )}

              {/* Handedness Dynamic Mirroring Indicator Label */}
              <text
                x="350"
                y="235"
                fill="#00a86b"
                fontSize="11"
                textAnchor="middle"
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {isLeft
                  ? '← シンク左配置 (Left Sink: -0.75m) | コンロ右配置 (+0.75m) →'
                  : '← コンロ左配置 (-0.75m) | シンク右配置 (Right Sink: +0.75m) →'}
              </text>
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            {t.blueprint_close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlueprintModal;
