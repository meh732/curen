import React, { useMemo, useState } from 'react';
import {
  AccountingState,
  BotDeliveryLog,
  Contact,
  CurrencyCode,
} from '../types/accounting';
import {
  buildPersonStatement,
  buildStandardLedgerReport,
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import {
  dispatchToMessengerBot,
  formatStatementBotMessage,
} from '../utils/botAndBackupService';
import { exportOrPrintStandardLedgerPDF } from '../utils/pdfPrintReportService';
import {
  Send,
  Printer,
  FileDown,
  CheckCircle2,
  UserPlus,
  Search,
  ArrowUpDown,
} from 'lucide-react';

interface PersonStatementsViewProps {
  state: AccountingState;
  onAddContact: (contact: Contact) => void;
  onRecordBotLog: (log: BotDeliveryLog) => void;
}

export const PersonStatementsView: React.FC<PersonStatementsViewProps> = ({
  state,
  onAddContact,
  onRecordBotLog,
}) => {
  const [activeTab, setActiveTab] = useState<'statement' | 'debtors_creditors' | 'new_contact'>('statement');
  const [selectedContactId, setSelectedContactId] = useState<string>(
    state.contacts[0]?.id || ''
  );
  // Two explicit modes requested by user: 1) صورتحساب استاندارد ریالی, 2) صورتحساب استاندارد ارزی
  const [statementMode, setStatementMode] = useState<'rial' | 'foreign'>('rial');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [botToast, setBotToast] = useState<string | null>(null);

  // New Contact Form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Contact['type']>('customer');
  const [newPhone, setNewPhone] = useState('');
  const [newDefaultCurr, setNewDefaultCurr] = useState<CurrencyCode>('USD');
  const [newBaleId, setNewBaleId] = useState('');
  const [newTelegramId, setNewTelegramId] = useState('');

  const selectedContact = useMemo(
    () => state.contacts.find((c) => c.id === selectedContactId) || state.contacts[0],
    [state.contacts, selectedContactId]
  );

  const statement = useMemo(() => {
    if (!selectedContact) return null;
    return buildPersonStatement(state.vouchers, selectedContact.id, currencyFilter);
  }, [state.vouchers, selectedContact, currencyFilter]);

  const handleExportOrPrint = (action: 'print' | 'download_pdf') => {
    if (!selectedContact) return;
    const ledgerReport = buildStandardLedgerReport({
      vouchers: state.vouchers,
      accounts: state.accounts,
      filterType: 'contact',
      targetId: selectedContact.id,
      targetLabel: `صورتحساب استاندارد شخص: ${selectedContact.name}`,
      currencyMode: statementMode,
      currencyFilter,
    });
    exportOrPrintStandardLedgerPDF(
      ledgerReport,
      state.companyName,
      state.fiscalYear,
      action === 'print' ? 'print' : 'download_pdf_html'
    );
    setBotToast(
      action === 'print'
        ? `پنجره چاپ مستقیم A4 برای صورتحساب استاندارد «${selectedContact.name}» باز شد.`
        : `فایل خروجی PDF استاندارد صورتحساب «${selectedContact.name}» با ستون بدهکار، بستانکار و مانده از بالا به پایین آماده شد.`
    );
  };

  // Comprehensive Debtors & Creditors Report (گزارش بدهکاران و بستانکاران ریالی و ارزی)
  const debtorsAndCreditors = useMemo(() => {
    return state.contacts
      .map((contact) => {
        const st = buildPersonStatement(state.vouchers, contact.id, 'ALL');
        return {
          contact,
          statement: st,
        };
      })
      .filter((item) =>
        item.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.contact.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [state.contacts, state.vouchers, searchQuery]);

  const handleSendStatementToBot = async (platform: 'bale' | 'telegram') => {
    if (!selectedContact || !statement) return;
    const text = formatStatementBotMessage(
      selectedContact,
      statement,
      statementMode,
      state.companyName
    );
    const chatId =
      platform === 'bale'
        ? selectedContact.baleChatId || state.botConfig.baleDefaultChatId
        : selectedContact.telegramChatId || state.botConfig.telegramDefaultChatId;
    const botToken =
      platform === 'bale'
        ? state.botConfig.baleBotToken
        : state.botConfig.telegramBotToken;

    const log = await dispatchToMessengerBot({
      platform,
      botToken,
      chatId,
      recipientName: selectedContact.name,
      messageType: statementMode === 'rial' ? 'statement_rial' : 'statement_foreign',
      text,
      summary: `ارسال صورتحساب ${
        statementMode === 'rial' ? 'ریالی' : 'ارزی'
      } برای «${selectedContact.name}» با مانده ریالی ${formatNumber(
        statement.finalBalanceIRR
      )} ریال (${statement.finalStatusIRR})`,
    });

    onRecordBotLog(log);
    setBotToast(
      `صورتحساب ${
        statementMode === 'rial' ? 'استاندارد ریالی' : 'استاندارد ارزی'
      } برای «${selectedContact.name}» از طریق ربات ${
        platform === 'bale' ? 'بله (Bale)' : 'تلگرام (Telegram)'
      } (شناسه چت: ${chatId}) با موفقیت ارسال و در لاگ ثبت شد.`
    );
  };

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${1001 + state.contacts.length}`,
      name: newName.trim(),
      type: newType,
      phone: newPhone.trim() || '021-00000000',
      defaultCurrency: newDefaultCurr,
      baleChatId: newBaleId.trim() || state.botConfig.baleDefaultChatId,
      telegramChatId: newTelegramId.trim() || state.botConfig.telegramDefaultChatId,
    };
    onAddContact(created);
    setSelectedContactId(created.id);
    setNewName('');
    setNewPhone('');
    setActiveTab('statement');
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            صورتحساب استاندارد اشخاص (ریالی و ارزی) و گزارش جامع بدهکاران و بستانکاران
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            مشاهده کاردکس استاندارد حسابداری هر شخص به ۲ حالت مجزا: «صورتحساب ریالی» و «صورتحساب ارزی» به همراه ارسال مستقیم به بله و تلگرام مشتری.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'statement'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            کاردکس صورتحساب شخص (ریالی / ارزی)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('debtors_creditors')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'debtors_creditors'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            گزارش جامع بدهکاران و بستانکاران
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new_contact')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'new_contact'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + تعریف طرف حساب جدید
          </button>
        </div>
      </div>

      {botToast && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{botToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setBotToast(null)}
            className="text-xs underline"
          >
            بستن
          </button>
        </div>
      )}

      {activeTab === 'statement' && selectedContact && statement && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          {/* Controls Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end border-b border-slate-200 pb-4">
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                انتخاب شخص / شرکت طرف حساب
              </label>
              <select
                value={selectedContact.id}
                onChange={(e) => setSelectedContactId(e.target.value)}
                aria-label="انتخاب شخص طرف حساب"
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
              >
                {state.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} (ارز پیش‌فرض: {c.defaultCurrency})
                  </option>
                ))}
              </select>
            </div>

            {/* Dual Statement Mode Selector */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نوع نمایش صورتحساب استاندارد شخص (دو حالته)
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatementMode('rial')}
                  className={`py-1.5 px-3 text-xs font-bold rounded transition-colors whitespace-nowrap ${
                    statementMode === 'rial'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  ۱. صورتحساب استاندارد ریالی
                </button>
                <button
                  type="button"
                  onClick={() => setStatementMode('foreign')}
                  className={`py-1.5 px-3 text-xs font-bold rounded transition-colors whitespace-nowrap ${
                    statementMode === 'foreign'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  ۲. صورتحساب استاندارد ارزی
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleExportOrPrint('download_pdf')}
                className="px-3 py-2 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                خروجی PDF استاندارد
              </button>
              <button
                type="button"
                onClick={() => handleExportOrPrint('print')}
                className="px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                چاپ رسمی A4
              </button>
              <button
                type="button"
                onClick={() => handleSendStatementToBot('bale')}
                className="px-2.5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                بله
              </button>
              <button
                type="button"
                onClick={() => handleSendStatementToBot('telegram')}
                className="px-2.5 py-2 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                تلگرام
              </button>
            </div>
          </div>

          {/* Contact Info & Summary KPI Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <div className="text-[11px] text-slate-500">مشخصات طرف حساب</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedContact.name}</div>
              <div className="text-xs text-slate-600 mt-1 font-mono-num">
                کد تفصیلی: {selectedContact.code} · تلفن: {selectedContact.phone}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500">جمع کل بدهکار (ریالی و ارزی)</div>
              <div className="text-sm font-bold font-mono-num text-slate-900 mt-0.5">
                {formatNumber(statement.totalDebitIRR)} ریال
              </div>
              <div className="text-xs font-mono-num text-slate-600 mt-1">
                گردش ارزی:{' '}
                {formatCurrencyAmount(
                  statement.totalDebitForeign,
                  currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter
                )}{' '}
                {currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500">جمع کل بستانکار (ریالی و ارزی)</div>
              <div className="text-sm font-bold font-mono-num text-slate-900 mt-0.5">
                {formatNumber(statement.totalCreditIRR)} ریال
              </div>
              <div className="text-xs font-mono-num text-slate-600 mt-1">
                گردش ارزی:{' '}
                {formatCurrencyAmount(
                  statement.totalCreditForeign,
                  currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter
                )}{' '}
                {currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500">
                مانده نهایی ({statementMode === 'rial' ? 'صورتحساب ریالی' : 'صورتحساب ارزی'})
              </div>
              {statementMode === 'rial' ? (
                <div className="text-base font-extrabold font-mono-num text-blue-900 mt-0.5">
                  {formatNumber(statement.finalBalanceIRR)} ریال ({statement.finalStatusIRR})
                </div>
              ) : (
                <div className="space-y-1 mt-0.5">
                  {Object.entries(statement.currencyBreakdown).length > 0 ? (
                    Object.entries(statement.currencyBreakdown).map(([curr, b]) => (
                      <div key={curr} className="text-xs font-bold font-mono-num text-blue-900">
                        {formatCurrencyAmount(b.balanceForeign, curr)} {curr} ({b.status})
                      </div>
                    ))
                  ) : (
                    <div className="text-xs font-bold text-slate-500">۰ (تسویه)</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Currency filter when in Foreign Statement mode */}
          {statementMode === 'foreign' && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/60 border border-blue-200 rounded-lg px-4 py-2.5 text-xs">
              <span className="font-semibold text-blue-950">
                فیلتر ارز در صورتحساب ارزی استاندارد:
              </span>
              <div className="flex items-center gap-1">
                {(['ALL', 'USD', 'AED', 'CNY', 'EUR', 'IRR'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrencyFilter(c)}
                    className={`px-2.5 py-1 rounded font-mono-num font-semibold ${
                      currencyFilter === c
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {c === 'ALL' ? 'همه ارزها' : c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Standard Accounting Ledger Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-right border-collapse">
              <thead>
                {statementMode === 'rial' ? (
                  <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800">
                    <th className="py-2.5 px-3">ردیف</th>
                    <th className="py-2.5 px-3">تاریخ</th>
                    <th className="py-2.5 px-3">شماره سند</th>
                    <th className="py-2.5 px-3">کد و نام حساب معین</th>
                    <th className="py-2.5 px-3">شرح عملیات حسابداری</th>
                    <th className="py-2.5 px-3">ارز منشأ و نرخ</th>
                    <th className="py-2.5 px-3 text-left">بدهکار (ریال)</th>
                    <th className="py-2.5 px-3 text-left">بستانکار (ریال)</th>
                    <th className="py-2.5 px-3 text-center">تشخیص</th>
                    <th className="py-2.5 px-3 text-left bg-blue-50 text-blue-950">
                      مانده در گردش (ریال)
                    </th>
                  </tr>
                ) : (
                  <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800">
                    <th className="py-2.5 px-3">ردیف</th>
                    <th className="py-2.5 px-3">تاریخ</th>
                    <th className="py-2.5 px-3">شماره سند</th>
                    <th className="py-2.5 px-3">شرح عملیات ارزی</th>
                    <th className="py-2.5 px-3">ارز</th>
                    <th className="py-2.5 px-3 text-left">نرخ تبدیل (ریال)</th>
                    <th className="py-2.5 px-3 text-left bg-emerald-50/70">بدهکار ارزی</th>
                    <th className="py-2.5 px-3 text-left bg-emerald-50/70">بستانکار ارزی</th>
                    <th className="py-2.5 px-3 text-center">تشخیص ارزی</th>
                    <th className="py-2.5 px-3 text-left bg-emerald-100/60 text-emerald-950">
                      مانده در گردش ارزی
                    </th>
                    <th className="py-2.5 px-3 text-left text-slate-600">
                      معادل مانده به ریال
                    </th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {statement.rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      هیچ گردش مالی برای این طرف حساب در فیلتر انتخابی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  statement.rows.map((row, idx) =>
                    statementMode === 'rial' ? (
                      <tr key={row.lineId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono-num text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono-num">{row.date}</td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-blue-700">
                          #{row.voucherNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {row.accountCode} - {row.accountName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">{row.description}</td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-500">
                          {row.currency === 'IRR'
                            ? 'IRR (ریالی)'
                            : `${row.currency} (نرخ: ${formatNumber(row.exchangeRate)})`}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left font-semibold">
                          {formatNumber(row.debitIRR)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left font-semibold">
                          {formatNumber(row.creditIRR)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          <span
                            className={
                              row.balanceStatusIRR === 'بدهکار'
                                ? 'text-amber-700'
                                : row.balanceStatusIRR === 'بستانکار'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }
                          >
                            {row.balanceStatusIRR}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left font-bold bg-blue-50/40 text-slate-900">
                          {formatNumber(row.runningBalanceIRR)}
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.lineId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono-num text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono-num">{row.date}</td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-blue-700">
                          #{row.voucherNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">{row.description}</td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-blue-800">
                          {row.currency}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left text-slate-600">
                          {formatNumber(row.exchangeRate)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left font-semibold bg-emerald-50/30">
                          {formatCurrencyAmount(row.debitForeign, row.currency)} {row.currency}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left font-semibold bg-emerald-50/30">
                          {formatCurrencyAmount(row.creditForeign, row.currency)} {row.currency}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {row.balanceStatusForeign}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left font-bold bg-emerald-100/40 text-emerald-950">
                          {formatCurrencyAmount(row.runningBalanceForeign, row.currency)} {row.currency}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left text-slate-600">
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
      )}

      {/* Debtors & Creditors Report Tab */}
      {activeTab === 'debtors_creditors' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-blue-700" />
                گزارش استاندارد بدهکاران و بستانکاران (اشخاص حقیقی و حقوقی - ریالی و ارزی)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                کلیک روی هر شخص، کاردکس صورتحساب استاندارد ریالی و ارزی او را باز می‌کند.
              </p>
            </div>
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام یا کد طرف حساب..."
                aria-label="جستجوی بدهکاران و بستانکاران"
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <th className="py-2.5 px-3">کد تفصیلی</th>
                  <th className="py-2.5 px-3">نام شخص / شرکت</th>
                  <th className="py-2.5 px-3">ارز پایه</th>
                  <th className="py-2.5 px-3 text-left">جمع بدهکار (ریال)</th>
                  <th className="py-2.5 px-3 text-left">جمع بستانکار (ریال)</th>
                  <th className="py-2.5 px-3 text-left">مانده قطعی (ریال)</th>
                  <th className="py-2.5 px-3 text-left">مانده‌های ارزی به تفکیک</th>
                  <th className="py-2.5 px-3 text-center">وضعیت حساب</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {debtorsAndCreditors.map(({ contact, statement: st }) => (
                  <tr key={contact.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-600">
                      {contact.code}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{contact.name}</td>
                    <td className="py-2.5 px-3 font-mono-num text-blue-700 font-semibold">
                      {contact.defaultCurrency}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left">
                      {formatNumber(st.totalDebitIRR)}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left">
                      {formatNumber(st.totalCreditIRR)}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left font-bold text-slate-900">
                      {formatNumber(st.finalBalanceIRR)} ریال
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-left">
                      {Object.entries(st.currencyBreakdown).map(([curr, b]) => (
                        <div key={curr}>
                          {formatCurrencyAmount(b.balanceForeign, curr)} {curr} ({b.status})
                        </div>
                      ))}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span
                        className={
                          st.finalStatusIRR === 'بدهکار'
                            ? 'text-amber-700'
                            : st.finalStatusIRR === 'بستانکار'
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }
                      >
                        {st.finalStatusIRR}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedContactId(contact.id);
                          setActiveTab('statement');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        مشاهده صورتحساب ریالی/ارزی
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create New Contact Tab */}
      {activeTab === 'new_contact' && (
        <form
          onSubmit={handleCreateContact}
          className="bg-white border border-slate-200 rounded-lg p-5 max-w-3xl space-y-4"
        >
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-700" />
            تعریف طرف حساب جدید (مشتری / تأمین‌کننده ارزی و ریالی)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نام کامل شخص یا شرکت *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثلاً: بازرگانی اطلس تجارت شانگهای"
                aria-label="نام کامل شخص یا شرکت"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نوع طرف حساب
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as Contact['type'])}
                aria-label="نوع طرف حساب"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
              >
                <option value="customer">مشتری (خریدار)</option>
                <option value="supplier">تأمین‌کننده (فروشنده)</option>
                <option value="both">مشتری و تأمین‌کننده (هر دو)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ارز پیش‌فرض صورتحساب
              </label>
              <select
                value={newDefaultCurr}
                onChange={(e) => setNewDefaultCurr(e.target.value)}
                aria-label="ارز پیش‌فرض صورتحساب"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white font-mono-num"
              >
                {state.currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                شماره تماس
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="021-88001122"
                aria-label="شماره تماس"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                شناسه چت بله (Bale Chat ID جهت ارسال خودکار فاکتور)
              </label>
              <input
                type="text"
                value={newBaleId}
                onChange={(e) => setNewBaleId(e.target.value)}
                placeholder="مثلاً: 491029384"
                aria-label="شناسه چت بله"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                شناسه چت تلگرام (Telegram Chat ID جهت ارسال صورتحساب)
              </label>
              <input
                type="text"
                value={newTelegramId}
                onChange={(e) => setNewTelegramId(e.target.value)}
                placeholder="مثلاً: 982103455"
                aria-label="شناسه چت تلگرام"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono-num"
              />
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded"
            >
              ذخیره طرف حساب و ایجاد کاردکس دوارزی
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
