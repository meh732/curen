import React, { useState, useMemo } from 'react';
import {
  FXDeal,
  Currency,
  Contact,
  BankAccount,
  CurrencyCode,
  PaymentSplitLine,
  JournalVoucher,
} from '../types/accounting';
import {
  formatNumber,
  formatCurrencyAmount,
  parseFormattedNumber,
  buildPersonStatement,
} from '../utils/accountingEngine';
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
  Eye,
  X,
  ShieldCheck,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

interface FXTradingDeskViewProps {
  fxDeals: FXDeal[];
  currencies: Currency[];
  contacts: Contact[];
  banks: BankAccount[];
  vouchers?: JournalVoucher[];
  companyName?: string;
  onExecuteDeal: (deal: FXDeal) => void;
  onAddContact?: (contact: Contact) => void;
  onDeleteDeal?: (id: string) => void;
}

export const FXTradingDeskView: React.FC<FXTradingDeskViewProps> = ({
  fxDeals,
  currencies,
  contacts,
  banks,
  vouchers = [],
  companyName = 'صرافی و خدمات ارزی ترازبان',
  onExecuteDeal,
  onAddContact,
  onDeleteDeal,
}) => {
  const foreignCurrencies = currencies.filter((c) => c.code !== 'IRR');
  const [dealType, setDealType] = useState<'buy' | 'sell'>('buy');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [foreignAmount, setForeignAmount] = useState<number>(1000);
  const [dealDate, setDealDate] = useState<string>('1404/08/12');
  const [dealNotes, setDealNotes] = useState<string>('');

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

  // بنر تایید فوری پس از ثبت معامله + مودال مشاهده رسید معامله
  const [lastCreatedDeal, setLastCreatedDeal] = useState<FXDeal | null>(null);
  const [previewDeal, setPreviewDeal] = useState<FXDeal | null>(null);

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

  const selectedContact = contacts.find((c) => c.id === contactId) || contacts[0];

  // محاسبه وضعیت فعلی مشتری قبل از ثبت این معامله (برای جلوگیری از کلاه رفتن سر کاربر)
  const currentCustomerStatement = useMemo(() => {
    if (!selectedContact) return null;
    return buildPersonStatement(vouchers, selectedContact.id, 'ALL');
  }, [vouchers, selectedContact]);

  const validPayments = useMemo(
    () => payments.filter((p) => p.bankId && p.amountIRR > 0),
    [payments]
  );
  const paidSumIRR = useMemo(
    () => validPayments.reduce((s, p) => s + p.amountIRR, 0),
    [validPayments]
  );
  const remainingIRR = Math.max(0, totalIRR - paidSumIRR);

  // محاسبه مانده جدید مشتری بعد از این معامله به زبان ساده
  const projectedBalanceInfo = useMemo(() => {
    const prevSigned =
      currentCustomerStatement?.finalStatusIRR === 'بدهکار'
        ? currentCustomerStatement.finalBalanceIRR
        : currentCustomerStatement?.finalStatusIRR === 'بستانکار'
        ? -currentCustomerStatement.finalBalanceIRR
        : 0;

    // اگر به مشتری ارز می‌فروشیم (sell): مشتری به اندازه remainingIRR به ما بدهکارتر می‌شود (+remainingIRR)
    // اگر از مشتری ارز می‌خریم (buy): ما به اندازه remainingIRR به مشتری بدهکارتر می‌شویم (-remainingIRR)
    const deltaSigned = dealType === 'sell' ? remainingIRR : -remainingIRR;
    const nextSigned = prevSigned + deltaSigned;

    return {
      absBalance: Math.abs(nextSigned),
      statusLabel:
        nextSigned > 0
          ? 'بدهکار به ما (باید به ما پول بدهد)'
          : nextSigned < 0
          ? 'طلبکار از ما (ما باید به او پول بدهیم)'
          : 'تسویه کامل (بی‌حساب)',
      badgeColor:
        nextSigned > 0
          ? 'text-emerald-800 bg-emerald-100 border-emerald-300'
          : nextSigned < 0
          ? 'text-rose-800 bg-rose-100 border-rose-300'
          : 'text-slate-700 bg-slate-100 border-slate-300',
    };
  }, [currentCustomerStatement, dealType, remainingIRR]);

  const handleQuickCreateContact = () => {
    if (!newContactName.trim() || !onAddContact) return;
    const newC: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${1001 + contacts.length}`,
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
    const targetContact = selectedContact;
    if (foreignAmount <= 0 || dealRate <= 0 || !targetContact) return;

    let settlementMethod: FXDeal['settlementMethod'] = 'credit_account';
    if (validPayments.length > 1) settlementMethod = 'multi_split';
    else if (paidSumIRR >= totalIRR) settlementMethod = 'bank_transfer';
    else if (paidSumIRR > 0) settlementMethod = 'multi_split';

    const newDeal: FXDeal = {
      id: `fx-${Date.now()}`,
      dealNumber: `FX-1404-${1001 + fxDeals.length}`,
      date: dealDate || '1404/08/12',
      type: dealType,
      currency,
      foreignAmount,
      exchangeRate: dealRate,
      totalIRR,
      commissionIRR,
      contactId: targetContact.id,
      contactName: targetContact.name,
      settlementMethod,
      targetForeignBankId: targetVaultBankId,
      payments: validPayments,
      paidAmountIRR: paidSumIRR,
      remainingAmountIRR: remainingIRR,
      trackingNumber: `FX-${1001 + fxDeals.length}`,
      linkedVoucherId: `vch-fx-${Date.now()}`,
      notes: dealNotes.trim() || undefined,
    };

    onExecuteDeal(newDeal);
    setLastCreatedDeal(newDeal);
    setPayments([]);
    setDealNotes('');
  };

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* بنر تایید فوری پس از ثبت معامله ارز */}
      {lastCreatedDeal && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 shadow-md space-y-3 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-extrabold text-emerald-950">
                    معامله {lastCreatedDeal.type === 'buy' ? 'خرید ارز' : 'فروش ارز'} با موفقیت ثبت شد!
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 font-mono-num font-extrabold text-xs text-emerald-900">
                    شماره رسید: {lastCreatedDeal.dealNumber}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-0.5 font-medium">
                  حساب <strong>{lastCreatedDeal.contactName}</strong> و موجودی خزانه ارزی به صورت خودکار بروزرسانی شد.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLastCreatedDeal(null)}
              className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white p-3 rounded-xl border border-emerald-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">مشتری / طرف حساب:</span>
              <strong className="text-slate-900 font-extrabold">{lastCreatedDeal.contactName}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">مقدار و نرخ ارز:</span>
              <strong className="text-slate-900 font-mono-num font-extrabold">
                {formatNumber(lastCreatedDeal.foreignAmount)} {lastCreatedDeal.currency} (نرخ:{' '}
                {formatNumber(lastCreatedDeal.exchangeRate)})
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">مبلغ کل معامله:</span>
              <strong className="text-teal-800 font-mono-num font-extrabold">
                {formatNumber(lastCreatedDeal.totalIRR)} ریال
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">مانده نسیه در حساب شخص:</span>
              <strong className="text-amber-800 font-mono-num font-extrabold">
                {formatNumber(lastCreatedDeal.remainingAmountIRR || 0)} ریال
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPreviewDeal(lastCreatedDeal)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              مشاهده و چاپ رسید معامله ({lastCreatedDeal.dealNumber})
            </button>
          </div>
        </div>
      )}

      {/* فرم ثبت خرید یا فروش ارز به زبان ساده */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500 shrink-0" />
              ثبت خرید و فروش ارز (دلار، یورو، درهم و ...)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              کافیست مشخص کنید از چه کسی ارز می‌خرید یا به چه کسی می‌فروشید؛ حساب شخص و سود شما خودکار محاسبه می‌شود.
            </p>
          </div>

          {/* کلید بزرگ انتخاب خرید یا فروش */}
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto gap-1">
            <button
              type="button"
              onClick={() => setDealType('buy')}
              className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                dealType === 'buy'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 shrink-0" />
              <span>۱. خرید ارز از مشتری</span>
            </button>
            <button
              type="button"
              onClick={() => setDealType('sell')}
              className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                dealType === 'sell'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 shrink-0" />
              <span>۲. فروش ارز به مشتری</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ردیف اول: مشتری، نوع ارز، تاریخ و صندوق ارزی */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* انتخاب طرف حساب */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-extrabold text-slate-700">
                  {dealType === 'buy' ? 'فروشنده ارز (مشتری / همکار):' : 'خریدار ارز (مشتری / شخص):'}
                </label>
                {onAddContact && (
                  <button
                    type="button"
                    onClick={() => setShowQuickContact(!showQuickContact)}
                    className="text-[11px] text-teal-700 hover:text-teal-800 font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + مشتری جدید
                  </button>
                )}
              </div>
              {contacts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setShowQuickContact(true)}
                  className="w-full py-2 px-3 rounded-xl border-2 border-dashed border-teal-400 bg-teal-50 text-teal-900 font-bold text-xs cursor-pointer"
                >
                  + ابتدا نام اولین مشتری را ثبت کنید
                </button>
              ) : (
                <select
                  value={selectedContact?.id || ''}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* انتخاب نوع ارز */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                نوع ارز مورد معامله:
              </label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {foreignCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code}) — نرخ پیش‌فرض: {formatNumber(c.defaultRateToIRR)}
                  </option>
                ))}
              </select>
            </div>

            {/* صندوق یا حساب ارزی */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                {dealType === 'buy'
                  ? `ورود ${currency} به کدام صندوق/حساب؟`
                  : `خروج ${currency} از کدام صندوق/حساب؟`}
              </label>
              <select
                value={targetVaultBankId}
                onChange={(e) => setTargetVaultBankId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {banks.length === 0 ? (
                  <option value="">صندوق ارزی پیش‌فرض صرافی</option>
                ) : (
                  banks
                    .filter((b) => b.currency === currency || b.currency !== 'IRR')
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                        {b.bankName} ({b.currency})
                      </option>
                    ))
                )}
              </select>
            </div>

            {/* تاریخ معامله */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                تاریخ معامله:
              </label>
              <input
                type="text"
                value={dealDate}
                onChange={(e) => setDealDate(e.target.value)}
                placeholder="1404/08/12"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono-num font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* فرم سریع تعریف مشتری جدید */}
          {showQuickContact && (
            <div className="bg-teal-50/70 border border-teal-300 rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-extrabold text-teal-950 mb-1">
                  نام مشتری یا همکار جدید *
                </label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="مثلاً: محمدی - بازار یا صرافی پارسیان"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
              <div className="sm:w-48">
                <label className="block text-xs font-bold text-slate-700 mb-1">شماره موبایل</label>
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="0912..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono-num"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickCreateContact}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs cursor-pointer"
                >
                  ذخیره و انتخاب مشتری
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickContact(false)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-600 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          {/* نوار نمایش وضعیت فعلی حساب این مشتری قبل از معامله */}
          {selectedContact && currentCustomerStatement && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-slate-600 font-medium">
                  وضعیت فعلی حساب <strong className="text-slate-900">{selectedContact.name}</strong> قبل از این معامله:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono-num">
                <span
                  className={`px-2.5 py-0.5 rounded-lg font-extrabold border ${
                    currentCustomerStatement.finalStatusIRR === 'بدهکار'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : currentCustomerStatement.finalStatusIRR === 'بستانکار'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {currentCustomerStatement.finalStatusIRR === 'تسویه'
                    ? 'حساب ریالی تسویه کامل (۰ ریال)'
                    : `${formatNumber(currentCustomerStatement.finalBalanceIRR)} ریال (${
                        currentCustomerStatement.finalStatusIRR === 'بدهکار'
                          ? 'بدهکار به ما / طلب ما'
                          : 'طلبکار از ما / بدهی ما'
                      })`}
                </span>
                {Object.entries(currentCustomerStatement.currencyBreakdown).map(([cur, b]) =>
                  b.balanceForeign > 0 ? (
                    <span
                      key={cur}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-[11px]"
                    >
                      {formatCurrencyAmount(b.balanceForeign, cur)} {cur} ({b.status})
                    </span>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* مقدار ارز، نرخ معامله و جمع ریالی */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                تعداد / مقدار ارز ({currency}):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={foreignAmount ? formatNumber(foreignAmount) : ''}
                onChange={(e) => setForeignAmount(parseFormattedNumber(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                نرخ توافقی هر ۱ {currency} (به ریال):
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={dealRate ? formatNumber(dealRate) : ''}
                onChange={(e) => setDealRate(parseFormattedNumber(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کارمزد یا هزینه جانبی (ریال - اختیاری):
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={commissionIRR ? formatNumber(commissionIRR) : '0'}
                onChange={(e) => setCommissionIRR(parseFormattedNumber(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col justify-center bg-teal-50 border border-teal-200 rounded-xl px-3.5 py-2.5">
              <span className="text-[11px] text-teal-800 font-bold">جمع کل معامله به ریال:</span>
              <span className="text-base sm:text-lg font-extrabold text-teal-950 font-mono-num mt-0.5">
                {formatNumber(totalIRR)} ریال
              </span>
            </div>
          </div>

          {/* انتخاب سریع نحوه تسویه معامله */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-extrabold text-slate-800">
                پول این معامله چطور تسویه می‌شود؟
              </label>
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPayments([])}
                  className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    payments.length === 0
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-amber-800 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  🟡 نسیه / دفتری (بماند در حساب شخص)
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
                        amountForeign:
                          defaultBank.currency === 'IRR'
                            ? totalIRR
                            : Number((totalIRR / dealRate).toFixed(2)),
                        exchangeRate: defaultBank.currency === 'IRR' ? 1 : dealRate,
                        amountIRR: totalIRR,
                        trackingNumber: '',
                        description: `تسویه کامل معامله ${currency}`,
                      },
                    ]);
                  }}
                  className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    payments.length > 0 && paidSumIRR >= totalIRR
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-emerald-800 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  🟢 تسویه نقدی/بانکی کامل همین الان
                </button>
              </div>
            </div>
          </div>

          {/* بخش دریافت و پرداخت ترکیبی چند بانکی و چند صندوقی برای تسویه این معامله ارز */}
          <MultiPaymentSplitsEditor
            title={
              dealType === 'sell'
                ? 'مبلغ دریافتی از مشتری بابت این فروش ارز (اگر بخشی یا کل پول را الان داده است)'
                : 'مبلغ پرداختی شما به مشتری بابت این خرید ارز (اگر بخشی یا کل پول را الان داده‌اید)'
            }
            subtitle={
              dealType === 'sell'
                ? 'اگر مشتری پولی واریز کرده اینجا وارد کنید؛ هر چقدر باقی بماند خودکار به عنوان بدهی مشتری ثبت می‌شود.'
                : 'اگر پولی به فروشنده پرداخت کرده‌اید اینجا وارد کنید؛ هر چقدر باقی بماند خودکار به عنوان طلب فروشنده از شما ثبت می‌شود.'
            }
            totalTargetIRR={totalIRR}
            splits={payments}
            onChange={setPayments}
            banks={banks}
            currencies={currencies}
            mode={dealType === 'sell' ? 'receipt' : 'payment'}
            contactName={selectedContact?.name}
          />

          {/* توضیحات اختیاری */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              توضیحات یا شماره پیگیری معامله (اختیاری):
            </label>
            <input
              type="text"
              value={dealNotes}
              onChange={(e) => setDealNotes(e.target.value)}
              placeholder="مثلاً: تحویل نقدی در دفتر یا حواله صرافی..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          {/* باکس خلاصه ضد اشتباه به زبان خودمانی قبل از ثبت */}
          <div className="bg-blue-50/70 border-2 border-blue-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-blue-950">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>خلاصه ساده این معامله (قبل از ثبت بررسی کنید تا اشتباهی رخ ندهد):</span>
            </div>

            <p className="text-xs text-slate-800 leading-relaxed">
              شما در حال{' '}
              <strong className={dealType === 'buy' ? 'text-emerald-800' : 'text-amber-800'}>
                {dealType === 'buy' ? 'خرید' : 'فروش'} {formatNumber(foreignAmount)} {currency}
              </strong>{' '}
              با نرخ هر واحد <strong className="font-mono-num">{formatNumber(dealRate)} ریال</strong>{' '}
              {dealType === 'buy' ? 'از' : 'به'}{' '}
              <strong className="text-slate-950">{selectedContact?.name || 'مشتری'}</strong> هستید.
              جمع کل این معامله <strong className="font-mono-num">{formatNumber(totalIRR)} ریال</strong> می‌شود.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                <span className="text-[11px] text-slate-500 block">
                  {dealType === 'sell' ? 'دریافتی فعلی شما:' : 'پرداختی فعلی شما:'}
                </span>
                <strong className="font-mono-num text-emerald-700 font-extrabold">
                  {formatNumber(paidSumIRR)} ریال
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                <span className="text-[11px] text-slate-500 block">
                  مانده این معامله (نسیه):
                </span>
                <strong className="font-mono-num text-amber-800 font-extrabold">
                  {formatNumber(remainingIRR)} ریال
                </strong>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                <span className="text-[11px] text-slate-500 block">
                  وضعیت نهایی {selectedContact?.name || 'مشتری'} بعد از ثبت:
                </span>
                <strong className="font-mono-num text-slate-900 font-extrabold block">
                  {formatNumber(projectedBalanceInfo.absBalance)} ریال
                </strong>
                <span
                  className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${projectedBalanceInfo.badgeColor}`}
                >
                  {projectedBalanceInfo.statusLabel}
                </span>
              </div>
            </div>
          </div>

          {contacts.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>لطفاً ابتدا با دکمه «+ مشتری جدید» در بالای فرم، نام طرف حساب را وارد کنید.</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!selectedContact || foreignAmount <= 0 || dealRate <= 0}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50 ${
                dealType === 'buy'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {dealType === 'buy'
                ? `ثبت قطعی خرید ${formatNumber(foreignAmount)} ${currency} و صدور رسید`
                : `ثبت قطعی فروش ${formatNumber(foreignAmount)} ${currency} و صدور رسید`}
            </button>
          </div>
        </form>
      </div>

      {/* تاریخچه معاملات ارزی ثبت شده */}
      <div
        id="fx-deals-print"
        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-teal-600 shrink-0" />
              فهرست معاملات خرید و فروش ارز ({formatNumber(fxDeals.length)})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              روی «مشاهده رسید» هر ردیف کلیک کنید تا رسید رسمی معامله را ببینید یا چاپ کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-teal-600" />
            چاپ کل لیست معاملات
          </button>
        </div>

        <div className="space-y-3">
          {fxDeals.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
              هنوز هیچ معامله خرید یا فروش ارزی ثبت نشده است.
            </div>
          ) : (
            fxDeals.map((d) => {
              const paid =
                d.paidAmountIRR ?? (d.settlementMethod !== 'credit_account' ? d.totalIRR : 0);
              const rem = d.remainingAmountIRR ?? Math.max(0, d.totalIRR - paid);

              return (
                <div
                  key={d.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 hover:border-teal-300 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num font-extrabold text-teal-800 text-xs sm:text-sm bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                        {d.dealNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                          d.type === 'buy'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {d.type === 'buy' ? 'خرید ارز از شخص' : 'فروش ارز به شخص'}
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm font-mono-num">
                        {formatNumber(d.foreignAmount)} {d.currency}
                      </span>
                      <span className="text-xs text-slate-600 font-mono-num">
                        (نرخ: {formatNumber(d.exchangeRate)} ریال)
                      </span>
                      <span className="text-xs text-slate-900 font-extrabold bg-white px-2 py-0.5 rounded border border-slate-200">
                        👤 {d.contactName}
                      </span>
                      <span className="text-xs text-slate-500 font-mono-num">{d.date}</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono-num">
                        جمع: {formatNumber(d.totalIRR)} ریال
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewDeal(d)}
                          className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>مشاهده رسید</span>
                        </button>
                        {onDeleteDeal && (
                          <button
                            type="button"
                            onClick={() => onDeleteDeal(d.id)}
                            className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer"
                            title="حذف معامله و سند مربوطه"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* نمایش ریز پرداخت یا دریافت ترکیبی */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center gap-2">
                      <Landmark className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>
                        تسویه‌شده:{' '}
                        <strong className="text-emerald-700 font-mono-num">
                          {formatNumber(paid)} ریال
                        </strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>
                        مانده نسیه در حساب {d.contactName}:{' '}
                        <strong className="text-amber-800 font-mono-num">
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
            })
          )}
        </div>
      </div>

      {/* مودال مشاهده و چاپ رسید رسمی معامله ارز */}
      {previewDeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold text-teal-700 block">{companyName}</span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  رسید رسمی معامله {previewDeal.type === 'buy' ? 'خرید ارز' : 'فروش ارز'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDeal(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">شماره رسید معامله:</span>
                <strong className="font-mono-num text-sm text-teal-800 font-extrabold">
                  {previewDeal.dealNumber}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">تاریخ ثبت:</span>
                <strong className="font-mono-num text-sm text-slate-900 font-extrabold">
                  {previewDeal.date}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">نام طرف حساب / مشتری:</span>
                <strong className="text-sm text-slate-900 font-extrabold">
                  {previewDeal.contactName}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">نوع عملیات:</span>
                <strong
                  className={`text-sm font-extrabold ${
                    previewDeal.type === 'buy' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {previewDeal.type === 'buy' ? 'خرید ارز توسط صرافی' : 'فروش ارز به مشتری'}
                </strong>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <div className="bg-slate-100 px-4 py-2.5 font-extrabold text-slate-800 flex justify-between">
                <span>شرح ارز مورد معامله</span>
                <span>مقدار و نرخ</span>
              </div>
              <div className="p-4 space-y-2.5 divide-y divide-slate-100">
                <div className="flex justify-between items-center pb-2">
                  <span className="text-slate-600 font-medium">مقدار ارز ({previewDeal.currency}):</span>
                  <strong className="font-mono-num text-sm font-extrabold text-slate-900">
                    {formatNumber(previewDeal.foreignAmount)} {previewDeal.currency}
                  </strong>
                </div>
                <div className="flex justify-between items-center pt-2 pb-2">
                  <span className="text-slate-600 font-medium">نرخ توافقی هر واحد:</span>
                  <strong className="font-mono-num text-sm font-extrabold text-slate-900">
                    {formatNumber(previewDeal.exchangeRate)} ریال
                  </strong>
                </div>
                {previewDeal.commissionIRR > 0 && (
                  <div className="flex justify-between items-center pt-2 pb-2">
                    <span className="text-slate-600 font-medium">کارمزد انتقال:</span>
                    <strong className="font-mono-num text-slate-800">
                      {formatNumber(previewDeal.commissionIRR)} ریال
                    </strong>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 bg-teal-50/60 -mx-4 px-4 py-2.5">
                  <span className="font-extrabold text-teal-950">مبلغ کل معامله به ریال:</span>
                  <strong className="font-mono-num text-base font-extrabold text-teal-900">
                    {formatNumber(previewDeal.totalIRR)} ریال
                  </strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-800 block text-[11px] font-bold">مبلغ تسویه‌شده (نقد/بانک):</span>
                <strong className="font-mono-num text-sm font-extrabold text-emerald-950 mt-0.5 block">
                  {formatNumber(previewDeal.paidAmountIRR ?? 0)} ریال
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-800 block text-[11px] font-bold">مانده در حساب شخص (نسیه):</span>
                <strong className="font-mono-num text-sm font-extrabold text-amber-950 mt-0.5 block">
                  {formatNumber(previewDeal.remainingAmountIRR ?? 0)} ریال
                </strong>
              </div>
            </div>

            {previewDeal.notes && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <strong>توضیحات:</strong> {previewDeal.notes}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                چاپ / ذخیره PDF رسید
              </button>
              <button
                type="button"
                onClick={() => setPreviewDeal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
