import React, { useState } from 'react';
import {
  FXDeal,
  Currency,
  Contact,
  BankAccount,
  CurrencyCode,
  PaymentSplitLine,
} from '../types/accounting';
import { formatNumber, parseFormattedNumber } from '../utils/accountingEngine';
import { MultiPaymentSplitsEditor } from './MultiPaymentSplitsEditor';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  CheckCircle2,
  Trash2,
  Landmark,
  UserPlus,
  Printer,
} from 'lucide-react';

interface FXTradingDeskViewProps {
  fxDeals: FXDeal[];
  currencies: Currency[];
  contacts: Contact[];
  banks: BankAccount[];
  onExecuteDeal: (deal: FXDeal) => void;
  onAddContact?: (contact: Contact) => void;
  onDeleteDeal?: (id: string) => void;
}

export const FXTradingDeskView: React.FC<FXTradingDeskViewProps> = ({
  fxDeals,
  currencies,
  contacts,
  banks,
  onExecuteDeal,
  onAddContact,
  onDeleteDeal,
}) => {
  const foreignCurrencies = currencies.filter((c) => c.code !== 'IRR');
  const [dealType, setDealType] = useState<'buy' | 'sell'>('buy');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [foreignAmount, setForeignAmount] = useState<number>(1000);

  const selectedCurrencyConfig = currencies.find((c) => c.code === currency);
  const [dealRate, setDealRate] = useState<number>(
    selectedCurrencyConfig?.defaultRateToIRR || 685000
  );
  const [commissionIRR, setCommissionIRR] = useState<number>(0);
  const [contactId, setContactId] = useState<string>(contacts[0]?.id || '');

  // صندوق یا حساب ارزی که ارز معامله‌شده به آن وارد یا از آن خارج می‌شود
  const matchingForeignBanks = banks.filter((b) => b.currency === currency);
  const [targetVaultBankId, setTargetVaultBankId] = useState<string>(
    matchingForeignBanks[0]?.id ||
      banks.find((b) => b.currency !== 'IRR')?.id ||
      banks[0]?.id ||
      ''
  );

  // ردیف‌های دریافت یا پرداخت معادل ریالی معامله (چند بانکی / چند صندوقی)
  const [payments, setPayments] = useState<PaymentSplitLine[]>([]);

  // تعریف سریع شخص
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const handleCurrencyChange = (code: CurrencyCode) => {
    setCurrency(code);
    const cfg = currencies.find((c) => c.code === code);
    if (cfg) setDealRate(cfg.defaultRateToIRR);
    const vaultForCur = banks.find((b) => b.currency === code);
    if (vaultForCur) setTargetVaultBankId(vaultForCur.id);
  };

  const baseTotalIRR = Math.round(foreignAmount * dealRate);
  const totalIRR =
    dealType === 'buy'
      ? baseTotalIRR + commissionIRR
      : Math.max(0, baseTotalIRR - commissionIRR);

  const selectedContact = contacts.find((c) => c.id === contactId);

  const handleQuickCreateContact = () => {
    if (!newContactName.trim() || !onAddContact) return;
    const newC: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${1006 + contacts.length}`,
      name: newContactName.trim(),
      type: 'both',
      phone: newContactPhone.trim(),
      defaultCurrency: currency,
      creditLimitIRR: 0,
    };
    onAddContact(newC);
    setContactId(newC.id);
    setNewContactName('');
    setNewContactPhone('');
    setShowQuickContact(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (foreignAmount <= 0 || dealRate <= 0 || !contactId) return;

    const validPayments = payments.filter((p) => p.bankId && p.amountIRR > 0);
    const paidSum = validPayments.reduce((s, p) => s + p.amountIRR, 0);
    const remSum = Math.max(0, totalIRR - paidSum);

    let settlementMethod: FXDeal['settlementMethod'] = 'credit_account';
    if (validPayments.length > 1) settlementMethod = 'multi_split';
    else if (paidSum >= totalIRR) settlementMethod = 'bank_transfer';
    else if (paidSum > 0) settlementMethod = 'multi_split';

    const newDeal: FXDeal = {
      id: `fx-${Date.now()}`,
      dealNumber: `FX-1404-${1002 + fxDeals.length}`,
      date: '1404/08/12',
      type: dealType,
      currency,
      foreignAmount,
      exchangeRate: dealRate,
      totalIRR,
      commissionIRR,
      contactId,
      contactName: selectedContact?.name || 'طرف حساب',
      settlementMethod,
      targetForeignBankId: targetVaultBankId,
      payments: validPayments,
      paidAmountIRR: paidSum,
      remainingAmountIRR: remSum,
      trackingNumber: `FX-${1002 + fxDeals.length}`,
      linkedVoucherId: `vch-fx-${Date.now()}`,
    };

    onExecuteDeal(newDeal);
    setPayments([]);
  };

  return (
    <div className="space-y-6">
      {/* فرم ثبت خرید یا فروش ارز با تسویه چند بانکی و چند صندوقی */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-teal-600" />
              ثبت سریع خرید و فروش ارز (با دریافت و پرداخت ترکیبی چند بانکی و چند صندوقی)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ارز خریداری‌شده یا فروخته‌شده به صورت خودکار وارد/خارج صندوق ارزی شما می‌شود و تسویه ریالی یا ارزی آن نیز از بانک‌ها و صندوق‌های انتخابی شما کسر یا به آن‌ها واریز می‌گردد.
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDealType('buy')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                dealType === 'buy'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>خرید ارز (ورود)</span>
            </button>
            <button
              type="button"
              onClick={() => setDealType('sell')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                dealType === 'sell'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>فروش ارز (خروج)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* طرف حساب */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  {dealType === 'buy' ? 'خرید ارز از شخص / صرافی' : 'فروش ارز به شخص / مشتری'}
                </label>
                {onAddContact && (
                  <button
                    type="button"
                    onClick={() => setShowQuickContact(!showQuickContact)}
                    className="text-[11px] text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    + شخص جدید
                  </button>
                )}
              </div>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* انتخاب نوع ارز */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع ارز مورد معامله</label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {foreignCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code}) — نرخ تابلو: {formatNumber(c.defaultRateToIRR)}
                  </option>
                ))}
              </select>
            </div>

            {/* صندوق یا حساب ارزی مقصد/مبدأ ارز */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dealType === 'buy'
                  ? `صندوق/حساب ارزی دریافت‌کننده ${currency}`
                  : `صندوق/حساب ارزی پرداخت‌کننده ${currency}`}
              </label>
              <select
                value={targetVaultBankId}
                onChange={(e) => setTargetVaultBankId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {banks
                  .filter((b) => b.currency === currency || b.currency !== 'IRR')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                      {b.bankName} ({b.currency})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {showQuickContact && (
            <div className="bg-slate-50 border border-teal-300 rounded-xl p-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold text-teal-900 mb-1">نام شخص یا صرافی</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="مثلاً: صرافی پارسیان"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div className="w-48">
                <label className="block text-[11px] text-slate-600 mb-1">شماره تماس</label>
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono-num"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickCreateContact}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer"
              >
                افزودن شخص
              </button>
            </div>
          )}

          {/* مقدار ارز، نرخ معامله و جمع ریالی */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مقدار ارز ({currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={foreignAmount ? formatNumber(foreignAmount) : ''}
                onChange={(e) => setForeignAmount(parseFormattedNumber(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نرخ توافقی هر ۱ {currency} (به ریال)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={dealRate ? formatNumber(dealRate) : ''}
                onChange={(e) => setDealRate(parseFormattedNumber(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">کارمزد انتقال (ریال - اختیاری)</label>
              <input
                type="text"
                inputMode="numeric"
                value={commissionIRR ? formatNumber(commissionIRR) : '0'}
                onChange={(e) => setCommissionIRR(parseFormattedNumber(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col justify-center bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2">
              <span className="text-[11px] text-teal-800 font-semibold">مبلغ کل ریالی معامله:</span>
              <span className="text-base font-bold text-teal-900 font-mono-num mt-0.5">
                {formatNumber(totalIRR)} ریال
              </span>
            </div>
          </div>

          {/* انتخاب نوع تسویه: نسیه کامل، تسویه کامل بانکی، یا ترکیبی */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800">
                نوع تسویه معامله ارزی (نسیه / نقدی / ترکیبی):
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPayments([])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    payments.length === 0
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-amber-800 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  🟡 معامله نسیه کامل (۱۰۰٪ در حساب دفتری شخص)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const defaultBank = banks.find((b) => b.currency === 'IRR') || banks[0];
                    if (!defaultBank) return;
                    setPayments([
                      {
                        id: `spl-full-${Date.now()}`,
                        bankId: defaultBank.id,
                        bankName: defaultBank.bankName,
                        currency: defaultBank.currency,
                        amountForeign: defaultBank.currency === 'IRR' ? totalIRR : Number((totalIRR / dealRate).toFixed(2)),
                        exchangeRate: defaultBank.currency === 'IRR' ? 1 : dealRate,
                        amountIRR: totalIRR,
                        trackingNumber: '',
                        description: `تسویه کامل معامله ${currency}`,
                      },
                    ]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    payments.length > 0 && payments.reduce((s, p) => s + p.amountIRR, 0) >= totalIRR
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-emerald-800 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  🟢 تسویه کامل فوری (بانک / صندوق)
                </button>
              </div>
            </div>

            {payments.length === 0 && (
              <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                📌 <strong>حالت نسیه فعال است:</strong> هیچ وجهی از بانک‌ها و صندوق‌ها کسر یا واریز نمی‌شود. مبلغ کامل <strong>{formatNumber(totalIRR)} ریال ({foreignAmount} {currency})</strong> مستقیماً به عنوان {dealType === 'buy' ? 'طلب شما از' : 'بدهی شما به'} <strong>{selectedContact?.name || 'طرف حساب'}</strong> در دفتر حساب شخص ثبت می‌گردد.
              </p>
            )}
          </div>

          {/* بخش دریافت و پرداخت ترکیبی چند بانکی و چند صندوقی برای تسویه این معامله ارز */}
          <MultiPaymentSplitsEditor
            title={
              dealType === 'sell'
                ? 'نحوه دریافت وجه ریالی/ارزی این فروش ارز (چند بانکی و چند صندوقی)'
                : 'نحوه پرداخت وجه ریالی/ارزی این خرید ارز (چند بانکی و چند صندوقی)'
            }
            subtitle={
              dealType === 'sell'
                ? 'مشخص کنید چه مقداری به بانک‌ها یا صندوق‌ها واریز شده است. مابقی مبلغ به صورت نسیه در حساب شخص ثبت می‌شود.'
                : 'مشخص کنید چه مقداری از بانک‌ها یا صندوق‌ها پرداخت شده است. مابقی مبلغ به صورت نسیه در حساب شخص ثبت می‌شود.'
            }
            totalTargetIRR={totalIRR}
            splits={payments}
            onChange={setPayments}
            banks={banks}
            currencies={currencies}
            mode={dealType === 'sell' ? 'receipt' : 'payment'}
            contactName={selectedContact?.name}
          />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg cursor-pointer ${
                dealType === 'buy'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {dealType === 'buy'
                ? `ثبت خرید ${formatNumber(foreignAmount)} ${currency} + سند اتوماتیک بانک و صندوق`
                : `ثبت فروش ${formatNumber(foreignAmount)} ${currency} + سند اتوماتیک بانک و صندوق`}
            </button>
          </div>
        </form>
      </div>

      {/* تاریخچه معاملات ارزی ثبت شده */}
      <div
        id="fx-deals-print"
        className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-teal-600" />
            فهرست معاملات خرید و فروش ارز ({formatNumber(fxDeals.length)})
          </h3>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-800 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-teal-600" />
            چاپ / PDF لیست معاملات ارز
          </button>
        </div>

        <div className="space-y-3">
          {fxDeals.map((d) => {
            const paid =
              d.paidAmountIRR ?? (d.settlementMethod !== 'credit_account' ? d.totalIRR : 0);
            const rem = d.remainingAmountIRR ?? Math.max(0, d.totalIRR - paid);

            return (
              <div
                key={d.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-num font-bold text-teal-700 text-xs sm:text-sm">
                      {d.dealNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        d.type === 'buy'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {d.type === 'buy' ? 'خرید ارز' : 'فروش ارز'}
                    </span>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm font-mono-num">
                      {formatNumber(d.foreignAmount)} {d.currency}
                    </span>
                    <span className="text-xs text-slate-600 font-mono-num">
                      (نرخ: {formatNumber(d.exchangeRate)})
                    </span>
                    <span className="text-xs text-slate-800 font-bold">
                      {d.contactName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono-num">{d.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono-num">
                      کل: {formatNumber(d.totalIRR)} ریال
                    </span>
                    {onDeleteDeal && (
                      <button
                        type="button"
                        onClick={() => onDeleteDeal(d.id)}
                        className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                        title="حذف معامله و سند مربوطه"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* نمایش ریز پرداخت یا دریافت ترکیبی */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <Landmark className="w-3.5 h-3.5 text-teal-600" />
                    <span>
                      تسویه بانک/صندوق:{' '}
                      <strong className="text-emerald-700 font-mono-num">
                        {formatNumber(paid)} ریال
                      </strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      مانده در حساب {d.contactName}:{' '}
                      <strong className="text-amber-700 font-mono-num">
                        {formatNumber(rem)} ریال
                      </strong>
                    </span>
                  </div>

                  {d.payments && d.payments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.payments.map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono-num"
                        >
                          {p.bankName}:{' '}
                          {p.currency === 'IRR'
                            ? `${formatNumber(p.amountIRR)} ریال`
                            : `${formatNumber(p.amountForeign)} ${p.currency} (نرخ ${formatNumber(
                                p.exchangeRate
                              )})`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
