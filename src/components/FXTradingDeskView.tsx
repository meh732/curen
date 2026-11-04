import React, { useMemo, useState } from 'react';
import {
  AccountingState,
  BotDeliveryLog,
  CurrencyCode,
  FXDeal,
} from '../types/accounting';
import {
  calculateCurrencyVaultPositions,
  convertForeignToIRR,
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import { dispatchToMessengerBot } from '../utils/botAndBackupService';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Send,
  Printer,
  TrendingUp,
  Coins,
} from 'lucide-react';

interface FXTradingDeskViewProps {
  state: AccountingState;
  onExecuteFXDeal: (deal: FXDeal) => void;
  onRecordBotLog: (log: BotDeliveryLog) => void;
  onUpdateCurrencyRate: (code: CurrencyCode, newRate: number) => void;
}

export const FXTradingDeskView: React.FC<FXTradingDeskViewProps> = ({
  state,
  onExecuteFXDeal,
  onRecordBotLog,
  onUpdateCurrencyRate,
}) => {
  const [dealType, setDealType] = useState<'buy' | 'sell'>('sell');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [foreignAmount, setForeignAmount] = useState<number>(5000);
  const [exchangeRate, setExchangeRate] = useState<number>(685000);
  const [commissionIRR, setCommissionIRR] = useState<number>(0);
  const [contactId, setContactId] = useState<string>(state.contacts[0]?.id || '');
  const [settlementMethod, setSettlementMethod] =
    useState<FXDeal['settlementMethod']>('credit_account');
  const [targetForeignBankId, setTargetForeignBankId] = useState<string>(
    state.banks.find((b) => b.currency !== 'IRR')?.id || state.banks[0]?.id || ''
  );
  const [trackingNumber, setTrackingNumber] = useState<string>('SW-1404-990');
  const [date, setDate] = useState<string>('1404/08/12');
  const [notes, setNotes] = useState<string>(
    'تسویه طبق نرخ توافقی میز معاملات ارزی و ثبت همزمان در کاردکس ارزی و ریالی مشتری'
  );
  const [filterCurrency, setFilterCurrency] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const vaultPositions = useMemo(
    () => calculateCurrencyVaultPositions(state.currencies, state.fxDeals || []),
    [state.currencies, state.fxDeals]
  );

  const totalRealizedProfitIRR = useMemo(
    () => vaultPositions.reduce((s, p) => s + p.realizedProfitIRR, 0),
    [vaultPositions]
  );

  const totalIRR = useMemo(
    () => convertForeignToIRR(foreignAmount, exchangeRate, currency),
    [foreignAmount, exchangeRate, currency]
  );

  const handleCurrencySelect = (code: CurrencyCode) => {
    setCurrency(code);
    const currObj = state.currencies.find((c) => c.code === code);
    if (currObj) {
      setExchangeRate(currObj.defaultRateToIRR);
    }
    const matchingBank = state.banks.find((b) => b.currency === code);
    if (matchingBank) {
      setTargetForeignBankId(matchingBank.id);
    }
  };

  const handleSubmitDeal = (e: React.FormEvent) => {
    e.preventDefault();
    const contact = state.contacts.find((c) => c.id === contactId);
    if (!contact || foreignAmount <= 0 || exchangeRate <= 0) return;

    const nextDealNo = `FX-1404-${1001 + (state.fxDeals?.length || 0)}`;
    const newDeal: FXDeal = {
      id: `fx-${Date.now()}`,
      dealNumber: nextDealNo,
      type: dealType,
      date,
      contactId: contact.id,
      contactName: contact.name,
      currency,
      foreignAmount,
      exchangeRate,
      totalIRR,
      commissionIRR,
      settlementMethod,
      targetForeignBankId,
      trackingNumber: trackingNumber.trim() || nextDealNo,
      notes,
    };

    onExecuteFXDeal(newDeal);
    setFeedback(
      `معامله ${dealType === 'buy' ? 'خرید ارز' : 'فروش ارز'} شماره ${nextDealNo} (${formatNumber(
        foreignAmount,
        2
      )} ${currency} به نرخ ${formatNumber(exchangeRate)} ریال = ${formatNumber(
        totalIRR
      )} ریال) ثبت شد، موجودی خزانه ارزی بروزرسانی گردید و سند دوبل حسابداری آن به صورت خودکار صادر شد.`
    );
  };

  const handleSendDealReceiptToBot = async (
    deal: FXDeal,
    platform: 'bale' | 'telegram'
  ) => {
    const contact = state.contacts.find((c) => c.id === deal.contactId);
    const chatId =
      platform === 'bale'
        ? contact?.baleChatId || state.botConfig.baleDefaultChatId
        : contact?.telegramChatId || state.botConfig.telegramDefaultChatId;
    const token =
      platform === 'bale'
        ? state.botConfig.baleBotToken
        : state.botConfig.telegramBotToken;

    const text =
      `💱 *فاکتور / اعلامیه رسمی ${deal.type === 'buy' ? 'خرید ارز' : 'فروش ارز'}*\n` +
      `🏢 صادرکننده: ${state.companyName}\n` +
      `🔢 شماره فیش ارزی: ${deal.dealNumber} | 📅 تاریخ: ${deal.date}\n` +
      `👤 طرف حساب: ${deal.contactName}\n` +
      `----------------------------------\n` +
      `🌍 نوع عملیات: *${deal.type === 'buy' ? 'خرید ارز از مشتری' : 'فروش ارز به مشتری'}*\n` +
      `💵 مقدار ارز: *${formatNumber(deal.foreignAmount, 2)} ${deal.currency}*\n` +
      `📈 نرخ تبدیل واحد: *${formatNumber(deal.exchangeRate)} ریال*\n` +
      `🇮🇷 *مبلغ کل معادل به ریال ایران:* ${formatNumber(deal.totalIRR)} ریال\n` +
      `🔖 شماره پیگیری / حواله: ${deal.trackingNumber}\n` +
      `----------------------------------\n` +
      `✅ ثبت شده در صورتحساب ارزی و ریالی شما در سامانه ترازبان`;

    const log = await dispatchToMessengerBot({
      platform,
      botToken: token,
      chatId,
      recipientName: deal.contactName,
      messageType: 'invoice',
      text,
      summary: `ارسال فیش ${deal.type === 'buy' ? 'خرید' : 'فروش'} ارزی ${
        deal.dealNumber
      } (${formatNumber(deal.foreignAmount, 2)} ${deal.currency} = ${formatNumber(
        deal.totalIRR
      )} ریال) به ${platform === 'bale' ? 'بله' : 'تلگرام'} مشتری`,
    });

    onRecordBotLog(log);
    setFeedback(
      `فیش رسمی معامله ارزی ${deal.dealNumber} (همراه با مبلغ ارزی و ریالی) از طریق ربات ${
        platform === 'bale' ? 'بله (Bale)' : 'تلگرام (Telegram)'
      } برای «${deal.contactName}» ارسال شد.`
    );
  };

  const filteredDeals = useMemo(() => {
    const list = state.fxDeals || [];
    if (filterCurrency === 'ALL') return list;
    return list.filter((d) => d.currency === filterCurrency);
  }, [state.fxDeals, filterCurrency]);

  return (
    <div className="space-y-6">
      {/* Header & Realized FX Profit Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            میز معاملات خرید و فروش ارز (صرافی و بازرگانی ارزی) — ثبت همزمان ارزی و ریالی
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ثبت آنی خرید و فروش دلار (USD)، یورو (EUR)، یوان چین (CNY) و درهم امارات (AED) با تبدیل خودکار به ریال، محاسبه میانگین نرخ خرید/فروش، سود نوسان نرخ ارز و صدور خودکار سند حسابداری.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-xs flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-emerald-950 font-semibold">
            سود قطعی تحقق‌یافته معاملات خرید و فروش ارز:
          </span>
          <strong className="font-mono-num text-sm text-emerald-800">
            +{formatNumber(totalRealizedProfitIRR)} ریال
          </strong>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline"
          >
            بستن
          </button>
        </div>
      )}

      {/* 4-Card Live Foreign Currency Vault Position (موجودی خزانه ارزی و میانگین نرخ خرید/فروش) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {vaultPositions.map((pos) => (
          <div
            key={pos.currency}
            className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-blue-700" />
                <span className="font-mono-num font-extrabold text-sm text-slate-900">
                  {pos.currency} ({pos.symbol})
                </span>
              </div>
              <span className="text-[11px] text-slate-500">{pos.currencyName}</span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">موجودی خالص خزانه:</span>
              <span className="font-mono-num text-base font-extrabold text-blue-900">
                {formatNumber(pos.netVaultBalanceForeign, 2)} {pos.currency}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded border border-slate-200">
              <div>
                <div className="text-slate-500">میانگین نرخ خرید:</div>
                <div className="font-mono-num font-bold text-emerald-800">
                  {formatNumber(pos.weightedAvgBuyRate)} ریال
                </div>
              </div>
              <div>
                <div className="text-slate-500">میانگین نرخ فروش:</div>
                <div className="font-mono-num font-bold text-blue-800">
                  {formatNumber(pos.weightedAvgSellRate)} ریال
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-500">سود معاملات {pos.currency}:</span>
              <span className="font-mono-num font-bold text-emerald-700">
                +{formatNumber(pos.realizedProfitIRR)} ریال
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main FX Buy / Sell Deal Execution Form */}
      <form
        onSubmit={handleSubmitDeal}
        className="bg-white border border-slate-200 rounded-lg p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDealType('buy')}
              className={`px-5 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer ${
                dealType === 'buy'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              ثبت خرید ارز (ورود ارز به خزانه / بستانکاری طرف حساب)
            </button>
            <button
              type="button"
              onClick={() => setDealType('sell')}
              className={`px-5 py-2.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer ${
                dealType === 'sell'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              ثبت فروش ارز (خروج ارز از خزانه / بدهکاری طرف حساب)
            </button>
          </div>

          <div className="text-xs text-slate-600 font-mono-num">
            تاریخ روز معاملات: <strong>{date}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              طرف حساب معامله (مشتری / کارگزار / صرافی) *
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              aria-label="طرف حساب معامله ارزی"
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded"
            >
              {state.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} (ارز پیش‌فرض: {c.defaultCurrency})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نوع ارز مورد معامله
            </label>
            <select
              value={currency}
              onChange={(e) => handleCurrencySelect(e.target.value)}
              aria-label="نوع ارز مورد معامله"
              className="w-full px-3 py-2 text-xs font-mono-num font-bold bg-white border border-slate-300 rounded"
            >
              {state.currencies
                .filter((c) => !c.isBase)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              مقدار ارز ({currency} — با اعشار) *
            </label>
            <FormattedNumberInput
              value={foreignAmount}
              allowDecimals={currency !== 'IRR'}
              onChange={(val) => setForeignAmount(val)}
              ariaLabel="مقدار ارز معامله"
              className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نرخ تبدیل واحد (ریال) *
            </label>
            <FormattedNumberInput
              value={exchangeRate}
              allowDecimals={false}
              onChange={(val) => setExchangeRate(val || 1)}
              ariaLabel="نرخ تبدیل معامله به ریال"
              className="w-full px-3 py-2 text-xs font-bold bg-amber-50 border border-amber-300 rounded"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-blue-900 mb-1">
              معادل قطعی به ریال ایران
            </label>
            <div dir="ltr" className="w-full px-3 py-2 text-xs font-mono-num font-extrabold bg-blue-50 border border-blue-200 rounded text-blue-950 text-left">
              {formatNumber(totalIRR)} ریال
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              بانک / خزانه ارزی درگیر در معامله
            </label>
            <select
              value={targetForeignBankId}
              onChange={(e) => setTargetForeignBankId(e.target.value)}
              aria-label="خزانه ارزی معامله"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded"
            >
              {state.banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} ({b.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نحوه تسویه ریالی / ارزی با طرف حساب
            </label>
            <select
              value={settlementMethod}
              onChange={(e) =>
                setSettlementMethod(e.target.value as FXDeal['settlementMethod'])
              }
              aria-label="نحوه تسویه معامله"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded"
            >
              <option value="credit_account">
                منظور در حساب جاری شخص (بدهکار / بستانکار در صورتحساب)
              </option>
              <option value="bank_transfer">
                تسویه نقدی / حواله بانکی مستقیم
              </option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              شماره پیگیری / حواله (Swift)
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              aria-label="شماره حواله ارزی"
              className="w-full px-3 py-2 text-xs font-mono-num bg-white border border-slate-300 rounded"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              className={`w-full py-2.5 px-4 text-xs font-extrabold text-white rounded shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                dealType === 'buy'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {dealType === 'buy'
                ? `ثبت قطعی خرید ${currency} و صدور سند ریالی/ارزی`
                : `ثبت قطعی فروش ${currency} و صدور فاکتور ارزی/ریالی`}
            </button>
          </div>
        </div>
      </form>

      {/* Executed FX Deals Table with Direct Bot Receipt Dispatch */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base font-bold text-slate-900">
            دفتر معاملات خرید و فروش ارز ثبت‌شده (همراه با ارسال آنی فیش ارزی/ریالی به بله و تلگرام مشتری)
          </h3>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'USD', 'AED', 'CNY', 'EUR'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setFilterCurrency(curr)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  filterCurrency === curr
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {curr === 'ALL' ? 'همه ارزها' : curr}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                <th className="py-2.5 px-3">شماره معامله</th>
                <th className="py-2.5 px-3">تاریخ</th>
                <th className="py-2.5 px-3">نوع عملیات</th>
                <th className="py-2.5 px-3">طرف حساب (مشتری / صرافی)</th>
                <th className="py-2.5 px-3 text-left">مقدار ارز</th>
                <th className="py-2.5 px-3 text-left">نرخ تبدیل (ریال)</th>
                <th className="py-2.5 px-3 text-left bg-blue-50 text-blue-950">
                  مبلغ کل به ریال ایران
                </th>
                <th className="py-2.5 px-3 text-center">ارسال فیش ارزی/ریالی با بات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono-num font-bold text-blue-800">
                    {deal.dealNumber}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num">{deal.date}</td>
                  <td className="py-2.5 px-3 font-bold">
                    {deal.type === 'buy' ? (
                      <span className="text-emerald-700">خرید ارز (ورود به خزانه)</span>
                    ) : (
                      <span className="text-blue-700">فروش ارز (خروج از خزانه)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {deal.contactName}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-extrabold text-slate-900">
                    {formatNumber(deal.foreignAmount, 2)} {deal.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left text-slate-700">
                    {formatNumber(deal.exchangeRate)}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-bold bg-blue-50/40 text-blue-950">
                    {formatNumber(deal.totalIRR)} ریال
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendDealReceiptToBot(deal, 'bale')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        ارسال به بله
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendDealReceiptToBot(deal, 'telegram')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-sky-700 hover:bg-sky-800 text-white rounded flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        ارسال به تلگرام
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="p-1 text-slate-500 hover:text-slate-900"
                        aria-label={`چاپ فیش ${deal.dealNumber}`}
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
