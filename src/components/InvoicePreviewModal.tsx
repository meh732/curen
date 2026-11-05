import React from 'react';
import { SalesInvoice } from '../types/accounting';
import { formatNumber, formatCurrencyAmount } from '../utils/accountingEngine';
import { Printer, Download, X, CheckCircle2, Send, Building2, User, Coins, Landmark } from 'lucide-react';

interface InvoicePreviewModalProps {
  invoice: SalesInvoice | null;
  companyName: string;
  onClose: () => void;
  onSendToBot?: (platform: 'bale' | 'telegram') => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  companyName,
  onClose,
  onSendToBot,
}) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const isSales = invoice.type !== 'purchase';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full">
        {/* Modal Action Header (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-extrabold text-xs sm:text-sm">
              پیش‌نمایش رسمی فاکتور {isSales ? 'فروش' : 'خرید'} ({invoice.invoiceNumber})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Invoice Card */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto text-slate-900">
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-teal-700" />
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {companyName || 'صرافی و دفتر محاسبات ارزی'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                صورتحساب و فاکتور رسمی معامله ارزی و کالایی
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1 font-mono-num shrink-0">
              <div className="flex justify-between gap-4 font-bold">
                <span className="text-slate-500">شماره فاکتور:</span>
                <span className="text-teal-800">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">تاریخ صدور:</span>
                <span>{invoice.date}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">نوع معامله:</span>
                <span className="font-extrabold text-slate-900">
                  {isSales ? 'فاکتور فروش' : 'فاکتور خرید'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-bold block mb-0.5">
                {isSales ? 'خریدار / طرف حساب:' : 'فروشنده / طرف حساب:'}
              </span>
              <span className="font-extrabold text-slate-900 text-sm">{invoice.contactName}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block mb-0.5">نحوه تسویه حساب:</span>
              <span className="font-extrabold text-teal-800">
                {invoice.status === 'paid'
                  ? 'تسویه کامل (نقدی / واریز بانکی)'
                  : invoice.status === 'partial'
                  ? 'تسویه ترکیبی (بخشی نسیه)'
                  : 'نسیه (منظور در حساب شخص)'}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-800">
                  <th className="p-3">ردیف</th>
                  <th className="p-3">موضوع معامله / ارز</th>
                  <th className="p-3 text-center">تعداد / مقدار</th>
                  <th className="p-3 text-left">نرخ / فی (ریال)</th>
                  <th className="p-3 text-left">مبلغ کل (ریال)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono-num">
                {invoice.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-extrabold text-slate-900 font-sans">{item.productName}</td>
                    <td className="p-3 text-center font-bold">
                      {formatNumber(item.quantity)} {item.unit}
                    </td>
                    <td className="p-3 text-left">{formatNumber(item.unitPriceIRR)}</td>
                    <td className="p-3 text-left font-extrabold text-slate-900">
                      {formatNumber(item.totalIRR)} ریال
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Split Payments Breakdown */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs">
              <div className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-emerald-700" />
                ریز اسناد واریز / برداشت بانکی و صندوق:
              </div>
              <div className="space-y-1 font-mono-num">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-slate-800">
                    <span>{p.bankName}:</span>
                    <span className="font-bold text-emerald-900">
                      {p.currency === 'IRR'
                        ? `${formatNumber(p.amountIRR)} ریال`
                        : `${formatCurrencyAmount(p.amountForeign, p.currency)} ${p.currency} (ارزش ریالی: ${formatNumber(p.amountIRR)})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grand Total Summary */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs sm:text-sm font-extrabold font-mono-num">
            <span>مبلغ کل قابل پرداخت فاکتور:</span>
            <span className="text-teal-400 text-sm sm:text-base">
              {formatNumber(invoice.grandTotalIRR)} ریال
            </span>
          </div>

          {invoice.notes && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <strong>توضیحات:</strong> {invoice.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="pt-6 grid grid-cols-2 text-center text-xs font-bold text-slate-500 border-t border-slate-200">
            <div>امضاء و مهر صرافی</div>
            <div>امضاء خریدار / طرف حساب</div>
          </div>
        </div>

        {/* Modal Action Footer (Hidden in Print) */}
        {onSendToBot && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 print:hidden">
            <span className="text-[11px] text-slate-500">ارسال مستقیم فاکتور:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSendToBot('bale')}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Send className="w-3.5 h-3.5" />
                ارسال به بله
              </button>
              <button
                onClick={() => onSendToBot('telegram')}
                className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Send className="w-3.5 h-3.5" />
                ارسال به تلگرام
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
