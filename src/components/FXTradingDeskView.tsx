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
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-teal-400" />
              ثبت سریع خرید و فروش ارز (با دریافت و پرداخت ترکیبی چند بانکی و چند صندوقی)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              ارز خریداری‌شده یا فروخته‌شده به صورت خودکار وارد/خارج صندوق ارزی شما می‌شود و تسویه ریالی یا ارزی آن نیز از بانک‌ها و صندوق‌های انتخابی شما کسر یا به آن‌ها واریز می‌گردد.
            </p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setDealType('buy')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                dealType === 'buy'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              خرید ارز (ورود ارز به صندوق/حساب ما)
            </button>
            <button
              type="button"
              onClick={() => setDealType('sell')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                dealType === 'sell'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              فروش ارز (خروج ارز از صندوق/حساب ما)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* طرف حساب */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">
                  {dealType === 'buy' ? 'خرید ارز از شخص / صرافی' : 'فروش ارز به شخص / مشتری'}
                </label>
                {onAddContact && (
                  <button
                    type="button"
                    onClick={() => setShowQuickContact(!showQuickContact)}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    + شخص جدید
                  </button>
                )}
              </div>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
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
              <label className="block text-xs text-slate-400 mb-1">نوع ارز مورد معامله</label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
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
              <label className="block text-xs text-slate-400 mb-1">
                {dealType === 'buy'
                  ? `صندوق/حساب ارزی دریافت‌کننده ${currency}`
                  : `صندوق/حساب ارزی پرداخت‌کننده ${currency}`}
              </label>
              <select
                value={targetVaultBankId}
                onChange={(e) => setTargetVaultBankId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
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
            <div className="bg-slate-950 border border-teal-500/40 rounded-xl p-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] text-teal-300 mb-1">نام شخص یا صرافی</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="مثلاً: صرافی پارسیان"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div className="w-48">
                <label className="block text-[11px] text-slate-400 mb-1">شماره تماس</label>
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono-num"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickCreateContact}
                className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                افزودن شخص
              </button>
            </div>
          )}

          {/* مقدار ارز، نرخ معامله و جمع ریالی */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                مقدار ارز ({currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={foreignAmount ? formatNumber(foreignAmount) : ''}
                onChange={(e) => setForeignAmount(parseFormattedNumber(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                نرخ توافقی هر ۱ {currency} (به ریال)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={dealRate ? formatNumber(dealRate) : ''}
                onChange={(e) => setDealRate(parseFormattedNumber(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">کارمزد انتقال (ریال - اختیاری)</label>
              <input
                type="text"
                inputMode="numeric"
                value={commissionIRR ? formatNumber(commissionIRR) : '0'}
                onChange={(e) => setCommissionIRR(parseFormattedNumber(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col justify-center bg-slate-900/90 border border-teal-500/30 rounded-lg px-3.5 py-2">
              <span className="text-[11px] text-slate-400">مبلغ کل ریالی معامله:</span>
              <span className="text-base font-bold text-teal-400 font-mono-num mt-0.5">
                {formatNumber(totalIRR)} ریال
              </span>
            </div>
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
                ? 'مشخص کنید پول فروش این ارز به کدام بانک‌ها یا صندوق‌های شما واریز شده است. هر مقدار که باقی بماند به حساب بدهکاری شخص منظور می‌شود.'
                : 'مشخص کنید پول خرید این ارز را از کدام بانک‌ها یا صندوق‌های خود پرداخت کرده‌اید. هر مقدار که باقی بماند به حساب طلب شخص از شما منظور می‌شود.'
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
              className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-lg cursor-pointer ${
                dealType === 'buy'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
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
        className="bg-slate-900/60 border border-slate-800 rounded-xl p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-teal-400" />
            فهرست معاملات خرید و فروش ارز ({formatNumber(fxDeals.length)})
          </h3>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-teal-400" />
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
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono-num font-bold text-teal-400 text-sm">
                      {d.dealNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                        d.type === 'buy'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {d.type === 'buy' ? 'خرید ارز' : 'فروش ارز'}
                    </span>
                    <span className="font-bold text-white text-sm">
                      {formatNumber(d.foreignAmount)} {d.currency}
                    </span>
                    <span className="text-xs text-slate-400">
                      با نرخ {formatNumber(d.exchangeRate)} ریال
                    </span>
                    <span className="text-xs text-teal-300 font-bold">
                      طرف حساب: {d.contactName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono-num">{d.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono-num">
                      کل: {formatNumber(d.totalIRR)} ریال
                    </span>
                    {onDeleteDeal && (
                      <button
                        type="button"
                        onClick={() => onDeleteDeal(d.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                        title="حذف معامله و سند مربوطه"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* نمایش ریز پرداخت یا دریافت ترکیبی */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 bg-slate-900/70 px-3 py-2 rounded-lg">
                  <div className="flex flex-wrap items-center gap-2">
                    <Landmark className="w-3.5 h-3.5 text-teal-400" />
                    <span>
                      تسویه بانک/صندوق:{' '}
                      <strong className="text-emerald-400 font-mono-num">
                        {formatNumber(paid)} ریال
                      </strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span>
                      مانده در حساب {d.contactName}:{' '}
                      <strong className="text-amber-400 font-mono-num">
                        {formatNumber(rem)} ریال
                      </strong>
                    </span>
                  </div>

                  {d.payments && d.payments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.payments.map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono-num"
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
