import React from 'react';
import { BankAccount, CurrencyCode, Currency, PaymentSplitLine } from '../types/accounting';
import { formatNumber, parseFormattedNumber } from '../utils/accountingEngine';
import { Plus, Trash2, Landmark, Wallet, CheckCircle2, Coins, ArrowLeftRight } from 'lucide-react';

interface MultiPaymentSplitsEditorProps {
  title: string;
  subtitle?: string;
  totalTargetIRR: number;
  splits: PaymentSplitLine[];
  onChange: (splits: PaymentSplitLine[]) => void;
  banks: BankAccount[];
  currencies: Currency[];
  mode: 'receipt' | 'payment'; // receipt = دریافت (ورود به بانک/صندوق), payment = پرداخت (خروج از بانک/صندوق)
  contactName?: string;
}

export const MultiPaymentSplitsEditor: React.FC<MultiPaymentSplitsEditorProps> = ({
  title,
  subtitle,
  totalTargetIRR,
  splits,
  onChange,
  banks,
  currencies,
  mode,
  contactName,
}) => {
  const getRateForCurrency = (code: CurrencyCode): number => {
    if (code === 'IRR') return 1;
    const found = currencies.find((c) => c.code === code);
    return found ? found.defaultRateToIRR : 1;
  };

  const totalPaidIRR = splits.reduce((sum, s) => sum + (Number(s.amountIRR) || 0), 0);
  const remainingIRR = Math.max(0, totalTargetIRR - totalPaidIRR);
  const overpaidIRR = Math.max(0, totalPaidIRR - totalTargetIRR);

  const handleAddSplit = (prefillRemaining: boolean = false) => {
    const defaultBank = banks.find((b) => b.currency === 'IRR') || banks[0];
    if (!defaultBank) return;

    const cur = defaultBank.currency;
    const rate = getRateForCurrency(cur);
    const targetRem = prefillRemaining && remainingIRR > 0 ? remainingIRR : 0;
    const amountForeign =
      cur === 'IRR' ? targetRem : rate > 0 ? Number((targetRem / rate).toFixed(2)) : 0;
    const amountIRR = cur === 'IRR' ? targetRem : Math.round(amountForeign * rate);

    const newSplit: PaymentSplitLine = {
      id: `spl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bankId: defaultBank.id,
      bankName: defaultBank.bankName,
      currency: cur,
      amountForeign,
      exchangeRate: rate,
      amountIRR,
      trackingNumber: '',
      description: '',
    };

    onChange([...splits, newSplit]);
  };

  const handleUpdateSplit = (id: string, patch: Partial<PaymentSplitLine>) => {
    const updated = splits.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };

      // اگر بانک تغییر کرد، نام بانک و ارز پیش‌فرض آن بانک را تنظیم کن
      if (patch.bankId && patch.bankId !== item.bankId) {
        const selectedBank = banks.find((b) => b.id === patch.bankId);
        if (selectedBank) {
          next.bankName = selectedBank.bankName;
          next.currency = selectedBank.currency;
          next.exchangeRate = getRateForCurrency(selectedBank.currency);
          if (next.currency === 'IRR') {
            next.amountForeign = next.amountIRR || 0;
          } else if (next.amountIRR > 0 && next.exchangeRate > 0 && !patch.amountForeign) {
            next.amountForeign = Number((next.amountIRR / next.exchangeRate).toFixed(2));
          }
        }
      }

      // اگر ارز به صورت دستی تغییر کرد، نرخ پیش‌فرض آن ارز را قرار بده
      if (patch.currency && patch.currency !== item.currency) {
        next.exchangeRate = getRateForCurrency(patch.currency);
      }

      // محاسبه خودکار معادل ریالی
      if (next.currency === 'IRR') {
        next.exchangeRate = 1;
        next.amountIRR = Math.round(Number(next.amountForeign) || 0);
      } else {
        const f = Number(next.amountForeign) || 0;
        const r = Number(next.exchangeRate) || 0;
        next.amountIRR = Math.round(f * r);
      }

      return next;
    });
    onChange(updated);
  };

  const handleFillRemainingOnRow = (id: string) => {
    const row = splits.find((s) => s.id === id);
    if (!row) return;
    const otherPaid = splits
      .filter((s) => s.id !== id)
      .reduce((sum, s) => sum + (s.amountIRR || 0), 0);
    const neededIRR = Math.max(0, totalTargetIRR - otherPaid);
    if (row.currency === 'IRR') {
      handleUpdateSplit(id, { amountForeign: neededIRR });
    } else {
      const rate = row.exchangeRate > 0 ? row.exchangeRate : getRateForCurrency(row.currency);
      const foreignAmt = rate > 0 ? Number((neededIRR / rate).toFixed(2)) : 0;
      handleUpdateSplit(id, { amountForeign: foreignAmt, exchangeRate: rate });
    }
  };

  const handleRemoveSplit = (id: string) => {
    onChange(splits.filter((s) => s.id !== id));
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-teal-600" />
            {title}
          </h4>
          {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalTargetIRR > 0 && remainingIRR > 0 && (
            <button
              type="button"
              onClick={() => handleAddSplit(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {splits.length === 0
                ? `تسویه کامل (${formatNumber(remainingIRR)} ریال)`
                : `افزودن ردیف برای الباقی (${formatNumber(remainingIRR)} ریال)`}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleAddSplit(false)}
            className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />
            افزودن بانک یا صندوق (ترکیبی)
          </button>
        </div>
      </div>

      {splits.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-4 text-center">
          <p className="text-xs text-slate-600">
            هیچ ردیف {mode === 'receipt' ? 'دریافتی' : 'پرداختی'} ثبت نشده است.{' '}
            {totalTargetIRR > 0
              ? `در صورت عدم ثبت، کل مبلغ (${formatNumber(totalTargetIRR)} ریال) به عنوان نسیه در حساب ${
                  contactName || 'شخص'
                } منظور می‌شود.`
              : 'برای ثبت دریافت یا پرداخت از دکمه‌های بالا استفاده کنید.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {splits.map((split, idx) => {
            const selectedBank = banks.find((b) => b.id === split.bankId);
            const isForeign = split.currency !== 'IRR';

            return (
              <div
                key={split.id}
                className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 relative transition hover:border-slate-300 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                    {selectedBank?.kind === 'cash_box' ? (
                      <Wallet className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Landmark className="w-3.5 h-3.5 text-teal-600" />
                    )}
                    ردیف {idx + 1}: {mode === 'receipt' ? 'واریز به' : 'برداشت از'}{' '}
                    {selectedBank?.bankName || 'بانک / صندوق'}
                  </span>
                  <div className="flex items-center gap-2">
                    {totalTargetIRR > 0 && (
                      <button
                        type="button"
                        onClick={() => handleFillRemainingOnRow(split.id)}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                      >
                        قرار دادن کل الباقی در این ردیف
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(split.id)}
                      className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                      title="حذف این ردیف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* انتخاب بانک یا صندوق */}
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      انتخاب بانک یا صندوق ({mode === 'receipt' ? 'مقصد واریز' : 'مبدأ پرداخت'})
                    </label>
                    <select
                      value={split.bankId}
                      onChange={(e) => handleUpdateSplit(split.id, { bankId: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                          {b.bankName} ({b.currency === 'IRR' ? 'ریالی' : `ارزی ${b.currency}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* نوع ارز پرداختی / دریافتی */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">نوع پول / ارز</label>
                    <select
                      value={split.currency}
                      onChange={(e) =>
                        handleUpdateSplit(split.id, { currency: e.target.value as CurrencyCode })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      <option value="IRR">ریال ایران (IRR)</option>
                      {currencies
                        .filter((c) => c.code !== 'IRR')
                        .map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* مبلغ */}
                  <div className={isForeign ? 'md:col-span-2' : 'md:col-span-4'}>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      {isForeign ? `مبلغ ارزی (${split.currency})` : 'مبلغ (ریال)'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={split.amountForeign ? formatNumber(split.amountForeign) : ''}
                      onChange={(e) =>
                        handleUpdateSplit(split.id, {
                          amountForeign: parseFormattedNumber(e.target.value),
                        })
                      }
                      placeholder={isForeign ? 'مثلاً 1,000' : 'مثلاً 50,000,000'}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  {/* اگر ارزی بود: تعیین نرخ ارزش ارز به ریال */}
                  {isForeign && (
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-amber-800 mb-1 flex items-center gap-1">
                        <Coins className="w-3 h-3 text-amber-600" />
                        ارزش هر واحد (ریال)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={split.exchangeRate ? formatNumber(split.exchangeRate) : ''}
                        onChange={(e) =>
                          handleUpdateSplit(split.id, {
                            exchangeRate: parseFormattedNumber(e.target.value),
                          })
                        }
                        placeholder="نرخ به ریال"
                        className="w-full bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-2 text-xs text-amber-900 font-mono-num focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                      />
                    </div>
                  )}

                  {/* شماره پیگیری / توضیح کوتاه */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">شماره پیگیری / فیش</label>
                    <input
                      type="text"
                      value={split.trackingNumber || ''}
                      onChange={(e) =>
                        handleUpdateSplit(split.id, { trackingNumber: e.target.value })
                      }
                      placeholder="اختیاری"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                </div>

                {/* نمایش معادل ریالی در صورت ارزی بودن */}
                {isForeign && (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-amber-900 font-medium flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
                      محاسبه خودکار ارزش ریالی این ردیف ارزی ({formatNumber(split.amountForeign)}{' '}
                      {split.currency} × {formatNumber(split.exchangeRate)} ریال):
                    </span>
                    <span className="font-extrabold text-amber-900 font-mono-num">
                      {formatNumber(split.amountIRR)} ریال
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* نوار خلاصه وضعیت تسویه */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
        {totalTargetIRR > 0 && (
          <div className="bg-white rounded-lg p-2.5 border border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-600">مبلغ کل فاکتور / معامله:</span>
            <span className="text-xs font-bold text-slate-900 font-mono-num">
              {formatNumber(totalTargetIRR)} ریال
            </span>
          </div>
        )}

        <div className="bg-teal-50 rounded-lg p-2.5 border border-teal-200 flex items-center justify-between">
          <span className="text-xs font-bold text-teal-900">
            جمع {mode === 'receipt' ? 'دریافتی (واریز به بانک/صندوق)' : 'پرداختی (خروج از بانک/صندوق)'}:
          </span>
          <span className="text-xs font-extrabold text-teal-800 font-mono-num">
            {formatNumber(totalPaidIRR)} ریال
          </span>
        </div>

        {totalTargetIRR > 0 && (
          <div
            className={`rounded-lg p-2.5 border flex items-center justify-between ${
              remainingIRR === 0 && overpaidIRR === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <span className="text-xs font-bold">
              {overpaidIRR > 0
                ? 'مبلغ مازاد پرداختی (بستانکاری شخص):'
                : remainingIRR === 0
                ? 'وضعیت تسویه:'
                : `مانده در حساب ${contactName || 'شخص'} (نسیه):`}
            </span>
            <span className="text-xs font-extrabold font-mono-num">
              {overpaidIRR > 0
                ? `${formatNumber(overpaidIRR)} ریال`
                : remainingIRR === 0
                ? 'تسویه کامل شد ✓'
                : `${formatNumber(remainingIRR)} ریال`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
