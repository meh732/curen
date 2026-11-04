import React, { useMemo } from 'react';
import { AccountingState } from '../types/accounting';
import {
  buildPersonStatement,
  calculateCurrencyVaultPositions,
  formatCurrencyAmount,
  formatNumber,
  reconcileBankTransactions,
} from '../utils/accountingEngine';
import {
  FileSpreadsheet,
  Users,
  Landmark,
  DatabaseBackup,
  ArrowLeft,
  ArrowLeftRight,
  Printer,
  Monitor,
  TrendingUp,
} from 'lucide-react';

interface DashboardOverviewProps {
  state: AccountingState;
  onNavigate: (
    tab:
      | 'dashboard'
      | 'fx_desk'
      | 'reports'
      | 'vouchers'
      | 'statements'
      | 'invoices'
      | 'banks'
      | 'backup'
  ) => void;
  onQuickBackup: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  state,
  onNavigate,
  onQuickBackup,
}) => {
  const stats = useMemo(() => {
    let totalReceivablesIRR = 0;
    let totalPayablesIRR = 0;

    for (const c of state.contacts) {
      const st = buildPersonStatement(state.vouchers, c.id, 'ALL');
      if (st.finalStatusIRR === 'بدهکار') {
        totalReceivablesIRR += st.finalBalanceIRR;
      } else if (st.finalStatusIRR === 'بستانکار') {
        totalPayablesIRR += st.finalBalanceIRR;
      }
    }

    const vaultPositions = calculateCurrencyVaultPositions(
      state.currencies,
      state.fxDeals || []
    );

    const totalRealizedFXProfitIRR = vaultPositions.reduce(
      (sum, v) => sum + v.realizedProfitIRR,
      0
    );

    const bankSummaries = state.banks.map((b) => {
      const rec = reconcileBankTransactions(
        b.id,
        b.initialBalanceForeign,
        b.initialBalanceIRR,
        state.vouchers,
        state.bankStatementEntries
      );
      return { bank: b, rec };
    });

    return {
      totalReceivablesIRR,
      totalPayablesIRR,
      vaultPositions,
      totalRealizedFXProfitIRR,
      bankSummaries,
    };
  }, [state]);

  return (
    <div className="space-y-6">
      {/* Beginner-Friendly Welcome & 4-Step Action Hub */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              میز کار ساده و روان خرید و فروش ارز و حسابداری دوارزی ویندوز — {state.companyName}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              تمامی اعداد ۳ رقم ۳ رقم جدا شده‌اند و مبالغ ارزی (دلار، یورو، درهم، یوان) دارای اعشار دقیق (.00) هستند. برای شروع کار یکی از ۴ کلید اصلی زیر را انتخاب کنید:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('fx_desk')}
              className="px-4 py-2.5 text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
              + ثبت سریع خرید یا فروش ارز (F1)
            </button>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-4 py-2.5 text-xs font-extrabold bg-blue-700 hover:bg-blue-800 text-white rounded-md flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              گزارشات استاندارد و خروجی PDF (F3)
            </button>
          </div>
        </div>

        {/* 4 Beginner-Friendly Step Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('fx_desk')}
            className="text-right p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-900">
                ۱. میز خرید و فروش ارز (صرافی)
              </span>
              <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              ثبت خرید یا فروش دلار، درهم، یوان و یورو با محاسبه خودکار معادل ریالی، سود نوسان و صدور خودکار سند.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="text-right p-4 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-blue-900">
                ۲. گزارش بانک، اشخاص و هزینه (PDF)
              </span>
              <Printer className="w-4 h-4 text-blue-700" />
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              کاردکس استاندارد حسابداری با ستون بدهکار، بستانکار و مانده از بالا به پایین + دانلود PDF و چاپ A4.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('vouchers')}
            className="text-right p-4 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900">
                ۳. ثبت سند حسابداری و هزینه (F2)
              </span>
              <FileSpreadsheet className="w-4 h-4 text-slate-700" />
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              ثبت اسناد روزانه، هزینه‌ها، واریز و برداشت بانکی به ریال یا ارز با تبدیل خودکار ۳ رقم ۳ رقم.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('backup')}
            className="text-right p-4 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-950">
                ۴. بکاپ اتوماتیک، بات و انبار
              </span>
              <DatabaseBackup className="w-4 h-4 text-amber-700" />
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              تنظیمات بکاپ اتوماتیک، ارسال به بازوی بله و تلگرام و مدیریت کاردکس لحظه‌ای انبار.
            </p>
          </button>
        </div>
      </div>

      {/* 4-Column Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>سود قطعی خرید و فروش ارز (اسپرد)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-extrabold font-mono-num text-emerald-800">
            +{formatNumber(stats.totalRealizedFXProfitIRR)} ریال
          </div>
          <button
            type="button"
            onClick={() => onNavigate('fx_desk')}
            className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            مشاهده تراز خزانه و معاملات ارز
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>مطالبات از بدهکاران (معادل ریالی کل)</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base font-extrabold font-mono-num text-slate-900">
            {formatNumber(stats.totalReceivablesIRR)} ریال
          </div>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            گزارش استاندارد اشخاص + خروجی PDF
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>بدهی به بستانکاران (تأمین‌کنندگان ارزی/ریالی)</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-base font-extrabold font-mono-num text-slate-900">
            {formatNumber(stats.totalPayablesIRR)} ریال
          </div>
          <button
            type="button"
            onClick={() => onNavigate('statements')}
            className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            مشاهده لیست بدهکاران و بستانکاران
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>وضعیت بکاپ اتوماتیک (بله و تلگرام)</span>
            <DatabaseBackup className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-sm font-bold font-mono-num text-emerald-800">
            فعال — {state.botLogs.length} ارسال موفق ثبت‌شده
          </div>
          <button
            type="button"
            onClick={onQuickBackup}
            className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            تهیه بکاپ فوری روی ویندوز و بات (F9)
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Currency Vault Positions (Buying & Selling Summary with Decimals) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
              موجودی خزانه ارزی، میانگین نرخ خرید و فروش و سود معاملات (با اعشار دقیق ارزی)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              خلاصه عملکرد خرید و فروش ارزها (اعداد سه رقم سه رقم جدا شده و مقادیر ارزی با ۲ رقم اعشار نمایش داده می‌شوند).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('fx_desk')}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded cursor-pointer"
          >
            ورود به میز خرید و فروش ارز ←
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                <th className="py-2.5 px-3">ارز</th>
                <th className="py-2.5 px-3 text-left">کل خریداری‌شده (با اعشار)</th>
                <th className="py-2.5 px-3 text-left">میانگین نرخ خرید (ریال)</th>
                <th className="py-2.5 px-3 text-left">کل فروخته‌شده (با اعشار)</th>
                <th className="py-2.5 px-3 text-left">میانگین نرخ فروش (ریال)</th>
                <th className="py-2.5 px-3 text-left bg-blue-50">موجودی خالص خزانه ارزی</th>
                <th className="py-2.5 px-3 text-left bg-emerald-50">سود قطعی خرید و فروش (ریال)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.vaultPositions.map((pos) => (
                <tr key={pos.currency} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    <span className="font-mono-num text-blue-800 ml-1.5">{pos.currency}</span>
                    <span>— {pos.currencyName}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-semibold text-emerald-800">
                    {formatCurrencyAmount(pos.totalBoughtForeign, pos.currency)} {pos.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left text-slate-700">
                    {formatNumber(pos.weightedAvgBuyRate)} ریال
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-semibold text-amber-800">
                    {formatCurrencyAmount(pos.totalSoldForeign, pos.currency)} {pos.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left text-slate-700">
                    {formatNumber(pos.weightedAvgSellRate)} ریال
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-extrabold bg-blue-50/50 text-blue-950">
                    {formatCurrencyAmount(pos.netVaultBalanceForeign, pos.currency)} {pos.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-extrabold bg-emerald-50/50 text-emerald-900">
                    +{formatNumber(pos.realizedProfitIRR)} ریال
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Exchange Rates & Multi-Currency Treasury Banks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-700" />
              موجودی لحظه‌ای بانک‌های ریالی و حساب‌های ارزی (USD / AED / CNY / IRR)
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              گزارش کاردکس بانک‌ها با PDF ←
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                  <th className="py-2 px-3">نام بانک / خزانه ارزی</th>
                  <th className="py-2 px-3">ارز</th>
                  <th className="py-2 px-3 text-left">مانده طبق دفاتر</th>
                  <th className="py-2 px-3 text-left">معادل به ریال ایران</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stats.bankSummaries.map(({ bank, rec }) => (
                  <tr key={bank.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{bank.bankName}</td>
                    <td className="py-2.5 px-3 font-mono-num font-bold text-blue-700">
                      {bank.currency}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left font-bold text-emerald-800">
                      {formatCurrencyAmount(rec.ledgerBalanceForeign, bank.currency)}{' '}
                      {bank.currency}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left font-semibold text-slate-900">
                      {formatNumber(rec.ledgerBalanceIRR)} ریال
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Currency Table */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              تابلو نرخ تبدیل ارزها به ریال (در خرید/فروش و ثبت سند)
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('banks')}
              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              ویرایش نرخ‌ها ←
            </button>
          </div>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {state.currencies.map((curr) => (
              <div
                key={curr.code}
                className="px-3.5 py-2.5 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono-num font-bold text-blue-800 ml-2">
                    {curr.code}
                  </span>
                  <span className="font-medium text-slate-800">{curr.name}</span>
                </div>
                <div className="font-mono-num font-bold text-slate-900">
                  {curr.isBase
                    ? 'ارز پایه (۱ ریال — بدون اعشار)'
                    : `${formatNumber(curr.defaultRateToIRR)} ریال (دارای ۲ رقم اعشار .00)`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Person Dual-Statement Preview */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-700" />
            خلاصه وضعیت طرف حساب‌ها (دارای گزارش استاندارد بدهکار/بستانکار/مانده از بالا به پایین + PDF)
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            چاپ و خروجی PDF کاردکس اشخاص ←
          </button>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                <th className="py-2 px-3">کد شخص</th>
                <th className="py-2 px-3">نام شخص / شرکت</th>
                <th className="py-2 px-3">ارز تخصصی</th>
                <th className="py-2 px-3 text-left">مانده صورتحساب ارزی (با اعشار)</th>
                <th className="py-2 px-3 text-left">مانده صورتحساب ریالی (۳ رقم ۳ رقم)</th>
                <th className="py-2 px-3 text-center">تشخیص</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {state.contacts.map((c) => {
                const st = buildPersonStatement(state.vouchers, c.id, 'ALL');
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono-num text-slate-500">{c.code}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{c.name}</td>
                    <td className="py-2 px-3 font-mono-num font-bold text-blue-700">
                      {c.defaultCurrency}
                    </td>
                    <td className="py-2 px-3 font-mono-num text-left font-bold text-emerald-800">
                      {Object.entries(st.currencyBreakdown).map(([curr, b]) => (
                        <span key={curr} className="ml-3">
                          {formatCurrencyAmount(b.balanceForeign, curr)} {curr}
                        </span>
                      ))}
                    </td>
                    <td className="py-2 px-3 font-mono-num text-left font-bold text-slate-900">
                      {formatNumber(st.finalBalanceIRR)} ریال
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {st.finalStatusIRR}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
