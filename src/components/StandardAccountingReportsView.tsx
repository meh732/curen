import React, { useMemo, useState } from 'react';
import {
  AccountingState,
  BotDeliveryLog,
  CurrencyCode,
} from '../types/accounting';
import {
  buildStandardLedgerReport,
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import { exportOrPrintStandardLedgerPDF } from '../utils/pdfPrintReportService';
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
} from 'lucide-react';

interface StandardAccountingReportsViewProps {
  state: AccountingState;
  onRecordBotLog: (log: BotDeliveryLog) => void;
}

export const StandardAccountingReportsView: React.FC<
  StandardAccountingReportsViewProps
> = ({ state, onRecordBotLog }) => {
  const [reportCategory, setReportCategory] = useState<
    'contact' | 'bank' | 'expense' | 'account'
  >('contact');
  const [selectedContactId, setSelectedContactId] = useState(
    state.contacts[0]?.id || ''
  );
  const [selectedBankId, setSelectedBankId] = useState(state.banks[0]?.id || '');
  const [selectedExpenseCode, setSelectedExpenseCode] = useState('ALL_EXPENSES');
  const [selectedAccountCode, setSelectedAccountCode] = useState('1104');

  // Two standard modes: 1) صورتحساب ریالی (بدون اعشار، ۳ رقم ۳ رقم) 2) صورتحساب ارزی (با ۲ رقم اعشار .00 و ۳ رقم ۳ رقم)
  const [currencyMode, setCurrencyMode] = useState<'rial' | 'foreign'>('rial');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode | 'ALL'>('ALL');
  const [toast, setToast] = useState<string | null>(null);

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
          label: 'گزارش استاندارد کلیه هزینه‌ها و کارمزدها (از بالا به پایین)',
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
        ? 'پنجره رسمی چاپ و ذخیره PDF استاندارد حسابداری باز شد (در پنجره چاپ می‌توانید گزینه Save as PDF را انتخاب کنید).'
        : 'فایل گزارش استاندارد حسابداری با قالب رسمی A4 دانلود شد و پنجره خروجی PDF باز گردید.'
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
          `⚖️ *مانده نهایی از بالا به پایین:* ${formatNumber(
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
    <div className="space-y-6">
      {/* Beginner-Friendly Category Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              گزارشات استاندارد حسابداری (بانک‌ها، اشخاص، هزینه‌ها و سرفصل‌ها) — همراه با خروجی PDF و چاپ
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              تمامی گزارش‌ها دارای ستون‌های استاندارد <strong>بدهکار</strong>، <strong>بستانکار</strong>، <strong>تشخیص</strong> و <strong>مانده در گردش از بالا به پایین</strong> هستند. اعداد ریالی ۳ رقم ۳ رقم و اعداد ارزی با ۲ رقم اعشار دقیق نمایش داده می‌شوند.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrintOrPDF('download_pdf_html')}
              className="px-4 py-2.5 text-xs font-extrabold bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <FileDown className="w-4 h-4" />
              خروجی دقیق PDF استاندارد (A4)
            </button>
            <button
              type="button"
              onClick={() => handlePrintOrPDF('print')}
              className="px-4 py-2.5 text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white rounded-lg flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              چاپ مستقیم گزارش (Print)
            </button>
            <button
              type="button"
              onClick={() => handleSendReportToBot('bale')}
              className="px-3.5 py-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              ارسال به بله
            </button>
            <button
              type="button"
              onClick={() => handleSendReportToBot('telegram')}
              className="px-3.5 py-2.5 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              ارسال به تلگرام
            </button>
          </div>
        </div>

        {/* 4 Simple Large Buttons for Beginners: Persons | Banks | Expenses | Accounts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
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
              <div className="text-xs font-bold">۲. گزارش گردش بانک‌ها و صرافی</div>
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

        {/* Filter Bar: Target Selector + Rial vs Foreign Mode */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2 border-t border-slate-200">
          <div className="md:col-span-5">
            {reportCategory === 'contact' && (
              <>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  انتخاب شخص / مشتری / صرافی:
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  aria-label="انتخاب شخص جهت گزارش"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
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
                  aria-label="انتخاب بانک جهت گزارش"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
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
                  aria-label="انتخاب سرفصل هزینه"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
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
                  aria-label="انتخاب سرفصل حساب معین"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg"
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
              نوع نمایش مبالغ صورتحساب (ریالی یا ارزی با اعشار):
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setCurrencyMode('rial')}
                className={`py-2 px-3 text-xs font-extrabold rounded-md transition-colors cursor-pointer ${
                  currencyMode === 'rial'
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                ۱. صورتحساب ریالی (IRR)
              </button>
              <button
                type="button"
                onClick={() => setCurrencyMode('foreign')}
                className={`py-2 px-3 text-xs font-extrabold rounded-md transition-colors cursor-pointer ${
                  currencyMode === 'foreign'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                ۲. صورتحساب ارزی (.00)
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
              aria-label="فیلتر نوع ارز در گزارش"
              className="w-full px-3 py-2 text-xs font-mono-num font-bold bg-white border border-slate-300 rounded-lg"
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

      {toast && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs underline"
          >
            بستن
          </button>
        </div>
      )}

      {/* Official Standard Accounting Ledger Table (Top-to-Bottom Running Balance) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
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

          <div className="flex flex-wrap items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 text-xs">
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

        {/* Mobile Ledger Cards (sm:hidden) to avoid horizontal scrolling on phones */}
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

                <div className="text-[11px] text-slate-600">
                  سرفصل: {row.accountCode} - {row.accountName}
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
        <div className="hidden sm:block overflow-x-auto border border-slate-300 rounded-lg">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              {currencyMode === 'rial' ? (
                <tr className="bg-slate-800 text-white font-bold">
                  <th className="py-3 px-3 text-center w-12">ردیف</th>
                  <th className="py-3 px-3 text-center w-24">تاریخ</th>
                  <th className="py-3 px-3 text-center w-20">شماره سند</th>
                  <th className="py-3 px-3">سرفصل حساب</th>
                  <th className="py-3 px-3">شرح کامل عملیات حسابداری</th>
                  <th className="py-3 px-3 text-center">ارز و نرخ تبدیل</th>
                  <th className="py-3 px-3 text-left bg-amber-900/40">بدهکار (ریال)</th>
                  <th className="py-3 px-3 text-left bg-emerald-900/40">بستانکار (ریال)</th>
                  <th className="py-3 px-3 text-center w-20">تشخیص</th>
                  <th className="py-3 px-3 text-left bg-blue-900">
                    مانده از بالا به پایین (ریال) ↓
                  </th>
                </tr>
              ) : (
                <tr className="bg-slate-800 text-white font-bold">
                  <th className="py-3 px-3 text-center w-12">ردیف</th>
                  <th className="py-3 px-3 text-center w-24">تاریخ</th>
                  <th className="py-3 px-3 text-center w-20">شماره سند</th>
                  <th className="py-3 px-3">شرح کامل عملیات ارزی</th>
                  <th className="py-3 px-3 text-center">ارز</th>
                  <th className="py-3 px-3 text-left">نرخ تبدیل (ریال)</th>
                  <th className="py-3 px-3 text-left bg-amber-900/40">
                    بدهکار ارزی (با اعشار)
                  </th>
                  <th className="py-3 px-3 text-left bg-emerald-900/40">
                    بستانکار ارزی (با اعشار)
                  </th>
                  <th className="py-3 px-3 text-center w-20">تشخیص</th>
                  <th className="py-3 px-3 text-left bg-emerald-950">
                    مانده از بالا به پایین ارزی ↓
                  </th>
                  <th className="py-3 px-3 text-left">معادل مانده (ریال)</th>
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
            <tfoot>
              {currencyMode === 'rial' ? (
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-extrabold text-xs">
                  <td colSpan={6} className="py-3 px-3 text-left text-slate-800">
                    جمع کل گردش بدهکار و بستانکار و مانده نهایی در پایان دوره:
                  </td>
                  <td dir="ltr" className="py-3 px-3 font-mono-num text-left text-amber-900">
                    {formatNumber(ledgerReport.totalDebitIRR)}
                  </td>
                  <td dir="ltr" className="py-3 px-3 font-mono-num text-left text-emerald-900">
                    {formatNumber(ledgerReport.totalCreditIRR)}
                  </td>
                  <td className="py-3 px-3 text-center text-blue-900">
                    {ledgerReport.finalDiagnosisIRR}
                  </td>
                  <td
                    dir="ltr"
                    className="py-3 px-3 font-mono-num text-left bg-blue-100 text-blue-950"
                  >
                    {formatNumber(ledgerReport.finalBalanceIRR)} ریال
                  </td>
                </tr>
              ) : (
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-extrabold text-xs">
                  <td colSpan={6} className="py-3 px-3 text-left text-slate-800">
                    جمع کل گردش ارزی (با دو رقم اعشار) و مانده نهایی:
                  </td>
                  <td dir="ltr" className="py-3 px-3 font-mono-num text-left text-amber-900">
                    {formatCurrencyAmount(
                      ledgerReport.totalDebitForeign,
                      ledgerReport.selectedCurrency
                    )}
                  </td>
                  <td dir="ltr" className="py-3 px-3 font-mono-num text-left text-emerald-900">
                    {formatCurrencyAmount(
                      ledgerReport.totalCreditForeign,
                      ledgerReport.selectedCurrency
                    )}
                  </td>
                  <td className="py-3 px-3 text-center text-emerald-900">
                    {ledgerReport.finalDiagnosisForeign}
                  </td>
                  <td
                    dir="ltr"
                    className="py-3 px-3 font-mono-num text-left bg-emerald-100 text-emerald-950"
                  >
                    {formatCurrencyAmount(
                      ledgerReport.finalBalanceForeign,
                      ledgerReport.selectedCurrency
                    )}{' '}
                    {ledgerReport.selectedCurrency}
                  </td>
                  <td dir="ltr" className="py-3 px-3 font-mono-num text-left text-slate-800">
                    {formatNumber(ledgerReport.finalBalanceIRR)} ریال
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
