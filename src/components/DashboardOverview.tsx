import React, { useMemo } from 'react';
import {
  Currency,
  Account,
  JournalVoucher,
  FXDeal,
  SalesInvoice,
  BankAccount,
  Contact,
} from '../types/accounting';
import {
  buildPersonStatement,
  calculateCurrencyVaultPositions,
  formatNumber,
} from '../utils/accountingEngine';
import {
  Wallet,
  Landmark,
  Coins,
  Users,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  TrendingUp,
} from 'lucide-react';

interface DashboardOverviewProps {
  currencies: Currency[];
  accounts: Account[];
  vouchers: JournalVoucher[];
  fxDeals: FXDeal[];
  invoices: SalesInvoice[];
  banks?: BankAccount[];
  contacts?: Contact[];
  onNavigate?: (tab: string) => void;
  onUpdateCurrencies: (currencies: Currency[]) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currencies,
  accounts,
  vouchers,
  fxDeals,
  banks = [],
  contacts = [],
  onNavigate,
}) => {
  // محاسبه موجودی لحظه‌ای هر بانک و صندوق
  const bankSummaries = useMemo(() => {
    return banks.map((b) => {
      const rate =
        b.currency === 'IRR'
          ? 1
          : currencies.find((c) => c.code === b.currency)?.defaultRateToIRR || 1;
      let balForeign = b.initialBalanceForeign || 0;
      let balIRR = b.initialBalanceIRR || 0;

      vouchers.forEach((v) => {
        v.lines.forEach((ln) => {
          if (ln.bankId === b.id) {
            if (b.currency === 'IRR') {
              balForeign += ln.debitIRR - ln.creditIRR;
              balIRR += ln.debitIRR - ln.creditIRR;
            } else {
              balForeign += (ln.debitForeign || 0) - (ln.creditForeign || 0);
              balIRR += ln.debitIRR - ln.creditIRR;
            }
          }
        });
      });

      if (b.currency !== 'IRR') {
        balIRR = Math.round(balForeign * rate);
      }

      return {
        ...b,
        liveForeign: balForeign,
        liveIRR: balIRR,
      };
    });
  }, [banks, vouchers, currencies]);

  // محاسبه وضعیت طلب و بدهی تک‌تک اشخاص
  const personSummaries = useMemo(() => {
    return contacts.map((c) => {
      const st = buildPersonStatement(vouchers, c.id);
      return {
        contact: c,
        balanceIRR: st.finalBalanceIRR,
        status: st.finalStatusIRR, // 'بدهکار' = طلب ما از شخص | 'بستانکار' = بدهی ما به شخص
      };
    });
  }, [contacts, vouchers]);

  // محاسبه سود خالص معاملات ارز و ماهانه
  const netProfitIRR = useMemo(() => {
    const positions = calculateCurrencyVaultPositions(currencies, fxDeals);
    const fxProfit = positions.reduce((s, p) => s + p.realizedProfitIRR, 0);

    const expenseCodes = new Set(
      accounts
        .filter((a) => a.category === 'expense' || a.code.startsWith('5'))
        .map((a) => a.code)
    );
    const revenueCodes = new Set(
      accounts
        .filter((a) => a.category === 'revenue' || a.code.startsWith('4'))
        .map((a) => a.code)
    );

    let expenses = 0;
    let otherRev = 0;
    vouchers.forEach((v) => {
      v.lines.forEach((ln) => {
        if (expenseCodes.has(ln.accountCode)) {
          expenses += Math.max(0, (ln.debitIRR || 0) - (ln.creditIRR || 0));
        }
        if (revenueCodes.has(ln.accountCode)) {
          otherRev += Math.max(0, (ln.creditIRR || 0) - (ln.debitIRR || 0));
        }
      });
    });

    return fxProfit + otherRev - expenses;
  }, [currencies, fxDeals, accounts, vouchers]);

  const totalRialBanksIRR = bankSummaries
    .filter((b) => b.currency === 'IRR')
    .reduce((s, b) => s + b.liveIRR, 0);

  const totalForeignVaultsIRR = bankSummaries
    .filter((b) => b.currency !== 'IRR')
    .reduce((s, b) => s + b.liveIRR, 0);

  const totalReceivablesIRR = personSummaries
    .filter((p) => p.status === 'بدهکار')
    .reduce((s, p) => s + p.balanceIRR, 0);

  const totalPayablesIRR = personSummaries
    .filter((p) => p.status === 'بستانکار')
    .reduce((s, p) => s + p.balanceIRR, 0);

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* ۴ دکمه اصلی سیستم به زبان ساده و بدون اصطلاحات پیچیده حسابداری */}
      {onNavigate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('fx_desk')}
            className="bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 rounded-2xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-amber-950 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                ۱. ثبت خرید و فروش ارز
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                خرید و فروش دلار، یورو، درهم با صدور رسید فوری
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-amber-700 group-hover:-translate-x-1 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('persons')}
            className="bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 rounded-2xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-sky-950 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-600 shrink-0" />
                ۲. بدهکاران و صورتحساب اشخاص
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                کی به ما بدهکاره / ما به کی بدهکاریم + کاردکس تکی
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-sky-700 group-hover:-translate-x-1 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('vouchers')}
            className="bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 rounded-2xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                ۳. ثبت دریافت و پرداخت به اشخاص
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                ثبت پول یا ارزی که از مشتری گرفتید یا پرداخت کردید
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-emerald-700 group-hover:-translate-x-1 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="bg-teal-50 hover:bg-teal-100 border-2 border-teal-200 rounded-2xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-teal-950 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-teal-600 shrink-0" />
                ۴. گزارش سود ماهانه و سود ارزها
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                مشاهده سود خالص ماهانه و سود خرید و فروش هر ارز
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-teal-700 group-hover:-translate-x-1 transition shrink-0" />
          </button>
        </div>
      )}

      {/* ۴ کارت خلاصه وضعیت کلیدی (طلب، بدهی، سود خالص، موجودی بانک و ارز) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate && onNavigate('persons')}
          className="bg-white border-2 border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer hover:border-emerald-400 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-emerald-900">
              🟢 کل طلب ما از مشتریان (بدهکاران)
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-700 font-mono-num">
            {formatNumber(totalReceivablesIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1.5">
            پولی که مشتریان باید به ما بدهند (کلیک برای مشاهده لیست)
          </p>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('persons')}
          className="bg-white border-2 border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer hover:border-rose-400 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-rose-900">
              🔴 کل بدهی ما به اشخاص (طلبکاران)
            </span>
            <div className="p-2 bg-rose-50 rounded-xl">
              <ArrowUpRight className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-rose-700 font-mono-num">
            {formatNumber(totalPayablesIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1.5">
            پولی که ما باید به اشخاص بپردازیم (کلیک برای مشاهده لیست)
          </p>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('reports')}
          className="bg-white border-2 border-teal-200 rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer hover:border-teal-400 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-teal-900">
              💰 سود خالص معاملات ارز (تا امروز)
            </span>
            <div className="p-2 bg-teal-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-teal-800 font-mono-num">
            {formatNumber(netProfitIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-teal-700 font-medium mt-1.5">
            سود خالص پس از کسر هزینه‌ها (کلیک برای ریز سود ماهانه)
          </p>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('banks')}
          className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-slate-700">
              🏦 کل نقدینگی بانک‌ها و ارزهای موجود
            </span>
            <div className="p-2 bg-amber-50 rounded-xl">
              <Landmark className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono-num">
            {formatNumber(totalRialBanksIRR + totalForeignVaultsIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            ریالی: {formatNumber(totalRialBanksIRR)} | معادل ارزها: {formatNumber(totalForeignVaultsIRR)}
          </p>
        </div>
      </div>

      {/* دو ستون اصلی: ۱. موجودی تک‌تک بانک‌ها و صندوق‌های ارزی | ۲. مانده حساب اشخاص */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* لیست بانک‌ها و صندوق‌ها */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-teal-600" />
              موجودی لحظه‌ای بانک‌ها و صندوق‌های ارزی
            </h3>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('banks')}
                className="text-xs font-extrabold text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                مدیریت بانک‌ها و صندوق‌ها ←
              </button>
            )}
          </div>

          {bankSummaries.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
              هنوز بانک یا صندوقی تعریف نشده است. از بخش «بانک‌ها و صندوق‌های ارزی» حساب‌های خود را اضافه کنید.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bankSummaries.map((b) => (
                <div
                  key={b.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span>{b.kind === 'cash_box' ? '📦' : '🏦'}</span>
                      <span>{b.bankName}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{b.branchName}</span>
                  </div>

                  <div className="text-left font-mono-num">
                    <div className="text-xs font-extrabold text-teal-800">
                      {formatNumber(b.currency === 'IRR' ? b.liveIRR : b.liveForeign)}{' '}
                      {b.currency === 'IRR' ? 'ریال' : b.currency}
                    </div>
                    {b.currency !== 'IRR' && (
                      <div className="text-[10px] font-bold text-amber-700">
                        معادل {formatNumber(b.liveIRR)} ریال
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* لیست وضعیت حساب اشخاص */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              خلاصه مانده حساب مشتریان (کی بدهکاره / کی طلبکاره)
            </h3>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('persons')}
                className="text-xs font-extrabold text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                مشاهده صورتحساب تکی هر شخص ←
              </button>
            )}
          </div>

          {personSummaries.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
              هنوز هیچ مشتری یا طرف حسابی تعریف نشده است.
            </div>
          ) : (
            <div className="space-y-2.5">
              {personSummaries.map(({ contact, balanceIRR, status }) => (
                <div
                  key={contact.id}
                  onClick={() => onNavigate && onNavigate('persons')}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between cursor-pointer hover:border-teal-300 transition"
                >
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">{contact.name}</div>
                    <div className="text-[11px] text-slate-500">{contact.phone || 'بدون شماره'}</div>
                  </div>

                  <div className="text-left font-mono-num">
                    <div
                      className={`text-xs font-extrabold ${
                        status === 'بدهکار'
                          ? 'text-emerald-700'
                          : status === 'بستانکار'
                          ? 'text-rose-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {status === 'تسویه' ? 'تسویه کامل (۰ ریال)' : `${formatNumber(balanceIRR)} ریال`}
                    </div>
                    <div
                      className={`text-[10px] font-bold mt-0.5 ${
                        status === 'بدهکار'
                          ? 'text-emerald-800'
                          : status === 'بستانکار'
                          ? 'text-rose-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {status === 'بدهکار'
                        ? '🟢 بدهکار به ما (طلب ما)'
                        : status === 'بستانکار'
                        ? '🔴 طلبکار از ما (بدهی ما)'
                        : 'بی‌حساب'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
