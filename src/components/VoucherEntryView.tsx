import React, { useMemo, useState } from 'react';
import {
  AccountingState,
  CurrencyCode,
  JournalVoucher,
  VoucherLine,
} from '../types/accounting';
import {
  calculateVoucherBalance,
  convertForeignToIRR,
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Scale,
  Calculator,
} from 'lucide-react';

interface VoucherEntryViewProps {
  state: AccountingState;
  onSaveVoucher: (voucher: JournalVoucher) => void;
  onDeleteVoucher: (voucherId: string) => void;
}

export const VoucherEntryView: React.FC<VoucherEntryViewProps> = ({
  state,
  onSaveVoucher,
  onDeleteVoucher,
}) => {
  const nextNumber = useMemo(() => {
    const max = state.vouchers.reduce((m, v) => Math.max(m, v.voucherNumber), 1000);
    return max + 1;
  }, [state.vouchers]);

  const [date, setDate] = useState('1404/08/12');
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [status, setStatus] = useState<'temporary' | 'permanent'>('permanent');
  const [selectedVoucherFilter, setSelectedVoucherFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const createEmptyLine = (defaultCurr: CurrencyCode = 'USD'): VoucherLine => {
    const currObj = state.currencies.find((c) => c.code === defaultCurr) || state.currencies[0];
    const firstMoein = state.accounts.find((a) => a.level === 'moein') || state.accounts[0];
    return {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      accountCode: firstMoein.code,
      accountName: firstMoein.name,
      description: '',
      currency: currObj.code,
      exchangeRate: currObj.defaultRateToIRR,
      debitForeign: 0,
      creditForeign: 0,
      debitIRR: 0,
      creditIRR: 0,
      trackingNumber: '',
    };
  };

  const [lines, setLines] = useState<VoucherLine[]>(() => [
    {
      id: 'init-1',
      accountCode: '1104',
      accountName: 'حساب‌های دریافتنی تجاری (مشتریان / بدهکاران)',
      contactId: 'cnt-1',
      contactName: 'شرکت مهندسی صنایع فولاد کاوه (مشتری داخلی و ارزی)',
      description: 'ثبت بدهکاری ارزی با تبدیل خودکار به ریال',
      currency: 'USD',
      exchangeRate: 685000,
      debitForeign: 1000,
      creditForeign: 0,
      debitIRR: 685000000,
      creditIRR: 0,
      trackingNumber: 'DOC-201',
    },
    {
      id: 'init-2',
      accountCode: '4102',
      accountName: 'درآمد فروش صادراتی و ارزی',
      description: 'ثبت بستانکاری درآمد ارزی و معادل ریالی',
      currency: 'USD',
      exchangeRate: 685000,
      debitForeign: 0,
      creditForeign: 1000,
      debitIRR: 0,
      creditIRR: 685000000,
      trackingNumber: 'DOC-201',
    },
  ]);

  const moeinAccounts = useMemo(
    () => state.accounts.filter((a) => a.level === 'moein'),
    [state.accounts]
  );

  const balanceSummary = useMemo(() => calculateVoucherBalance(lines), [lines]);

  const handleUpdateLine = (index: number, patch: Partial<VoucherLine>) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        const updated = { ...line, ...patch };

        // If accountCode changed, sync accountName
        if (patch.accountCode !== undefined) {
          const acc = moeinAccounts.find((a) => a.code === patch.accountCode);
          if (acc) updated.accountName = acc.name;
        }

        // If contactId changed, sync contactName
        if (patch.contactId !== undefined) {
          const cnt = state.contacts.find((c) => c.id === patch.contactId);
          updated.contactName = cnt ? cnt.name : undefined;
        }

        // If bankId changed, sync bankName and currency if desired
        if (patch.bankId !== undefined) {
          const bnk = state.banks.find((b) => b.id === patch.bankId);
          updated.bankName = bnk ? bnk.bankName : undefined;
        }

        // If currency changed, load default exchange rate for that currency
        if (patch.currency !== undefined) {
          const currObj = state.currencies.find((c) => c.code === patch.currency);
          const newRate = currObj ? currObj.defaultRateToIRR : 1;
          updated.exchangeRate = newRate;
          if (patch.currency === 'IRR') {
            updated.debitForeign = updated.debitIRR;
            updated.creditForeign = updated.creditIRR;
          } else {
            updated.debitIRR = convertForeignToIRR(updated.debitForeign, newRate, updated.currency);
            updated.creditIRR = convertForeignToIRR(updated.creditForeign, newRate, updated.currency);
          }
        }

        // If exchangeRate, debitForeign, or creditForeign changed, recalculate IRR automatically
        if (
          patch.exchangeRate !== undefined ||
          patch.debitForeign !== undefined ||
          patch.creditForeign !== undefined
        ) {
          if (updated.currency === 'IRR') {
            updated.exchangeRate = 1;
            if (patch.debitForeign !== undefined) updated.debitIRR = Math.round(updated.debitForeign);
            if (patch.creditForeign !== undefined) updated.creditIRR = Math.round(updated.creditForeign);
          } else {
            updated.debitIRR = convertForeignToIRR(
              updated.debitForeign,
              updated.exchangeRate,
              updated.currency
            );
            updated.creditIRR = convertForeignToIRR(
              updated.creditForeign,
              updated.exchangeRate,
              updated.currency
            );
          }
        }

        // If user edited IRR directly on an IRR line
        if (patch.debitIRR !== undefined && updated.currency === 'IRR') {
          updated.debitForeign = patch.debitIRR;
        }
        if (patch.creditIRR !== undefined && updated.currency === 'IRR') {
          updated.creditForeign = patch.creditIRR;
        }

        return updated;
      })
    );
  };

  const handleAutoBalanceDifference = () => {
    if (balanceSummary.differenceIRR === 0) return;
    const diffIRR = balanceSummary.differenceIRR;
    const gainLossAcc =
      moeinAccounts.find((a) => a.code === '4201') || moeinAccounts[0];

    const balancingLine: VoucherLine = {
      id: `line-bal-${Date.now()}`,
      accountCode: gainLossAcc.code,
      accountName: gainLossAcc.name,
      description: 'تراز خودکار مابه‌التفاوت / تسعیر نرخ ارز به ریال',
      currency: 'IRR',
      exchangeRate: 1,
      debitForeign: diffIRR < 0 ? Math.abs(diffIRR) : 0,
      creditForeign: diffIRR > 0 ? diffIRR : 0,
      debitIRR: diffIRR < 0 ? Math.abs(diffIRR) : 0,
      creditIRR: diffIRR > 0 ? diffIRR : 0,
    };
    setLines((prev) => [...prev, balancingLine]);
  };

  const handleSubmitVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setFeedback({
        type: 'error',
        message: 'لطفاً شرح کلی سند حسابداری را وارد نمایید.',
      });
      return;
    }
    if (!balanceSummary.isBalancedIRR) {
      setFeedback({
        type: 'error',
        message: `سند تراز نیست! اختلاف بدهکار و بستانکار ریالی (${formatNumber(
          Math.abs(balanceSummary.differenceIRR)
        )} ریال) باید صفر شود.`,
      });
      return;
    }

    const newVoucher: JournalVoucher = {
      id: `vch-${Date.now()}`,
      voucherNumber: nextNumber,
      date,
      description: description.trim(),
      referenceNumber: referenceNumber.trim() || `REF-${nextNumber}`,
      status,
      createdAt: date,
      lines,
    };

    onSaveVoucher(newVoucher);
    setDescription('');
    setReferenceNumber('');
    setFeedback({
      type: 'success',
      message: `سند حسابداری شماره ${nextNumber} با موفقیت به صورت دوارزی و ریالی ثبت شد و بکاپ خودکار بروزرسانی گردید.`,
    });
  };

  const filteredVouchers = useMemo(() => {
    if (selectedVoucherFilter === 'ALL') return state.vouchers;
    return state.vouchers.filter((v) =>
      v.lines.some((l) => l.currency === selectedVoucherFilter)
    );
  }, [state.vouchers, selectedVoucherFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Quick Currency Rates Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            ثبت سند حسابداری استاندارد (دوارزی و تبدیل خودکار به ریال)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            هر آرتیکل سند می‌تواند به ریال، دلار، یورو، یوان یا درهم ثبت شود و سیستم همزمان معادل ریالی را با نرخ تبدیل دلخواه محاسبه و تراز می‌کند.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">نرخ‌های مرجع روز:</span>
          {state.currencies
            .filter((c) => !c.isBase)
            .map((c, idx) => (
              <React.Fragment key={c.code}>
                {idx > 0 && <span className="text-slate-300">·</span>}
                <span className="font-mono-num">
                  {c.code}: <strong className="text-blue-700">{formatNumber(c.defaultRateToIRR)}</strong> ریال
                </span>
              </React.Fragment>
            ))}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:opacity-80"
          >
            بستن پیام
          </button>
        </div>
      )}

      {/* Voucher Entry Form */}
      <form onSubmit={handleSubmitVoucher} className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              شماره سند اتوماتیک
            </label>
            <input
              type="text"
              readOnly
              value={nextNumber}
              aria-label="شماره سند اتوماتیک"
              className="w-full px-3 py-2 text-xs font-mono-num font-bold bg-slate-100 border border-slate-300 rounded text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              تاریخ سند (شمسی)
            </label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="تاریخ سند"
              className="w-full px-3 py-2 text-xs font-mono-num bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              شماره عطف / پیگیری
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="مثلاً: INV-105 یا SW-902"
              aria-label="شماره عطف"
              className="w-full px-3 py-2 text-xs font-mono-num bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نوع سند حسابداری
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'temporary' | 'permanent')}
              aria-label="نوع سند حسابداری"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
            >
              <option value="permanent">سند قطعی / دائم</option>
              <option value="temporary">سند موقت (قابل ویرایش)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              شرح کلی سند حسابداری *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شرح کامل رویداد مالی ارزی یا ریالی..."
              aria-label="شرح کلی سند حسابداری"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Voucher Lines Data Grid */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                <th className="py-2.5 px-1.5 w-7 text-center">#</th>
                <th className="py-2.5 px-1.5 w-40">سرفصل حساب معین</th>
                <th className="py-2.5 px-1.5 w-36">شخص (تفضیلی) / بانک</th>
                <th className="py-2.5 px-1.5 w-32">شرح آرتیکل</th>
                <th className="py-2.5 px-1.5 w-24">نوع ارز</th>
                <th className="py-2.5 px-1.5 w-28">نرخ تبدیل به ریال</th>
                <th className="py-2.5 px-1.5 w-24">بدهکار ارزی</th>
                <th className="py-2.5 px-1.5 w-24">بستانکار ارزی</th>
                <th className="py-2.5 px-1.5 w-32 bg-blue-50/60 text-blue-950">معادل بدهکار (ریال)</th>
                <th className="py-2.5 px-1.5 w-32 bg-blue-50/60 text-blue-950">معادل بستانکار (ریال)</th>
                <th className="py-2.5 px-1.5 w-8 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {lines.map((line, index) => {
                const isIRR = line.currency === 'IRR';
                return (
                  <tr key={line.id} className="hover:bg-slate-50/80">
                    <td className="p-2 text-center font-mono-num text-slate-500">
                      {index + 1}
                    </td>
                    <td className="p-2">
                      <select
                        value={line.accountCode}
                        onChange={(e) =>
                          handleUpdateLine(index, { accountCode: e.target.value })
                        }
                        aria-label={`سرفصل ردیف ${index + 1}`}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                      >
                        {moeinAccounts.map((acc) => (
                          <option key={acc.code} value={acc.code}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 space-y-1">
                      <select
                        value={line.contactId || ''}
                        onChange={(e) =>
                          handleUpdateLine(index, {
                            contactId: e.target.value || undefined,
                          })
                        }
                        aria-label={`طرف حساب ردیف ${index + 1}`}
                        className="w-full px-2 py-1 text-[11px] bg-white border border-slate-300 rounded"
                      >
                        <option value="">-- بدون شخص --</option>
                        {state.contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.defaultCurrency})
                          </option>
                        ))}
                      </select>
                      <select
                        value={line.bankId || ''}
                        onChange={(e) =>
                          handleUpdateLine(index, {
                            bankId: e.target.value || undefined,
                          })
                        }
                        aria-label={`بانک ردیف ${index + 1}`}
                        className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded"
                      >
                        <option value="">-- بدون بانک --</option>
                        {state.banks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bankName} ({b.currency})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) =>
                          handleUpdateLine(index, { description: e.target.value })
                        }
                        placeholder="شرح ردیف..."
                        aria-label={`شرح ردیف ${index + 1}`}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={line.currency}
                        onChange={(e) =>
                          handleUpdateLine(index, { currency: e.target.value })
                        }
                        aria-label={`ارز ردیف ${index + 1}`}
                        className="w-full px-2 py-1.5 text-xs font-mono-num font-bold bg-white border border-slate-300 rounded"
                      >
                        {state.currencies.map((curr) => (
                          <option key={curr.code} value={curr.code}>
                            {curr.code} ({curr.symbol})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <FormattedNumberInput
                        disabled={isIRR}
                        value={line.exchangeRate}
                        allowDecimals={false}
                        onChange={(val) =>
                          handleUpdateLine(index, {
                            exchangeRate: val || 0,
                          })
                        }
                        ariaLabel={`نرخ تبدیل ردیف ${index + 1}`}
                        className={`w-full px-2 py-1.5 text-xs border rounded ${
                          isIRR
                            ? 'bg-slate-100 text-slate-400 border-slate-200'
                            : 'bg-amber-50/50 border-amber-300 text-slate-900 font-semibold'
                        }`}
                      />
                    </td>
                    <td className="p-2">
                      <FormattedNumberInput
                        value={line.debitForeign}
                        allowDecimals={!isIRR}
                        onChange={(val) =>
                          handleUpdateLine(index, {
                            debitForeign: val,
                            creditForeign: 0,
                          })
                        }
                        placeholder={isIRR ? '0' : '0.00'}
                        ariaLabel={`بدهکار ارزی ردیف ${index + 1}`}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded font-bold"
                      />
                    </td>
                    <td className="p-2">
                      <FormattedNumberInput
                        value={line.creditForeign}
                        allowDecimals={!isIRR}
                        onChange={(val) =>
                          handleUpdateLine(index, {
                            creditForeign: val,
                            debitForeign: 0,
                          })
                        }
                        placeholder={isIRR ? '0' : '0.00'}
                        ariaLabel={`بستانکار ارزی ردیف ${index + 1}`}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded font-bold"
                      />
                    </td>
                    <td dir="ltr" className="p-2 bg-blue-50/30 font-mono-num text-left font-bold text-slate-900">
                      {formatNumber(line.debitIRR)}
                    </td>
                    <td dir="ltr" className="p-2 bg-blue-50/30 font-mono-num text-left font-bold text-slate-900">
                      {formatNumber(line.creditIRR)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        disabled={lines.length <= 2}
                        onClick={() =>
                          setLines((prev) => prev.filter((_, idx) => idx !== index))
                        }
                        aria-label={`حذف ردیف ${index + 1}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                <td colSpan={6} className="py-3 px-3 text-left text-slate-700">
                  جمع کل سند و کنترل تراز استاندارد (ریالی و ارزی):
                </td>
                <td colSpan={2} className="py-3 px-2 text-left font-mono-num text-slate-700">
                  {Object.entries(balanceSummary.byCurrency).map(([curr, b]) => (
                    <div key={curr} className="text-[11px]">
                      {curr}: بدهکار {formatNumber(b.debitForeign, 2)} | بستانکار{' '}
                      {formatNumber(b.creditForeign, 2)}
                    </div>
                  ))}
                </td>
                <td className="py-3 px-2 text-left font-mono-num text-blue-900 bg-blue-100/60">
                  {formatNumber(balanceSummary.totalDebitIRR)} ریال
                </td>
                <td className="py-3 px-2 text-left font-mono-num text-blue-900 bg-blue-100/60">
                  {formatNumber(balanceSummary.totalCreditIRR)} ریال
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, createEmptyLine('USD')])}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              افزودن آرتیکل ارزی / ریالی
            </button>

            {balanceSummary.differenceIRR !== 0 && (
              <button
                type="button"
                onClick={handleAutoBalanceDifference}
                className="px-3.5 py-2 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 rounded border border-amber-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Calculator className="w-3.5 h-3.5" />
                تراز خودکار اختلاف ریالی ({formatNumber(Math.abs(balanceSummary.differenceIRR))} ریال)
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-slate-500" />
              <span>وضعیت تراز سند:</span>
              {balanceSummary.isBalancedIRR ? (
                <span className="font-bold text-emerald-700">
                  تراز کامل (اختلاف: ۰ ریال)
                </span>
              ) : (
                <span className="font-bold text-red-600 font-mono-num">
                  ناتراز (اختلاف: {formatNumber(Math.abs(balanceSummary.differenceIRR))} ریال)
                </span>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded shadow-xs flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              ثبت قطعی سند و تبدیل به ریال (F2)
            </button>
          </div>
        </div>
      </form>

      {/* Existing Vouchers Archive */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-700" />
              فهرست اسناد حسابداری ثبت شده (دفتر روزنامه دوارزی و ریالی)
            </h3>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'IRR', 'USD', 'AED', 'CNY', 'EUR'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setSelectedVoucherFilter(curr)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedVoucherFilter === curr
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {curr === 'ALL' ? 'همه اسناد' : `اسناد ${curr}`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredVouchers.map((voucher) => {
            const sum = calculateVoucherBalance(voucher.lines);
            return (
              <div
                key={voucher.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono-num">
                      سند شماره #{voucher.voucherNumber}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono-num text-slate-600">تاریخ: {voucher.date}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-800">{voucher.description}</span>
                    {voucher.referenceNumber && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono-num text-slate-500">
                          عطف: {voucher.referenceNumber}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono-num font-bold text-blue-800">
                      جمع تراز ریالی: {formatNumber(sum.totalDebitIRR)} ریال
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteVoucher(voucher.id)}
                      aria-label={`حذف سند ${voucher.voucherNumber}`}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100 text-[11px] text-slate-500">
                        <th className="py-1.5 px-3">کد و نام حساب معین</th>
                        <th className="py-1.5 px-3">تفضیلی (شخص / بانک)</th>
                        <th className="py-1.5 px-3">شرح آرتیکل</th>
                        <th className="py-1.5 px-3">ارز پایه</th>
                        <th className="py-1.5 px-3">نرخ تبدیل</th>
                        <th className="py-1.5 px-3 text-left">بدهکار ارزی</th>
                        <th className="py-1.5 px-3 text-left">بستانکار ارزی</th>
                        <th className="py-1.5 px-3 text-left bg-slate-50">بدهکار (ریال)</th>
                        <th className="py-1.5 px-3 text-left bg-slate-50">بستانکار (ریال)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {voucher.lines.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-medium text-slate-800">
                            <span className="font-mono-num text-slate-500 ml-1">{l.accountCode}</span>
                            {l.accountName}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {l.contactName || l.bankName || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{l.description}</td>
                          <td className="py-2 px-3 font-mono-num font-semibold text-blue-700">
                            {l.currency}
                          </td>
                          <td className="py-2 px-3 font-mono-num text-slate-600">
                            {formatNumber(l.exchangeRate)}
                          </td>
                          <td dir="ltr" className="py-2 px-3 font-mono-num text-left font-semibold">
                            {l.debitForeign > 0
                              ? `${formatCurrencyAmount(l.debitForeign, l.currency)} ${l.currency}`
                              : '—'}
                          </td>
                          <td dir="ltr" className="py-2 px-3 font-mono-num text-left font-semibold">
                            {l.creditForeign > 0
                              ? `${formatCurrencyAmount(l.creditForeign, l.currency)} ${l.currency}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono-num text-left font-semibold bg-slate-50/70">
                            {l.debitIRR > 0 ? formatNumber(l.debitIRR) : '0'}
                          </td>
                          <td className="py-2 px-3 font-mono-num text-left font-semibold bg-slate-50/70">
                            {l.creditIRR > 0 ? formatNumber(l.creditIRR) : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
