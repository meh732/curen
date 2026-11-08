import React, { useMemo, useState } from 'react';
import {
  AccountingState,
  BotDeliveryLog,
  CurrencyCode,
} from '../types/accounting';
import {
  buildStandardLedgerReport,
  calculateCurrencyVaultPositions,
  buildPersonStatement,
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import {
  exportOrPrintStandardLedgerPDF,
  exportOrPrintProfitStatementPDF,
} from '../utils/pdfPrintReportService';
import { dispatchToMessengerBot } from '../utils/botAndBackupService';
import {
  Printer,
  FileDown,
  Send,
  Landmark,
  Users,
  Receipt,
  BookOpen,
  CheckCircle2,
  ArrowDown,
  TrendingUp,
  Coins,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

interface StandardAccountingReportsViewProps {
  state: AccountingState;
  onRecordBotLog: (log: BotDeliveryLog) => void;
}

const PERSIAN_MONTH_NAMES: Record<string, string> = {
  '01': 'فروردین',
  '02': 'اردیبهشت',
  '03': 'خرداد',
  '04': 'تیر',
  '05': 'مرداد',
  '06': 'شهریور',
  '07': 'مهر',
  '08': 'آبان',
  '09': 'آذر',
  '10': 'دی',
  '11': 'بهمن',
  '12': 'اسفند',
};

function formatMonthLabel(ym: string): string {
  const parts = ym.split('/');
  if (parts.length < 2) return ym;
  const year = parts[0];
  const m = parts[1].padStart(2, '0');
  return `${PERSIAN_MONTH_NAMES[m] || `ماه ${m}`} ${year}`;
}

export const StandardAccountingReportsView: React.FC<
  StandardAccountingReportsViewProps
> = ({ state, onRecordBotLog }) => {
  const [mainViewTab, setMainViewTab] = useState<'profit_summary' | 'ledger'>(
    'profit_summary'
  );

  const [reportCategory, setReportCategory] = useState<
    'contact' | 'bank' | 'expense' | 'account'
  >('contact');
  const [selectedContactId, setSelectedContactId] = useState(
    state.contacts[0]?.id || ''
  );
  const [selectedBankId, setSelectedBankId] = useState(state.banks[0]?.id || '');
  const [selectedExpenseCode, setSelectedExpenseCode] = useState('ALL_EXPENSES');
  const [selectedAccountCode, setSelectedAccountCode] = useState('1104');

  const [currencyMode, setCurrencyMode] = useState<'rial' | 'foreign'>('rial');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode | 'ALL'>('ALL');
  const [toast, setToast] = useState<string | null>(null);

  // ۱. محاسبه سود خرید و فروش هر ارز (دلار، یورو، درهم، یوان و ...)
  const currencyVaultPositions = useMemo(
    () => calculateCurrencyVaultPositions(state.currencies, state.fxDeals),
    [state.currencies, state.fxDeals]
  );

  // ۲. محاسبه کل هزینه‌ها و درآمدهای جانبی از روی اسناد
  const expenseAndRevenueTotals = useMemo(() => {
    const expenseCodes = new Set(
      state.accounts
        .filter((a) => a.category === 'expense' || a.code.startsWith('5'))
        .map((a) => a.code)
    );
    const revenueCodes = new Set(
      state.accounts
        .filter((a) => a.category === 'revenue' || a.code.startsWith('4'))
        .map((a) => a.code)
    );

    let totalExpensesIRR = 0;
    let totalOtherRevenueIRR = 0;

    state.vouchers.forEach((v) => {
      v.lines.forEach((ln) => {
        if (expenseCodes.has(ln.accountCode)) {
          totalExpensesIRR += Math.max(0, (ln.debitIRR || 0) - (ln.creditIRR || 0));
        }
        if (revenueCodes.has(ln.accountCode)) {
          totalOtherRevenueIRR += Math.max(0, (ln.creditIRR || 0) - (ln.debitIRR || 0));
        }
      });
    });

    return { totalExpensesIRR, totalOtherRevenueIRR };
  }, [state.vouchers, state.accounts]);

  const totalRealizedFXProfitIRR = useMemo(
    () => currencyVaultPositions.reduce((sum, p) => sum + p.realizedProfitIRR, 0),
    [currencyVaultPositions]
  );

  const netOverallProfitIRR =
    totalRealizedFXProfitIRR +
    expenseAndRevenueTotals.totalOtherRevenueIRR -
    expenseAndRevenueTotals.totalExpensesIRR;

  // ۳. محاسبه سود ماهانه به تفکیک هر ماه (مثلاً آبان ۱۴۰۴، مهر ۱۴۰۴ و ...)
  const monthlyProfitBreakdown = useMemo(() => {
    const monthSet = new Set<string>();
    state.fxDeals.forEach((d) => {
      const ym = (d.date || '1404/08').slice(0, 7);
      if (ym) monthSet.add(ym);
    });
    state.vouchers.forEach((v) => {
      const ym = (v.date || '1404/08').slice(0, 7);
      if (ym) monthSet.add(ym);
    });
    if (monthSet.size === 0) {
      monthSet.add('1404/08');
    }

    const expenseCodes = new Set(
      state.accounts
        .filter((a) => a.category === 'expense' || a.code.startsWith('5'))
        .map((a) => a.code)
    );
    const revenueCodes = new Set(
      state.accounts
        .filter((a) => a.category === 'revenue' || a.code.startsWith('4'))
        .map((a) => a.code)
    );

    // میانگین کلی خرید هر ارز برای محاسبه دقیق سود فروش در هر ماه
    const globalAvgBuyByCurrency: Record<string, number> = {};
    currencyVaultPositions.forEach((pos) => {
      globalAvgBuyByCurrency[pos.currency] = pos.weightedAvgBuyRate;
    });

    const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

    return sortedMonths.map((ym) => {
      const monthDeals = state.fxDeals.filter((d) => (d.date || '').startsWith(ym));
      const monthVouchers = state.vouchers.filter((v) => (v.date || '').startsWith(ym));

      let buyTotalIRR = 0;
      let sellTotalIRR = 0;
      let fxProfitMonthIRR = 0;

      monthDeals.forEach((d) => {
        if (d.type === 'buy') {
          buyTotalIRR += d.totalIRR;
        } else {
          sellTotalIRR += d.totalIRR;
          const avgBuy = globalAvgBuyByCurrency[d.currency] || d.exchangeRate;
          fxProfitMonthIRR += Math.round(d.foreignAmount * (d.exchangeRate - avgBuy));
        }
      });

      let monthExpensesIRR = 0;
      let monthOtherRevenuesIRR = 0;

      monthVouchers.forEach((v) => {
        v.lines.forEach((ln) => {
          if (expenseCodes.has(ln.accountCode)) {
            monthExpensesIRR += Math.max(0, (ln.debitIRR || 0) - (ln.creditIRR || 0));
          }
          if (revenueCodes.has(ln.accountCode)) {
            monthOtherRevenuesIRR += Math.max(0, (ln.creditIRR || 0) - (ln.debitIRR || 0));
          }
        });
      });

      const netMonthProfitIRR = fxProfitMonthIRR + monthOtherRevenuesIRR - monthExpensesIRR;

      return {
        ym,
        monthLabel: formatMonthLabel(ym),
        dealsCount: monthDeals.length,
        buyTotalIRR,
        sellTotalIRR,
        fxProfitIRR: fxProfitMonthIRR + monthOtherRevenuesIRR,
        expensesIRR: monthExpensesIRR,
        netProfitIRR: netMonthProfitIRR,
      };
    });
  }, [state.fxDeals, state.vouchers, state.accounts, currencyVaultPositions]);

  // ۴. خلاصه تراز ضد کلاهبرداری (موجودی نقد و بانک + ارزش ارزهای موجود + طلب از مردم - بدهی به مردم)
  const antiCheatNetWorth = useMemo(() => {
    let rialBanksIRR = 0;
    let foreignVaultsIRR = 0;

    state.banks.forEach((b) => {
      const rate =
        b.currency === 'IRR'
          ? 1
          : state.currencies.find((c) => c.code === b.currency)?.defaultRateToIRR || 1;
      let balFor = b.initialBalanceForeign || 0;
      let balIRR = b.initialBalanceIRR || 0;

      state.vouchers.forEach((v) => {
        v.lines.forEach((ln) => {
          if (ln.bankId === b.id) {
            if (b.currency === 'IRR') {
              balIRR += (ln.debitIRR || 0) - (ln.creditIRR || 0);
            } else {
              balFor += (ln.debitForeign || 0) - (ln.creditForeign || 0);
            }
          }
        });
      });

      if (b.currency === 'IRR') {
        rialBanksIRR += balIRR;
      } else {
        foreignVaultsIRR += Math.round(balFor * rate);
      }
    });

    let receivablesIRR = 0;
    let payablesIRR = 0;
    state.contacts.forEach((c) => {
      const st = buildPersonStatement(state.vouchers, c.id);
      if (st.finalStatusIRR === 'بدهکار') receivablesIRR += st.finalBalanceIRR;
      if (st.finalStatusIRR === 'بستانکار') payablesIRR += st.finalBalanceIRR;
    });

    const netWorthIRR = rialBanksIRR + foreignVaultsIRR + receivablesIRR - payablesIRR;

    return {
      rialBanksIRR,
      foreignVaultsIRR,
      receivablesIRR,
      payablesIRR,
      netWorthIRR,
    };
  }, [state.banks, state.currencies, state.vouchers, state.contacts]);

  const expenseAccounts = useMemo(
    () =>
      state.accounts.filter(
        (a) => a.level === 'moein' && (a.category === 'expense' || a.code.startsWith('5'))
      ),
    [state.accounts]
  );

  const moeinAccounts = useMemo(
    () => state.accounts.filter((a) => a.level === 'moein'),
    [state.accounts]
  );

  const targetMeta = useMemo(() => {
    if (reportCategory === 'contact') {
      const c =
        state.contacts.find((x) => x.id === selectedContactId) || state.contacts[0];
      return {
        id: c?.id || '',
        label: `صورتحساب استاندارد شخص: ${c?.name || ''}`,
      };
    }
    if (reportCategory === 'bank') {
      const b = state.banks.find((x) => x.id === selectedBankId) || state.banks[0];
      return {
        id: b?.id || '',
        label: `گردش استاندارد حساب بانک / صرافی: ${b?.bankName || ''} (${b?.currency || ''})`,
      };
    }
    if (reportCategory === 'expense') {
      if (selectedExpenseCode === 'ALL_EXPENSES') {
        return {
          id: 'ALL_EXPENSES',
          label: 'گزارش استاندارد کلیه هزینه‌ها و کارمزدها',
        };
      }
      const exp = expenseAccounts.find((x) => x.code === selectedExpenseCode);
      return {
        id: selectedExpenseCode,
        label: `گزارش استاندارد هزینه: ${exp?.code || ''} - ${exp?.name || ''}`,
      };
    }
    const acc = moeinAccounts.find((x) => x.code === selectedAccountCode);
    return {
      id: selectedAccountCode,
      label: `دفتر معین استاندارد حساب: ${acc?.code || ''} - ${acc?.name || ''}`,
    };
  }, [
    reportCategory,
    selectedContactId,
    selectedBankId,
    selectedExpenseCode,
    selectedAccountCode,
    state.contacts,
    state.banks,
    expenseAccounts,
    moeinAccounts,
  ]);

  const ledgerReport = useMemo(() => {
    return buildStandardLedgerReport({
      vouchers: state.vouchers,
      accounts: state.accounts,
      filterType: reportCategory,
      targetId: targetMeta.id,
      targetLabel: targetMeta.label,
      currencyMode,
      currencyFilter,
    });
  }, [
    state.vouchers,
    state.accounts,
    reportCategory,
    targetMeta,
    currencyMode,
    currencyFilter,
  ]);

  const handlePrintOrPDF = (mode: 'print' | 'download_pdf_html') => {
    exportOrPrintStandardLedgerPDF(
      ledgerReport,
      state.companyName,
      state.fiscalYear,
      mode
    );
    setToast(
      mode === 'print'
        ? 'پنجره رسمی چاپ و ذخیره PDF باز شد.'
        : 'فایل گزارش استاندارد با قالب رسمی A4 دانلود شد.'
    );
  };

  const handleSendReportToBot = async (platform: 'bale' | 'telegram') => {
    const isRial = currencyMode === 'rial';
    const text =
      `📊 *${ledgerReport.reportTitle}*\n` +
      `🏢 ${state.companyName}\n` +
      `📋 نوع گزارش: ${isRial ? 'استاندارد ریالی' : 'استاندارد ارزی با اعشار'}\n` +
      `----------------------------------\n` +
      (isRial
        ? `📥 جمع بدهکار: ${formatNumber(ledgerReport.totalDebitIRR)} ریال\n` +
          `📤 جمع بستانکار: ${formatNumber(ledgerReport.totalCreditIRR)} ریال\n` +
          `⚖️ *مانده نهایی:* ${formatNumber(
            ledgerReport.finalBalanceIRR
          )} ریال (${ledgerReport.finalDiagnosisIRR})`
        : `📥 جمع بدهکار ارزی: ${formatCurrencyAmount(
            ledgerReport.totalDebitForeign,
            ledgerReport.selectedCurrency
          )} ${ledgerReport.selectedCurrency}\n` +
          `📤 جمع بستانکار ارزی: ${formatCurrencyAmount(
            ledgerReport.totalCreditForeign,
            ledgerReport.selectedCurrency
          )} ${ledgerReport.selectedCurrency}\n` +
          `⚖️ *مانده نهایی ارزی:* ${formatCurrencyAmount(
            ledgerReport.finalBalanceForeign,
            ledgerReport.selectedCurrency
          )} ${ledgerReport.selectedCurrency} (${
            ledgerReport.finalDiagnosisForeign
          })`);

    const log = await dispatchToMessengerBot({
      platform,
      botToken:
        platform === 'bale'
          ? state.botConfig.baleBotToken
          : state.botConfig.telegramBotToken,
      chatId:
        platform === 'bale'
          ? state.botConfig.baleDefaultChatId
          : state.botConfig.telegramDefaultChatId,
      recipientName: targetMeta.label,
      messageType: isRial ? 'statement_rial' : 'statement_foreign',
      text,
      summary: `ارسال ${targetMeta.label} به ربات ${
        platform === 'bale' ? 'بله' : 'تلگرام'
      }`,
    });

    onRecordBotLog(log);
    setToast(
      `گزارش «${targetMeta.label}» با موفقیت به ربات ${
        platform === 'bale' ? 'بله (Bale)' : 'تلگرام (Telegram)'
      } ارسال گردید.`
    );
  };

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* نوار انتخاب تب اصلی: ۱. سود ماهانه و سود ارزها | ۲. کاردکس ریز گردش حساب‌ها */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
              گزارش سود ماهانه، سود خرید و فروش هر ارز و تراز کلی دارایی
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              محاسبه ۱۰۰٪ خودکار سود شما از اختلاف قیمت خرید و فروش دلار، یورو و سایر ارزها به زبان ساده و بدون پیچیدگی حسابداری
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              exportOrPrintProfitStatementPDF({
                monthlyProfitBreakdown,
                currencyVaultPositions,
                antiCheatNetWorth,
                companyName: state.companyName || 'صرافی آرکا',
                fiscalYear: state.fiscalYear || '۱۴۰۴',
                mode: 'print',
              })
            }
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            چاپ گزارش سود و زیان
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMainViewTab('profit_summary')}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 ${
              mainViewTab === 'profit_summary'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>۱. سود ماهانه و سود خرید و فروش هر ارز (ویژه مدیر)</span>
          </button>

          <button
            type="button"
            onClick={() => setMainViewTab('ledger')}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 ${
              mainViewTab === 'ledger'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>۲. کاردکس ریز گردش بانک‌ها، اشخاص و هزینه‌ها (PDF)</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs underline cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب اول: گزارش سود ماهانه و سود خرید و فروش هر ارز (به زبان ساده) */}
      {/* ===================================================================== */}
      {mainViewTab === 'profit_summary' && (
        <div className="space-y-5">
          {/* ۳ کارت بزرگ خلاصه سود کل */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-emerald-900">
                  🟢 سود حاصل از خرید و فروش ارزها
                </span>
                <Coins className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold text-emerald-700 font-mono-num">
                {formatNumber(totalRealizedFXProfitIRR + expenseAndRevenueTotals.totalOtherRevenueIRR)} ریال
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                سود ناخالص از اختلاف نرخ خرید و فروش ارزها و درآمدهای ثبت‌شده
              </p>
            </div>

            <div className="bg-white border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-amber-900">
                  🟠 کل هزینه‌ها و کارمزدهای ثبت‌شده
                </span>
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-xl font-extrabold text-amber-800 font-mono-num">
                {formatNumber(expenseAndRevenueTotals.totalExpensesIRR)} ریال
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                جمع اجاره، حقوق، کارمزد بانکی و خرج‌های ثبت‌شده
              </p>
            </div>

            <div className="bg-emerald-600 text-white rounded-2xl p-4 sm:p-5 shadow-md shadow-emerald-600/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-emerald-50">
                  💎 سود خالص نهایی شما (بعد از کسر هزینه)
                </span>
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono-num">
                {formatNumber(netOverallProfitIRR)} ریال
              </div>
              <p className="text-[11px] text-emerald-100 mt-1">
                مبلغی که پس از کسر تمام هزینه‌ها خالص برای شما باقی مانده است
              </p>
            </div>
          </div>

          {/* جدول سود ماهانه به تفکیک ماه‌های سال */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600 shrink-0" />
                  گزارش سود ماهانه (به تفکیک هر ماه)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  ببینید در هر ماه چقدر ارز خرید و فروش کرده‌اید، چقدر خرج کرده‌اید و چقدر سود خالص داشته‌اید.
                </p>
              </div>
            </div>

            {/* کارت‌های موبایل برای سود ماهانه */}
            <div className="sm:hidden space-y-3">
              {monthlyProfitBreakdown.map((m) => (
                <div
                  key={m.ym}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      📅 {m.monthLabel}
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg font-mono-num text-[11px] text-slate-600">
                      {formatNumber(m.dealsCount)} معامله ارز
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono-num text-[11px]">
                    <div>
                      <span className="text-slate-500 block font-sans">کل خرید ارز ماه:</span>
                      <strong className="text-slate-800">{formatNumber(m.buyTotalIRR)} ریال</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">کل فروش ارز ماه:</span>
                      <strong className="text-slate-800">{formatNumber(m.sellTotalIRR)} ریال</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">سود معاملات ارز:</span>
                      <strong className="text-emerald-700">{formatNumber(m.fxProfitIRR)} ریال</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">هزینه‌های ماه:</span>
                      <strong className="text-amber-800">{formatNumber(m.expensesIRR)} ریال</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono-num">
                    <span className="font-extrabold text-slate-800 font-sans">سود خالص این ماه:</span>
                    <span
                      className={`text-sm font-extrabold px-2.5 py-0.5 rounded-lg ${
                        m.netProfitIRR >= 0
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {formatNumber(m.netProfitIRR)} ریال
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* جدول دسکتاپ برای سود ماهانه */}
            <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-800">
                    <th className="py-3 px-3">ماه و سال</th>
                    <th className="py-3 px-3 text-center">تعداد معاملات ارز</th>
                    <th className="py-3 px-3 text-left">جمع کل خرید ارز (ریال)</th>
                    <th className="py-3 px-3 text-left">جمع کل فروش ارز (ریال)</th>
                    <th className="py-3 px-3 text-left text-emerald-800">سود معاملات و درآمد (ریال)</th>
                    <th className="py-3 px-3 text-left text-amber-800">کسر هزینه‌های ماه (ریال)</th>
                    <th className="py-3 px-3 text-left bg-emerald-50 text-emerald-950">
                      سود خالص قطعی ماه (ریال)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono-num">
                  {monthlyProfitBreakdown.map((m) => (
                    <tr key={m.ym} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-sans font-extrabold text-slate-900">
                        📅 {m.monthLabel} ({m.ym})
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {formatNumber(m.dealsCount)} معامله
                      </td>
                      <td className="py-3 px-3 text-left text-slate-700">
                        {formatNumber(m.buyTotalIRR)}
                      </td>
                      <td className="py-3 px-3 text-left text-slate-700">
                        {formatNumber(m.sellTotalIRR)}
                      </td>
                      <td className="py-3 px-3 text-left font-bold text-emerald-700">
                        {formatNumber(m.fxProfitIRR)}
                      </td>
                      <td className="py-3 px-3 text-left font-bold text-amber-800">
                        {formatNumber(m.expensesIRR)}
                      </td>
                      <td
                        className={`py-3 px-3 text-left font-extrabold bg-emerald-50/70 ${
                          m.netProfitIRR >= 0 ? 'text-emerald-900' : 'text-rose-700'
                        }`}
                      >
                        {formatNumber(m.netProfitIRR)} ریال
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* جدول سود خرید و فروش به تفکیک هر ارز (دلار، یورو، درهم، یوان...) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500 shrink-0" />
                ریز سود خرید و فروش به تفکیک هر ارز (دلار، یورو، درهم، یوان و ...)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                بر اساس میانگین قیمت خرید شما و میانگین قیمت فروش شما برای هر ارز محاسبه شده است.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {currencyVaultPositions.map((pos) => {
                const spreadPerUnit = pos.weightedAvgSellRate - pos.weightedAvgBuyRate;
                return (
                  <div
                    key={pos.currency}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div>
                        <span className="text-sm font-extrabold text-slate-900">
                          {pos.currencyName} ({pos.currency})
                        </span>
                        <span className="block text-[11px] text-slate-500 font-mono-num">
                          نرخ روز تابلو: {formatNumber(pos.currentMarketRate)} ریال
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-500 block">موجودی فعلی این ارز:</span>
                        <strong className="font-mono-num text-sm font-extrabold text-teal-800">
                          {formatCurrencyAmount(pos.netVaultBalanceForeign, pos.currency)}{' '}
                          {pos.currency}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">کل خریداری‌شده:</span>
                        <strong className="font-mono-num font-extrabold text-slate-900 block mt-0.5">
                          {formatCurrencyAmount(pos.totalBoughtForeign, pos.currency)}{' '}
                          {pos.currency}
                        </strong>
                        <span className="text-[11px] text-emerald-700 font-mono-num font-bold block mt-0.5">
                          میانگین خرید: {formatNumber(pos.weightedAvgBuyRate)} ریال
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] text-slate-500 block">کل فروخته‌شده:</span>
                        <strong className="font-mono-num font-extrabold text-slate-900 block mt-0.5">
                          {formatCurrencyAmount(pos.totalSoldForeign, pos.currency)}{' '}
                          {pos.currency}
                        </strong>
                        <span className="text-[11px] text-amber-800 font-mono-num font-bold block mt-0.5">
                          میانگین فروش: {formatNumber(pos.weightedAvgSellRate)} ریال
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-emerald-950 block">
                          سود خالص از معاملات {pos.currencyName}:
                        </span>
                        <span className="text-[11px] text-emerald-800 font-mono-num">
                          سود هر ۱ {pos.currency}: {formatNumber(spreadPerUnit)} ریال
                        </span>
                      </div>
                      <strong className="font-mono-num text-sm sm:text-base font-extrabold text-emerald-900">
                        {formatNumber(pos.realizedProfitIRR)} ریال
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* باکس ضد کلاهبرداری: تراز کلی سرمایه و دارایی شما در یک نگاه */}
          <div className="bg-blue-50/70 border-2 border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
              <h3 className="text-sm sm:text-base font-extrabold text-blue-950">
                ترازنامه ساده و ضد کلاهبرداری (کل دارایی خالص شما همین لحظه چقدر است؟)
              </h3>
            </div>
            <p className="text-xs text-slate-700">
              این فرمول به زبان ساده نشان می‌دهد اگر همین امروز تمام طلب‌هایتان را از مردم بگیرید و تمام بدهی‌هایتان را بدهید، در کل چقدر سرمایه دارید:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs font-mono-num">
              <div className="bg-white p-3 rounded-xl border border-blue-200">
                <span className="text-[11px] text-slate-500 font-sans block">
                  ۱. پول نقد و بانک‌های ریالی:
                </span>
                <strong className="text-slate-900 font-extrabold text-sm">
                  {formatNumber(antiCheatNetWorth.rialBanksIRR)} ریال
                </strong>
              </div>

              <div className="bg-white p-3 rounded-xl border border-blue-200">
                <span className="text-[11px] text-slate-500 font-sans block">
                  ۲. به علاوه ارزش ارزهای موجود:
                </span>
                <strong className="text-amber-900 font-extrabold text-sm">
                  + {formatNumber(antiCheatNetWorth.foreignVaultsIRR)} ریال
                </strong>
              </div>

              <div className="bg-white p-3 rounded-xl border border-blue-200">
                <span className="text-[11px] text-slate-500 font-sans block">
                  ۳. به علاوه کل طلب از مردم:
                </span>
                <strong className="text-emerald-700 font-extrabold text-sm">
                  + {formatNumber(antiCheatNetWorth.receivablesIRR)} ریال
                </strong>
              </div>

              <div className="bg-white p-3 rounded-xl border border-blue-200">
                <span className="text-[11px] text-slate-500 font-sans block">
                  ۴. منهای کل بدهی به مردم:
                </span>
                <strong className="text-rose-700 font-extrabold text-sm">
                  - {formatNumber(antiCheatNetWorth.payablesIRR)} ریال
                </strong>
              </div>

              <div className="bg-blue-700 text-white p-3 rounded-xl shadow-xs">
                <span className="text-[11px] text-blue-100 font-sans block font-bold">
                  = کل سرمایه خالص شما:
                </span>
                <strong className="font-extrabold text-sm sm:text-base">
                  {formatNumber(antiCheatNetWorth.netWorthIRR)} ریال
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب دوم: کاردکس ریز گردش حساب‌ها و چاپ PDF استاندارد */}
      {/* ===================================================================== */}
      {mainViewTab === 'ledger' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  کاردکس ریز گردش اشخاص، بانک‌ها و هزینه‌ها (با خروجی PDF و چاپ A4)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  هر ردیف را انتخاب کنید تا ریز تراکنش‌های آن به ترتیب تاریخ با مانده لحظه‌ای نمایش داده شود.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintOrPDF('download_pdf_html')}
                  className="px-3.5 py-2 text-xs font-extrabold bg-blue-700 hover:bg-blue-800 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileDown className="w-4 h-4" />
                  خروجی PDF (A4)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintOrPDF('print')}
                  className="px-3.5 py-2 text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  چاپ مستقیم
                </button>
                <button
                  type="button"
                  onClick={() => handleSendReportToBot('bale')}
                  className="px-3 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  ارسال به بله
                </button>
                <button
                  type="button"
                  onClick={() => handleSendReportToBot('telegram')}
                  className="px-3 py-2 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  ارسال به تلگرام
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setReportCategory('contact')}
                className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                  reportCategory === 'contact'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 font-extrabold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                }`}
              >
                <Users className="w-5 h-5 text-blue-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold">۱. صورتحساب اشخاص و مشتریان</div>
                  <div className="text-[11px] text-slate-500">گردش بدهکار/بستانکار و مانده شخص</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportCategory('bank')}
                className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                  reportCategory === 'bank'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 font-extrabold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                }`}
              >
                <Landmark className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold">۲. گزارش گردش بانک‌ها و صندوق</div>
                  <div className="text-[11px] text-slate-500">ریز واریز، برداشت و مانده بانک</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportCategory('expense')}
                className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                  reportCategory === 'expense'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 font-extrabold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                }`}
              >
                <Receipt className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold">۳. گزارش هزینه‌ها و کارمزدها</div>
                  <div className="text-[11px] text-slate-500">گردش هزینه‌ها از بالا به پایین</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportCategory('account')}
                className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 ${
                  reportCategory === 'account'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 font-extrabold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                }`}
              >
                <BookOpen className="w-5 h-5 text-purple-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold">۴. دفتر معین کلیه سرفصل‌ها</div>
                  <div className="text-[11px] text-slate-500">گزارش استاندارد هر سرفصل دلخواه</div>
                </div>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2 border-t border-slate-200">
              <div className="md:col-span-5">
                {reportCategory === 'contact' && (
                  <>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      انتخاب شخص / مشتری:
                    </label>
                    <select
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                    >
                      {state.contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name} (ارز پیش‌فرض: {c.defaultCurrency})
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {reportCategory === 'bank' && (
                  <>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      انتخاب حساب بانکی یا خزانه ارزی:
                    </label>
                    <select
                      value={selectedBankId}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                    >
                      {state.banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} ({b.currency}) — شماره حساب: {b.accountNumber}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {reportCategory === 'expense' && (
                  <>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      انتخاب سرفصل هزینه:
                    </label>
                    <select
                      value={selectedExpenseCode}
                      onChange={(e) => setSelectedExpenseCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                    >
                      <option value="ALL_EXPENSES">
                        تمامی سرفصل‌های هزینه و کارمزد (تجمیعی)
                      </option>
                      {expenseAccounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {reportCategory === 'account' && (
                  <>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      انتخاب سرفصل حساب معین:
                    </label>
                    <select
                      value={selectedAccountCode}
                      onChange={(e) => setSelectedAccountCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                    >
                      {moeinAccounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع نمایش مبالغ:
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrencyMode('rial')}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${
                      currencyMode === 'rial'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    ۱. ریالی (IRR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrencyMode('foreign')}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${
                      currencyMode === 'foreign'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    ۲. ارزی (.00)
                  </button>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  فیلتر نوع ارز:
                </label>
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-num font-bold bg-white border border-slate-300 rounded-xl"
                >
                  <option value="ALL">همه ارزها (ریال + ارزها)</option>
                  {state.currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      فقط تراکنش‌های {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* جدول و کارت‌های کاردکس */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {ledgerReport.reportTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
                  {ledgerReport.reportSubtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 ml-1">جمع بدهکار:</span>
                  <strong className="font-mono-num text-amber-800" dir="ltr">
                    {currencyMode === 'rial'
                      ? `${formatNumber(ledgerReport.totalDebitIRR)} ریال`
                      : `${formatCurrencyAmount(
                          ledgerReport.totalDebitForeign,
                          ledgerReport.selectedCurrency
                        )} ${ledgerReport.selectedCurrency}`}
                  </strong>
                </div>
                <span className="text-slate-300">|</span>
                <div>
                  <span className="text-slate-500 ml-1">جمع بستانکار:</span>
                  <strong className="font-mono-num text-emerald-800" dir="ltr">
                    {currencyMode === 'rial'
                      ? `${formatNumber(ledgerReport.totalCreditIRR)} ریال`
                      : `${formatCurrencyAmount(
                          ledgerReport.totalCreditForeign,
                          ledgerReport.selectedCurrency
                        )} ${ledgerReport.selectedCurrency}`}
                  </strong>
                </div>
                <span className="text-slate-300">|</span>
                <div>
                  <span className="text-slate-500 ml-1">مانده نهایی:</span>
                  <strong className="font-mono-num text-sm text-blue-900" dir="ltr">
                    {currencyMode === 'rial'
                      ? `${formatNumber(ledgerReport.finalBalanceIRR)} ریال (${ledgerReport.finalDiagnosisIRR})`
                      : `${formatCurrencyAmount(
                          ledgerReport.finalBalanceForeign,
                          ledgerReport.selectedCurrency
                        )} ${ledgerReport.selectedCurrency} (${
                          ledgerReport.finalDiagnosisForeign
                        })`}
                  </strong>
                </div>
              </div>
            </div>

            {/* Mobile Ledger Cards */}
            <div className="sm:hidden space-y-3">
              {ledgerReport.rows.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  هیچ گردش حسابی برای این ردیف یافت نشد.
                </div>
              ) : (
                ledgerReport.rows.map((row) => (
                  <div
                    key={row.lineId}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono-num">
                      <span className="font-bold text-blue-700">سند #{row.voucherNumber}</span>
                      <span className="text-slate-500 text-[11px]">{row.date}</span>
                    </div>

                    <div className="font-bold text-slate-900 leading-snug">
                      {row.description}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 font-mono-num text-[11px]">
                      <div>
                        <span className="text-slate-500 block">بدهکار:</span>
                        <span className="font-bold text-amber-800">
                          {currencyMode === 'rial'
                            ? `${formatNumber(row.debitIRR)} ریال`
                            : `${formatCurrencyAmount(row.debitForeign, row.currency)} ${row.currency}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">بستانکار:</span>
                        <span className="font-bold text-emerald-800">
                          {currencyMode === 'rial'
                            ? `${formatNumber(row.creditIRR)} ریال`
                            : `${formatCurrencyAmount(row.creditForeign, row.currency)} ${row.currency}`}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono-num">
                      <span className="text-slate-600 font-medium">مانده تا این ردیف:</span>
                      <span className="font-extrabold text-blue-950 bg-blue-100/80 px-2 py-0.5 rounded">
                        {currencyMode === 'rial'
                          ? `${formatNumber(row.runningBalanceIRR)} ریال (${row.diagnosisIRR})`
                          : `${formatCurrencyAmount(row.runningBalanceForeign, row.currency)} ${row.currency} (${row.diagnosisForeign})`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto border border-slate-300 rounded-xl">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  {currencyMode === 'rial' ? (
                    <tr className="bg-slate-800 text-white font-bold">
                      <th className="py-3 px-3 text-center w-12">ردیف</th>
                      <th className="py-3 px-3 text-center w-24">تاریخ</th>
                      <th className="py-3 px-3 text-center w-20">سند</th>
                      <th className="py-3 px-3">سرفصل حساب</th>
                      <th className="py-3 px-3">شرح کامل عملیات</th>
                      <th className="py-3 px-3 text-center">ارز و نرخ</th>
                      <th className="py-3 px-3 text-left bg-amber-900/40">بدهکار (ریال)</th>
                      <th className="py-3 px-3 text-left bg-emerald-900/40">بستانکار (ریال)</th>
                      <th className="py-3 px-3 text-center w-20">تشخیص</th>
                      <th className="py-3 px-3 text-left bg-blue-900">
                        مانده لحظه‌ای (ریال) ↓
                      </th>
                    </tr>
                  ) : (
                    <tr className="bg-slate-800 text-white font-bold">
                      <th className="py-3 px-3 text-center w-12">ردیف</th>
                      <th className="py-3 px-3 text-center w-24">تاریخ</th>
                      <th className="py-3 px-3 text-center w-20">سند</th>
                      <th className="py-3 px-3">شرح کامل عملیات ارزی</th>
                      <th className="py-3 px-3 text-center">ارز</th>
                      <th className="py-3 px-3 text-left">نرخ تبدیل</th>
                      <th className="py-3 px-3 text-left bg-amber-900/40">بدهکار ارزی</th>
                      <th className="py-3 px-3 text-left bg-emerald-900/40">بستانکار ارزی</th>
                      <th className="py-3 px-3 text-center w-20">تشخیص</th>
                      <th className="py-3 px-3 text-left bg-emerald-950">مانده ارزی ↓</th>
                      <th className="py-3 px-3 text-left">معادل (ریال)</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledgerReport.rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500">
                        هیچ گردش حسابی برای این ردیف یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    ledgerReport.rows.map((row) =>
                      currencyMode === 'rial' ? (
                        <tr key={row.lineId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-mono-num text-slate-500">
                            {row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-num">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-num font-bold text-blue-700">
                            #{row.voucherNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {row.accountCode} - {row.accountName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-medium">
                            {row.description}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-num text-slate-600">
                            {row.currency === 'IRR'
                              ? 'ریال (IRR)'
                              : `${row.currency} (${formatNumber(row.exchangeRate)})`}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left font-bold text-slate-900 bg-amber-50/30"
                          >
                            {formatNumber(row.debitIRR)}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left font-bold text-slate-900 bg-emerald-50/30"
                          >
                            {formatNumber(row.creditIRR)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            <span
                              className={
                                row.diagnosisIRR === 'بدهکار'
                                  ? 'text-amber-700'
                                  : row.diagnosisIRR === 'بستانکار'
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                              }
                            >
                              {row.diagnosisIRR}
                            </span>
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left font-extrabold bg-blue-50/70 text-blue-950"
                          >
                            {formatNumber(row.runningBalanceIRR)}
                          </td>
                        </tr>
                      ) : (
                        <tr key={row.lineId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-mono-num text-slate-500">
                            {row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-num">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-num font-bold text-blue-700">
                            #{row.voucherNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-medium">
                            {row.description}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono-num font-extrabold text-blue-800">
                            {row.currency}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left text-slate-600"
                          >
                            {formatNumber(row.exchangeRate)}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left font-bold text-slate-900 bg-amber-50/30"
                          >
                            {formatCurrencyAmount(row.debitForeign, row.currency)}{' '}
                            {row.currency}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left font-bold text-slate-900 bg-emerald-50/30"
                          >
                            {formatCurrencyAmount(row.creditForeign, row.currency)}{' '}
                            {row.currency}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {row.diagnosisForeign}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left font-extrabold bg-emerald-50/70 text-emerald-950"
                          >
                            {formatCurrencyAmount(
                              row.runningBalanceForeign,
                              row.currency
                            )}{' '}
                            {row.currency}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3 font-mono-num text-left text-slate-600"
                          >
                            {formatNumber(row.runningBalanceIRR)} ریال
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
