import React, { useState } from 'react';
import { KitchenConfig, PriceCalculation, Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { formatYen } from '../utils/pricing';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  Building2, 
  Sparkles, 
  FileCheck2,
  Calendar,
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: KitchenConfig;
  priceCalc: PriceCalculation;
  lang: Language;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  config,
  priceCalc,
  lang,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ja;

  if (!isOpen) return null;

  const quoteNumber = 'PSK-' + Math.floor(100000 + Math.random() * 900000);
  const currentDate = new Date().toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleCopySummary = () => {
    const summaryText = `
========================================
${t.quote_summary_title}
${t.brand_title}
Quotation No: ${quoteNumber}
Date: ${currentDate}
========================================
${priceCalc.items
  .map(
    (item, idx) =>
      `${idx + 1}. ${item.name} ${item.detail ? `(${item.detail})` : ''}: ${
        item.price === 0 ? '込 / ¥0' : formatYen(item.price)
      }`
  )
  .join('\n')}
----------------------------------------
${t.quote_subtotal}: ${formatYen(priceCalc.subtotal)}
${t.quote_tax}: ${formatYen(priceCalc.tax)}
${t.quote_grand_total}: ${formatYen(priceCalc.grandTotal)}
========================================
${t.quote_notice}
    `.trim();

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 },
      });
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        id="quotation-print-modal" 
        className="relative w-full max-w-3xl glass-panel-elevated rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden my-auto print-container"
      >
        {/* Modal Header Bar (Hidden in print) */}
        <div className="no-print flex items-center justify-between p-4 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">
              {t.quote_summary_title}
            </h3>
          </div>
          <button
            id="close-quote-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formal Printable Quotation Body */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-200 print:text-black">
          {/* Header Brand & Reference */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800 print:border-gray-300">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 print:text-emerald-700 tracking-wider uppercase">
                <Building2 className="w-4 h-4" />
                <span>Panasonic Living Appliances System Kitchen</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white print:text-black mt-1">
                S-CLASS システムキッチン 御見積書
              </h1>
              <p className="text-xs text-slate-400 print:text-gray-600 mt-1">
                2550mm ハイグレードカスタムモデル
              </p>
            </div>

            <div className="text-right text-xs space-y-1 text-slate-400 print:text-gray-600">
              <div className="flex items-center justify-end gap-1.5 font-mono">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span>{quoteNumber}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentDate}</span>
              </div>
            </div>
          </div>

          {/* Grand Total Highlight Banner */}
          <div className="p-5 rounded-xl bg-slate-900/90 print:bg-gray-100 border border-emerald-500/40 print:border-gray-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-xs font-semibold text-emerald-400 print:text-emerald-700 uppercase tracking-wider">
                {t.quote_grand_total}
              </span>
              <div className="text-3xl font-black text-white print:text-black mt-0.5">
                {formatYen(priceCalc.grandTotal)}
              </div>
            </div>
            <div className="text-right text-xs text-slate-300 print:text-gray-700 space-y-0.5 font-medium">
              <div>{t.quote_subtotal}: <span className="font-bold text-white print:text-black">{formatYen(priceCalc.subtotal)}</span></div>
              <div>{t.quote_tax}: <span className="font-bold text-white print:text-black">{formatYen(priceCalc.tax)}</span></div>
            </div>
          </div>

          {/* Detailed Itemized Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-gray-300">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 print:bg-gray-200 text-slate-400 print:text-gray-700 font-semibold border-b border-slate-800 print:border-gray-300">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">{t.quote_item}</th>
                  <th className="py-3 px-4">{t.quote_detail}</th>
                  <th className="py-3 px-4 text-center w-16">{t.quote_qty}</th>
                  <th className="py-3 px-4 text-right">{t.quote_price}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 print:divide-gray-300">
                {priceCalc.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-900/30 print:hover:bg-transparent">
                    <td className="py-3 px-4 text-center text-slate-500 font-mono">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white print:text-black">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-slate-400 print:text-gray-600">
                      {item.detail || '-'}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 print:text-black">
                      1 式
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-200 print:text-black whitespace-nowrap">
                      {item.price === 0 ? '込 / +¥0' : formatYen(item.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900/60 print:bg-gray-100 font-semibold border-t border-slate-800 print:border-gray-300">
                  <td colSpan={4} className="py-3 px-4 text-right text-slate-300 print:text-black">
                    {t.quote_subtotal}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-white print:text-black">
                    {formatYen(priceCalc.subtotal)}
                  </td>
                </tr>
                <tr className="bg-slate-900/60 print:bg-gray-100 font-semibold">
                  <td colSpan={4} className="py-2.5 px-4 text-right text-slate-300 print:text-black">
                    {t.quote_tax}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-white print:text-black">
                    {formatYen(priceCalc.tax)}
                  </td>
                </tr>
                <tr className="bg-emerald-950/40 print:bg-gray-200 font-bold border-t-2 border-emerald-500 print:border-gray-400">
                  <td colSpan={4} className="py-3 px-4 text-right text-emerald-400 print:text-black text-sm">
                    {t.quote_grand_total}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400 print:text-black text-base">
                    {formatYen(priceCalc.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legal / Manufacturer Notice */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 print:bg-gray-50 border border-slate-800 print:border-gray-300 text-[11px] text-slate-400 print:text-gray-600 leading-relaxed">
            {t.quote_notice}
          </div>
        </div>

        {/* Action Controls Toolbar (Hidden in Print) */}
        <div className="no-print p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            id="modal-copy-btn"
            onClick={handleCopySummary}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">{t.copy_success}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>{t.btn_copy}</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              id="modal-print-btn"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00a86b] hover:bg-[#00975f] text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950"
            >
              <Printer className="w-4 h-4" />
              <span>{t.btn_print}</span>
            </button>
            <button
              id="modal-close-bottom-btn"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
