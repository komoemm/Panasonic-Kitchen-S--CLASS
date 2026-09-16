import React from 'react';
import { Box, Loader2 } from 'lucide-react';
import { Language } from '../types';

interface KitchenViewportSkeletonProps {
  lang?: Language;
}

export const KitchenViewportSkeleton: React.FC<KitchenViewportSkeletonProps> = ({ lang = 'ja' }) => {
  const loadingLabel = lang === 'ja' 
    ? 'Panasonic 3Dショールームを展開中...' 
    : lang === 'mm' 
    ? 'Panasonic 3D ရှိုးခန်းကို ဖွင့်လှစ်နေပါသည်...' 
    : 'Initializing Panasonic 3D Showroom...';

  const specsLabel = lang === 'ja'
    ? '2550mm × 650mm × 850mm | システムキッチン'
    : '2550mm × 650mm × 850mm | S-CLASS System Kitchen';

  return (
    <div 
      id="viewport-skeleton" 
      className="relative w-full h-full min-h-[420px] lg:min-h-[520px] flex flex-col rounded-2xl overflow-hidden glass-panel border border-slate-700/60 shadow-2xl bg-[#0b0f19] select-none"
      aria-busy="true"
      aria-label="3D Viewport Loading Skeleton"
    >
      {/* Background Architectural Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 168, 107, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 168, 107, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Top Floating Overlay Skeleton */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none gap-2 z-10">
        {/* Spec Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/70 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-[#00a86b] animate-ping" />
          <span className="font-semibold text-emerald-400">{specsLabel}</span>
        </div>

        {/* Action Button Placeholders */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/70">
          <div className="w-20 h-7 bg-slate-800/80 rounded-lg animate-pulse" />
          <div className="w-7 h-7 bg-slate-800/80 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Center 3D Engine Spinner & Progress */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="relative mb-5 flex items-center justify-center">
          {/* Pulsing outer ambient ring */}
          <div className="absolute w-20 h-20 rounded-full bg-emerald-500/10 animate-ping duration-1000" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-emerald-500/30 flex items-center justify-center shadow-xl shadow-emerald-950/40">
            <Box className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-200 mb-3">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>{loadingLabel}</span>
        </div>

        {/* Shimmering Progress Bar */}
        <div className="w-48 sm:w-64 h-1.5 bg-slate-800/90 rounded-full overflow-hidden border border-slate-700/50">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 rounded-full animate-pulse w-3/4 shadow-[0_0_12px_rgba(0,168,107,0.5)]" />
        </div>
      </div>

      {/* Bottom Floating Toolbar Skeleton */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Camera Preset Buttons Skeleton */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800">
          <div className="w-14 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
          <div className="w-12 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
          <div className="w-12 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
          <div className="w-12 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
        </div>

        {/* Feature Toggles Skeleton */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800">
          <div className="w-16 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
          <div className="w-16 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
          <div className="w-16 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
          <div className="w-16 h-6 bg-slate-800/70 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default KitchenViewportSkeleton;
