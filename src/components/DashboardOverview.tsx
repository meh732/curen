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
import { buildPersonStatement, formatNumber } from '../utils/accountingEngine';
import {
  Wallet,
  Landmark,
  Coins,
  Users,
  ShoppingBag,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
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
  vouchers,
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
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* دکمه‌های دسترسی سریع برای فرد غیرحسابدار */}
      {onNavigate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('invoices')}
            className="bg-teal-50 hover:bg-teal-100/80 border border-teal-200 rounded-xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-teal-600" />
                ثبت فاکتور خرید یا فروش
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                با تسویه ترکیبی چند بانکی و چند صندوقی
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-teal-600 group-hover:-translate-x-1 transition" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('vouchers')}
            className="bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                امور مالی و سند اتوماتیک
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                دریافت از شخص، پرداخت از بانک، انتقال و هزینه
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-emerald-600 group-hover:-translate-x-1 transition" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('fx_desk')}
            className="bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600" />
                خرید و فروش ارز
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                ورود/خروج ارز و تسویه چند بانکی اتوماتیک
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-amber-600 group-hover:-translate-x-1 transition" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('persons')}
            className="bg-sky-50 hover:bg-sky-100/80 border border-sky-200 rounded-xl p-4 text-right transition flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div>
              <div className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-600" />
                دفتر حساب اشخاص
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                مشاهده ریز طلب و بدهی هر شخص + PDF
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-sky-600 group-hover:-translate-x-1 transition" />
          </button>
        </div>
      )}

      {/* ۴ کارت خلاصه وضعیت دارایی، طلب و بدهی شخصی */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">موجودی بانک‌ها و صندوق ریالی</span>
            <div className="p-2 bg-teal-50 rounded-lg">
              <Landmark className="w-5 h-5 text-teal-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono-num">
            {formatNumber(totalRialBanksIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-teal-700 font-medium mt-2">جمع کل پول نقد و حساب‌های بانکی ریالی</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">ارزش صندوق‌ها و حساب‌های ارزی</span>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Coins className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-amber-900 font-mono-num">
            {formatNumber(totalForeignVaultsIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            معادل ریالی دلار، درهم، یورو و یوان موجود
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">کل طلب ما از اشخاص (بدهکاران)</span>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-700 font-mono-num">
            {formatNumber(totalReceivablesIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2">پولی که مشتریان و اشخاص باید به ما بدهند</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">کل بدهی ما به اشخاص (طلبکاران)</span>
            <div className="p-2 bg-rose-50 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-rose-700 font-mono-num">
            {formatNumber(totalPayablesIRR)}{' '}
            <span className="text-xs text-slate-500 font-normal">ریال</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            پولی که ما باید به اشخاص و همکاران بپردازیم
          </p>
        </div>
      </div>

      {/* دو ستون اصلی: ۱. موجودی تک‌تک بانک‌ها و صندوق‌ها | ۲. مانده حساب اشخاص */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* لیست بانک‌ها و صندوق‌ها */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-teal-600" />
              موجودی لحظه‌ای بانک‌ها و صندوق‌های من
            </h3>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('banks')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                مدیریت بانک‌ها و صندوق‌ها ←
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bankSummaries.map((b) => (
              <div
                key={b.id}
                className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{b.kind === 'cash_box' ? '📦' : '🏦'}</span>
                    <span>{b.bankName}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{b.branchName}</span>
                </div>

                <div className="text-left font-mono-num">
                  <div className="text-xs font-extrabold text-teal-700">
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
        </div>

        {/* لیست وضعیت حساب اشخاص */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              خلاصه حساب اشخاص (طلب و بدهی)
            </h3>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('persons')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                صورتحساب کامل اشخاص ←
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {personSummaries.map(({ contact, balanceIRR, status }) => (
              <div
                key={contact.id}
                className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">{contact.name}</div>
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
                    {status === 'تسویه' ? 'تسویه کامل' : `${formatNumber(balanceIRR)} ریال`}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {status === 'بدهکار'
                      ? 'بدهکار به ما (طلب ما)'
                      : status === 'بستانکار'
                      ? 'طلبکار از ما (بدهی ما)'
                      : 'بی‌حساب'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
