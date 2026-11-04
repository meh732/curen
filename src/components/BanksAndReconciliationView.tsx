import React, { useMemo, useState } from 'react';
import {
  Account,
  AccountingState,
  BankAccount,
  BankStatementEntry,
  CurrencyCode,
} from '../types/accounting';
import {
  buildStandardLedgerReport,
  buildTrialBalance,
  convertForeignToIRR,
  formatCurrencyAmount,
  formatNumber,
  reconcileBankTransactions,
} from '../utils/accountingEngine';
import { exportOrPrintStandardLedgerPDF } from '../utils/pdfPrintReportService';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  Landmark,
  Scale,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileDown,
  Printer,
} from 'lucide-react';

interface BanksAndReconciliationViewProps {
  state: AccountingState;
  onAddBank: (bank: BankAccount) => void;
  onAddBankStatementEntry: (entry: BankStatementEntry) => void;
  onRecordBankDiscrepancyVoucher: (entry: BankStatementEntry, bank: BankAccount) => void;
  onAddAccount: (account: Account) => void;
  onUpdateCurrencyRate: (code: CurrencyCode, newRate: number) => void;
}

export const BanksAndReconciliationView: React.FC<BanksAndReconciliationViewProps> = ({
  state,
  onAddBank,
  onAddBankStatementEntry,
  onRecordBankDiscrepancyVoucher,
  onAddAccount,
  onUpdateCurrencyRate,
}) => {
  const [subTab, setSubTab] = useState<
    'reconciliation' | 'banks' | 'chart_of_accounts' | 'trial_balance' | 'currencies'
  >('reconciliation');

  const [selectedBankId, setSelectedBankId] = useState(state.banks[0]?.id || '');
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Bank Statement Entry State
  const [stDate, setStDate] = useState('1404/08/12');
  const [stTracking, setStTracking] = useState('');
  const [stDesc, setStDesc] = useState('');
  const [stDeposit, setStDeposit] = useState<number>(0);
  const [stWithdrawal, setStWithdrawal] = useState<number>(0);

  // New Bank Definition State
  const [newBankName, setNewBankName] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newAccNum, setNewAccNum] = useState('');
  const [newSheba, setNewSheba] = useState('');
  const [newBankCurr, setNewBankCurr] = useState<CurrencyCode>('IRR');
  const [newBankInitBal, setNewBankInitBal] = useState<number>(0);

  // New Account State
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccParent, setNewAccParent] = useState('11');
  const [newAccNature, setNewAccNature] = useState<Account['nature']>('debit');

  const selectedBank = useMemo(
    () => state.banks.find((b) => b.id === selectedBankId) || state.banks[0],
    [state.banks, selectedBankId]
  );

  const reconciliation = useMemo(() => {
    if (!selectedBank) return null;
    return reconcileBankTransactions(
      selectedBank.id,
      selectedBank.initialBalanceForeign,
      selectedBank.initialBalanceIRR,
      state.vouchers,
      state.bankStatementEntries
    );
  }, [selectedBank, state.vouchers, state.bankStatementEntries]);

  const trialBalanceRows = useMemo(
    () => buildTrialBalance(state.accounts, state.vouchers),
    [state.accounts, state.vouchers]
  );

  const handleAddStatementRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank || !stDesc.trim()) return;
    const currObj = state.currencies.find((c) => c.code === selectedBank.currency);
    const rate = currObj ? currObj.defaultRateToIRR : 1;

    const entry: BankStatementEntry = {
      id: `bst-${Date.now()}`,
      bankId: selectedBank.id,
      date: stDate,
      trackingNumber: stTracking.trim() || `TRK-${Date.now().toString().slice(-4)}`,
      description: stDesc.trim(),
      currency: selectedBank.currency,
      depositForeign: stDeposit,
      withdrawalForeign: stWithdrawal,
      depositIRR: convertForeignToIRR(stDeposit, rate, selectedBank.currency),
      withdrawalIRR: convertForeignToIRR(stWithdrawal, rate, selectedBank.currency),
    };
    onAddBankStatementEntry(entry);
    setStTracking('');
    setStDesc('');
    setStDeposit(0);
    setStWithdrawal(0);
    setFeedback('ردیف صورتحساب بانکی ثبت و با دفاتر مغایرت‌گیری شد.');
  };

  const handleCreateBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim()) return;
    const currObj = state.currencies.find((c) => c.code === newBankCurr);
    const rate = currObj ? currObj.defaultRateToIRR : 1;
    const bank: BankAccount = {
      id: `bnk-${Date.now()}`,
      code: `B-${101 + state.banks.length}`,
      bankName: newBankName.trim(),
      branchName: newBranch.trim() || 'شعبه مرکزی',
      accountNumber: newAccNum.trim() || '00000000',
      shebaOrIban: newSheba.trim() || 'IR000000000000000000000000',
      currency: newBankCurr,
      moeinCode: newBankCurr === 'IRR' ? '1102' : '1103',
      initialBalanceForeign: newBankInitBal,
      initialBalanceIRR: convertForeignToIRR(newBankInitBal, rate, newBankCurr),
    };
    onAddBank(bank);
    setNewBankName('');
    setNewBranch('');
    setNewAccNum('');
    setNewSheba('');
    setNewBankInitBal(0);
    setFeedback(`حساب بانکی «${bank.bankName}» با ارز ${bank.currency} تعریف شد.`);
  };

  const handleCreateMoeinAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) return;
    const parentKol = state.accounts.find((a) => a.code === newAccParent);
    const created: Account = {
      code: newAccCode.trim(),
      name: newAccName.trim(),
      level: 'moein',
      parentCode: newAccParent,
      nature: newAccNature,
      category: parentKol?.category || 'asset',
    };
    onAddAccount(created);
    setNewAccCode('');
    setNewAccName('');
    setFeedback(`سرفصل حساب معین «${created.code} - ${created.name}» به کدینگ استاندارد اضافه شد.`);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            خزانه‌داری، تعریف بانک، مغایرت‌گیری بانکی و سرفصل‌های استاندارد حسابداری
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            مغایرت‌گیری هوشمند صورتحساب بانک با دفاتر، مدیریت کدینگ سرفصل‌های استاندارد، تراز آزمایشی ۴ ستونی و نرخ ارزها.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('reconciliation')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'reconciliation'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            گزارش مغایرت‌گیری بانکی
          </button>
          <button
            type="button"
            onClick={() => setSubTab('banks')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'banks'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تعریف بانک‌ها و خزانه ارزی/ریالی
          </button>
          <button
            type="button"
            onClick={() => setSubTab('chart_of_accounts')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'chart_of_accounts'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سرفصل‌های استاندارد حسابداری
          </button>
          <button
            type="button"
            onClick={() => setSubTab('trial_balance')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'trial_balance'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تراز آزمایشی ۴ ستونی استاندارد
          </button>
          <button
            type="button"
            onClick={() => setSubTab('currencies')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'currencies'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مدیریت ارزها و نرخ تبدیل
          </button>
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

      {/* 1. Bank Reconciliation Tab */}
      {subTab === 'reconciliation' && selectedBank && reconciliation && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="w-full md:w-96">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  انتخاب حساب بانکی جهت مغایرت‌گیری
                </label>
                <select
                  value={selectedBank.id}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  aria-label="انتخاب حساب بانکی جهت مغایرت‌گیری"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded"
                >
                  {state.banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — ({b.currency}) — شماره حساب: {b.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const report = buildStandardLedgerReport({
                      vouchers: state.vouchers,
                      accounts: state.accounts,
                      filterType: 'bank',
                      targetId: selectedBank.id,
                      targetLabel: `گردش استاندارد بانک / خزانه: ${selectedBank.bankName} (${selectedBank.currency})`,
                      currencyMode: selectedBank.currency === 'IRR' ? 'rial' : 'foreign',
                      currencyFilter: 'ALL',
                    });
                    exportOrPrintStandardLedgerPDF(
                      report,
                      state.companyName,
                      state.fiscalYear,
                      'download_pdf_html'
                    );
                    setFeedback(
                      `فایل PDF گزارش استاندارد کاردکس «${selectedBank.bankName}» (با ستون بدهکار، بستانکار و مانده از بالا به پایین) آماده شد.`
                    );
                  }}
                  className="px-3 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  خروجی PDF کاردکس بانک
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const report = buildStandardLedgerReport({
                      vouchers: state.vouchers,
                      accounts: state.accounts,
                      filterType: 'bank',
                      targetId: selectedBank.id,
                      targetLabel: `گردش استاندارد بانک / خزانه: ${selectedBank.bankName} (${selectedBank.currency})`,
                      currencyMode: selectedBank.currency === 'IRR' ? 'rial' : 'foreign',
                      currencyFilter: 'ALL',
                    });
                    exportOrPrintStandardLedgerPDF(
                      report,
                      state.companyName,
                      state.fiscalYear,
                      'print'
                    );
                  }}
                  className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  چاپ کاردکس بانک
                </button>
                {reconciliation.isReconciled ? (
                  <div className="px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    تراز منطبق (اختلاف: ۰)
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    اختلاف باز: {formatCurrencyAmount(reconciliation.discrepancyForeign, selectedBank.currency)}{' '}
                    {selectedBank.currency}
                  </div>
                )}
              </div>
            </div>

            {/* Reconciliation Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <div className="text-[11px] text-slate-500">مانده طبق دفاتر شرکت</div>
                <div className="text-sm font-bold font-mono-num text-slate-900 mt-0.5">
                  {formatCurrencyAmount(
                    reconciliation.ledgerBalanceForeign,
                    selectedBank.currency
                  )}{' '}
                  {selectedBank.currency}
                </div>
                <div className="text-xs font-mono-num text-slate-500 mt-1">
                  معادل ریالی: {formatNumber(reconciliation.ledgerBalanceIRR)} ریال
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">مانده طبق صورتحساب بانک</div>
                <div className="text-sm font-bold font-mono-num text-slate-900 mt-0.5">
                  {formatCurrencyAmount(
                    reconciliation.statementBalanceForeign,
                    selectedBank.currency
                  )}{' '}
                  {selectedBank.currency}
                </div>
                <div className="text-xs font-mono-num text-slate-500 mt-1">
                  معادل ریالی: {formatNumber(reconciliation.statementBalanceIRR)} ریال
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">
                  اقلام باز (چک‌های معوق و کارمزدهای ثبت‌نشده)
                </div>
                <div className="text-xs font-bold text-amber-800 mt-1">
                  در دفاتر ولی فاقد صورتحساب بانک: {reconciliation.unmatchedLedgerLines.length} مورد
                </div>
                <div className="text-xs font-bold text-blue-800 mt-0.5">
                  در صورتحساب بانک ولی ثبت‌نشده در دفاتر:{' '}
                  {reconciliation.unmatchedStatementEntries.length} مورد
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">مانده واقعی تعدیل‌شده نهایی</div>
                <div className="text-base font-extrabold font-mono-num text-emerald-800 mt-0.5">
                  {formatCurrencyAmount(
                    reconciliation.adjustedLedgerBalanceForeign,
                    selectedBank.currency
                  )}{' '}
                  {selectedBank.currency}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  تعداد تراکنش‌های تطبیق‌یافته: {reconciliation.matchedPairsCount} فقره
                </div>
              </div>
            </div>

            {/* Two-column discrepancy breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Unmatched Ledger Items (e.g. Outstanding Checks) */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">
                  ۱. اقلام ثبت‌شده در دفاتر شرکت که هنوز در صورتحساب بانک نیامده (چک‌های معوق / سپرده در راه)
                </h4>
                {reconciliation.unmatchedLedgerLines.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    تمامی اقلام دفاتر با صورتحساب بانک تطبیق یافته‌اند.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reconciliation.unmatchedLedgerLines.map((l) => (
                      <div
                        key={l.id}
                        className="p-2.5 bg-amber-50/50 border border-amber-200 rounded text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            سند #{l.voucherNumber} ({l.voucherDate}) — {l.description}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono-num mt-0.5">
                            رهگیری: {l.trackingNumber || '—'}
                          </div>
                        </div>
                        <div className="font-mono-num font-bold text-left shrink-0">
                          {l.debitForeign > 0
                            ? `+${formatCurrencyAmount(l.debitForeign, l.currency)} ${l.currency} (واریز در راه)`
                            : `-${formatCurrencyAmount(l.creditForeign, l.currency)} ${l.currency} (چک معوق)`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unmatched Bank Statement Items (e.g. Unrecorded Bank Fees or Deposits) */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">
                  ۲. اقلام موجود در صورتحساب بانک که هنوز در دفاتر ثبت نشده (کارمزد بانکی / واریزی نامشخص)
                </h4>
                {reconciliation.unmatchedStatementEntries.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    هیچ قلم ثبت‌نشده‌ای در صورتحساب بانک وجود ندارد.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reconciliation.unmatchedStatementEntries.map((st) => (
                      <div
                        key={st.id}
                        className="p-2.5 bg-blue-50/50 border border-blue-200 rounded text-xs flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {st.date} — {st.description}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono-num mt-0.5">
                            شماره پیگیری بانک: {st.trackingNumber} | مبلغ:{' '}
                            {st.depositForeign > 0
                              ? `واریز ${formatCurrencyAmount(st.depositForeign, st.currency)} ${st.currency}`
                              : `برداشت ${formatCurrencyAmount(st.withdrawalForeign, st.currency)} ${st.currency}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onRecordBankDiscrepancyVoucher(st, selectedBank);
                            setFeedback(
                              `سند حسابداری تعدیل مغایرت بانکی برای «${st.description}» به صورت خودکار صادر و تطبیق داده شد.`
                            );
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-700 hover:bg-blue-800 text-white rounded whitespace-nowrap cursor-pointer"
                        >
                          صدور خودکار سند تعدیل مغایرت
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add New Bank Statement Row Form */}
            <form
              onSubmit={handleAddStatementRow}
              className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
            >
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  تاریخ تراکنش بانک
                </label>
                <input
                  type="text"
                  value={stDate}
                  onChange={(e) => setStDate(e.target.value)}
                  aria-label="تاریخ تراکنش بانک"
                  className="w-full px-2.5 py-1.5 text-xs font-mono-num border border-slate-300 rounded"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  شماره پیگیری / چک
                </label>
                <input
                  type="text"
                  value={stTracking}
                  onChange={(e) => setStTracking(e.target.value)}
                  placeholder="CHK-66401"
                  aria-label="شماره پیگیری بانک"
                  className="w-full px-2.5 py-1.5 text-xs font-mono-num border border-slate-300 rounded"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  شرح ردیف صورتحساب ارسالی بانک
                </label>
                <input
                  type="text"
                  value={stDesc}
                  onChange={(e) => setStDesc(e.target.value)}
                  placeholder="مثلاً: وصول چک یا کارمزد ساتنا..."
                  aria-label="شرح ردیف صورتحساب بانک"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  واریز ({selectedBank.currency})
                </label>
                <FormattedNumberInput
                  value={stDeposit}
                  allowDecimals={selectedBank.currency !== 'IRR'}
                  onChange={(val) => {
                    setStDeposit(val);
                    if (val > 0) setStWithdrawal(0);
                  }}
                  ariaLabel="مبلغ واریز صورتحساب بانک"
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  برداشت ({selectedBank.currency})
                </label>
                <FormattedNumberInput
                  value={stWithdrawal}
                  allowDecimals={selectedBank.currency !== 'IRR'}
                  onChange={(val) => {
                    setStWithdrawal(val);
                    if (val > 0) setStDeposit(0);
                  }}
                  ariaLabel="مبلغ برداشت صورتحساب بانک"
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded cursor-pointer"
                >
                  + ثبت در صورتحساب بانک
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Banks Definition Tab */}
      {subTab === 'banks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-700" />
              فهرست بانک‌های ریالی و حساب‌ها / صرافی‌های ارزی تعریف‌شده
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-2.5 px-3">کد</th>
                    <th className="py-2.5 px-3">نام بانک / حساب ارزی</th>
                    <th className="py-2.5 px-3">شعبه و شماره حساب</th>
                    <th className="py-2.5 px-3">ارز</th>
                    <th className="py-2.5 px-3 text-left">موجودی اولیه</th>
                    <th className="py-2.5 px-3 text-left">معادل ریالی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.banks.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-num font-semibold">{b.code}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{b.bankName}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {b.branchName} ({b.accountNumber})
                      </td>
                      <td className="py-2.5 px-3 font-mono-num font-bold text-blue-700">
                        {b.currency}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-left font-bold">
                        {formatCurrencyAmount(b.initialBalanceForeign, b.currency)} {b.currency}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-left text-slate-700">
                        {formatNumber(b.initialBalanceIRR)} ریال
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={handleCreateBank}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">
              + تعریف حساب بانکی جدید (ریالی یا ارزی)
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نام بانک یا صرافی *
                </label>
                <input
                  type="text"
                  required
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="مثلاً: بانک سامان (ریالی) یا حساب یورویی فرانکفورت"
                  aria-label="نام بانک جدید"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ارز حساب بانکی
                  </label>
                  <select
                    value={newBankCurr}
                    onChange={(e) => setNewBankCurr(e.target.value)}
                    aria-label="ارز حساب بانکی جدید"
                    className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded bg-white"
                  >
                    {state.currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    موجودی اول دوره ({newBankCurr})
                  </label>
                  <FormattedNumberInput
                    value={newBankInitBal}
                    allowDecimals={newBankCurr !== 'IRR'}
                    onChange={(val) => setNewBankInitBal(val)}
                    ariaLabel="موجودی اول دوره بانک"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    نام و کد شعبه
                  </label>
                  <input
                    type="text"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    placeholder="شعبه آفریقا"
                    aria-label="نام شعبه بانک"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    شماره حساب
                  </label>
                  <input
                    type="text"
                    value={newAccNum}
                    onChange={(e) => setNewAccNum(e.target.value)}
                    placeholder="819203948"
                    aria-label="شماره حساب بانکی"
                    className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شماره شبا (IBAN) / سوئیفت
                </label>
                <input
                  type="text"
                  value={newSheba}
                  onChange={(e) => setNewSheba(e.target.value)}
                  placeholder="IR..."
                  aria-label="شماره شبا"
                  className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded cursor-pointer"
              >
                ثبت حساب بانکی در خزانه‌داری
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Standard Chart of Accounts Tab */}
      {subTab === 'chart_of_accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              درختواره سرفصل‌های استاندارد حسابداری ایران (گروه، کل، معین)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-2 px-3">کد حساب</th>
                    <th className="py-2 px-3">عنوان سرفصل استاندارد حسابداری</th>
                    <th className="py-2 px-3">سطح حساب</th>
                    <th className="py-2 px-3">ماهیت حساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.accounts.map((acc) => (
                    <tr
                      key={acc.code}
                      className={
                        acc.level === 'group'
                          ? 'bg-slate-100/80 font-bold'
                          : acc.level === 'kol'
                          ? 'bg-slate-50/60 font-semibold'
                          : 'hover:bg-slate-50'
                      }
                    >
                      <td className="py-2 px-3 font-mono-num text-blue-800 font-bold">
                        {acc.code}
                      </td>
                      <td className="py-2 px-3 text-slate-900">{acc.name}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {acc.level === 'group'
                          ? 'گروه حساب'
                          : acc.level === 'kol'
                          ? 'حساب کل'
                          : 'حساب معین'}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {acc.nature === 'debit'
                          ? 'بدهکار'
                          : acc.nature === 'credit'
                          ? 'بستانکار'
                          : 'شناور (دوگانه)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={handleCreateMoeinAccount}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-4 h-fit"
          >
            <h3 className="text-base font-bold text-slate-900">
              + افزودن سرفصل معین جدید
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  حساب کل والد
                </label>
                <select
                  value={newAccParent}
                  onChange={(e) => setNewAccParent(e.target.value)}
                  aria-label="حساب کل والد"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
                >
                  {state.accounts
                    .filter((a) => a.level === 'kol')
                    .map((k) => (
                      <option key={k.code} value={k.code}>
                        {k.code} - {k.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  کد چهار رقمی معین *
                </label>
                <input
                  type="text"
                  required
                  value={newAccCode}
                  onChange={(e) => setNewAccCode(e.target.value)}
                  placeholder="مثلاً: 1108"
                  aria-label="کد چهار رقمی معین"
                  className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  عنوان سرفصل معین *
                </label>
                <input
                  type="text"
                  required
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="مثلاً: تنخواه گردان ارزی واردات"
                  aria-label="عنوان سرفصل معین"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ماهیت استاندارد حساب
                </label>
                <select
                  value={newAccNature}
                  onChange={(e) => setNewAccNature(e.target.value as Account['nature'])}
                  aria-label="ماهیت استاندارد حساب"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
                >
                  <option value="debit">بدهکار</option>
                  <option value="credit">بستانکار</option>
                  <option value="both">شناور</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded cursor-pointer"
              >
                ثبت سرفصل در کدینگ استاندارد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. 4-Column Trial Balance Tab */}
      {subTab === 'trial_balance' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-700" />
              تراز آزمایشی ۴ ستونی استاندارد حسابداری (بر پایه ریال ایران)
            </h3>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                  <th className="py-2.5 px-3">کد معین</th>
                  <th className="py-2.5 px-3">نام حساب معین</th>
                  <th className="py-2.5 px-3 text-left">گردش بدهکار (ریال)</th>
                  <th className="py-2.5 px-3 text-left">گردش بستانکار (ریال)</th>
                  <th className="py-2.5 px-3 text-left bg-blue-50">مانده بدهکار (ریال)</th>
                  <th className="py-2.5 px-3 text-left bg-emerald-50">مانده بستانکار (ریال)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {trialBalanceRows.map((row) => (
                  <tr key={row.accountCode} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-num font-bold text-blue-700">
                      {row.accountCode}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {row.accountName}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left">
                      {formatNumber(row.turnoverDebitIRR)}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left">
                      {formatNumber(row.turnoverCreditIRR)}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left font-bold bg-blue-50/40 text-blue-950">
                      {formatNumber(row.balanceDebitIRR)}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left font-bold bg-emerald-50/40 text-emerald-950">
                      {formatNumber(row.balanceCreditIRR)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                  <td colSpan={2} className="py-3 px-3 text-left">
                    جمع کل تراز آزمایشی استاندارد:
                  </td>
                  <td className="py-3 px-3 font-mono-num text-left">
                    {formatNumber(
                      trialBalanceRows.reduce((s, r) => s + r.turnoverDebitIRR, 0)
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono-num text-left">
                    {formatNumber(
                      trialBalanceRows.reduce((s, r) => s + r.turnoverCreditIRR, 0)
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono-num text-left text-blue-900">
                    {formatNumber(
                      trialBalanceRows.reduce((s, r) => s + r.balanceDebitIRR, 0)
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono-num text-left text-emerald-900">
                    {formatNumber(
                      trialBalanceRows.reduce((s, r) => s + r.balanceCreditIRR, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 5. Currencies & Live Exchange Rates Tab */}
      {subTab === 'currencies' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            جدول ارزهای سیستم و نرخ تبدیل پیش‌فرض به ریال ایران (IRR)
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                  <th className="py-2.5 px-3">کد استاندارد ارز</th>
                  <th className="py-2.5 px-3">عنوان ارز</th>
                  <th className="py-2.5 px-3">نماد</th>
                  <th className="py-2.5 px-3">نرخ تبدیل پیش‌فرض به ریال (قابل ویرایش لحظه‌ای)</th>
                  <th className="py-2.5 px-3">آخرین بروزرسانی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.currencies.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-num font-bold text-blue-800">
                      {c.code}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-3 font-mono-num">{c.symbol}</td>
                    <td className="py-2.5 px-3">
                      {c.isBase ? (
                        <span className="font-mono-num font-semibold text-slate-500">
                          1 ریال (ارز پایه ملی)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FormattedNumberInput
                            value={c.defaultRateToIRR}
                            allowDecimals={false}
                            onChange={(val) =>
                              onUpdateCurrencyRate(c.code, val || 1)
                            }
                            ariaLabel={`نرخ تبدیل ${c.code}`}
                            className="w-40 px-2.5 py-1.5 font-bold bg-amber-50 border border-amber-300 rounded"
                          />
                          <span className="text-slate-600">ریال</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-slate-500">
                      {c.updatedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
