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
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  FileText,
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
  const [activeTab, setActiveTab] = useState<'debtors_creditors' | 'statement' | 'new_contact'>(
    'debtors_creditors'
  );
  const [selectedContactId, setSelectedContactId] = useState<string>(
    state.contacts[0]?.id || ''
  );
  const [statementMode, setStatementMode] = useState<'rial' | 'foreign'>('rial');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEBTOR' | 'CREDITOR'>('ALL');
  const [botToast, setBotToast] = useState<string | null>(null);

  // New Contact Form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Contact['type']>('both');
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
      targetLabel: `صورتحساب شخص: ${selectedContact.name}`,
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
        ? `پنجره چاپ مستقیم A4 برای صورتحساب «${selectedContact.name}» باز شد.`
        : `فایل PDF صورتحساب «${selectedContact.name}» با موفقیت ساخته شد.`
    );
  };

  const allContactsWithStatement = useMemo(() => {
    return state.contacts.map((contact) => {
      const st = buildPersonStatement(state.vouchers, contact.id, 'ALL');
      return {
        contact,
        statement: st,
      };
    });
  }, [state.contacts, state.vouchers]);

  // محاسبه جمع کل بدهکاران (طلب ما) و جمع کل بستانکاران (بدهی ما)
  const overallTotals = useMemo(() => {
    let totalReceivablesIRR = 0; // طلب ما از بدهکاران
    let totalPayablesIRR = 0; // بدهی ما به بستانکاران
    let debtorsCount = 0;
    let creditorsCount = 0;

    allContactsWithStatement.forEach(({ statement: st }) => {
      if (st.finalStatusIRR === 'بدهکار' && st.finalBalanceIRR > 0) {
        totalReceivablesIRR += st.finalBalanceIRR;
        debtorsCount++;
      } else if (st.finalStatusIRR === 'بستانکار' && st.finalBalanceIRR > 0) {
        totalPayablesIRR += st.finalBalanceIRR;
        creditorsCount++;
      }
    });

    const netMarketPositionIRR = totalReceivablesIRR - totalPayablesIRR;

    return {
      totalReceivablesIRR,
      totalPayablesIRR,
      debtorsCount,
      creditorsCount,
      netMarketPositionIRR,
    };
  }, [allContactsWithStatement]);

  const debtorsAndCreditors = useMemo(() => {
    return allContactsWithStatement.filter((item) => {
      const matchesSearch =
        item.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.contact.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.contact.phone || '').includes(searchQuery);

      if (!matchesSearch) return false;
      if (statusFilter === 'DEBTOR') return item.statement.finalStatusIRR === 'بدهکار';
      if (statusFilter === 'CREDITOR') return item.statement.finalStatusIRR === 'بستانکار';
      return true;
    });
  }, [allContactsWithStatement, searchQuery, statusFilter]);

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
      `صورتحساب «${selectedContact.name}» از طریق ${
        platform === 'bale' ? 'بله (Bale)' : 'تلگرام (Telegram)'
      } ارسال گردید.`
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
    setBotToast(`مشتری جدید «${created.name}» با موفقیت ثبت شد.`);
    setActiveTab('statement');
  };

  const getPlainStatusLabel = (status: string) => {
    if (status === 'بدهکار') return 'بدهکار به ما (طلب ما)';
    if (status === 'بستانکار') return 'طلبکار از ما (بدهی ما)';
    return 'تسویه کامل (بی‌حساب)';
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      {/* نوار بالای صفحه و سوئیچر تب‌ها */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight">
              مانده بدهکاران و بستانکاران + صورتحساب تکی هر شخص
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              به زبان ساده ببینید چه کسی به شما بدهکار است (طلب شما) و شما به چه کسی بدهکارید، یا ریز حساب هر مشتری را چک کنید.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('debtors_creditors')}
            className={`py-2.5 px-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg transition cursor-pointer text-center truncate ${
              activeTab === 'debtors_creditors'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            ۱. کل بدهکاران و بستانکاران
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`py-2.5 px-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg transition cursor-pointer text-center truncate ${
              activeTab === 'statement'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            ۲. صورتحساب تکی هر شخص
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new_contact')}
            className={`py-2.5 px-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg transition cursor-pointer text-center truncate ${
              activeTab === 'new_contact'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            + تعریف مشتری جدید
          </button>
        </div>
      </div>

      {botToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{botToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setBotToast(null)}
            className="text-xs font-extrabold text-emerald-800 underline cursor-pointer shrink-0"
          >
            بستن
          </button>
        </div>
      )}

      {/* تب اول: گزارش کلی مانده بدهکاران و بستانکاران */}
      {activeTab === 'debtors_creditors' && (
        <div className="space-y-4">
          {/* ۳ کارت خلاصه کل طلب‌ها و بدهی‌ها در یک نگاه */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-emerald-900">
                  🟢 کل طلب ما از مشتریان (بدهکاران به ما)
                </span>
                <div className="p-1.5 bg-emerald-100 rounded-lg">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-emerald-700 font-mono-num">
                {formatNumber(overallTotals.totalReceivablesIRR)} ریال
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                مجموع پولی که <strong>{formatNumber(overallTotals.debtorsCount)} نفر</strong> باید به شما بدهند
              </p>
            </div>

            <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-rose-900">
                  🔴 کل بدهی ما به اشخاص (طلبکاران از ما)
                </span>
                <div className="p-1.5 bg-rose-100 rounded-lg">
                  <ArrowUpRight className="w-4 h-4 text-rose-700" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-rose-700 font-mono-num">
                {formatNumber(overallTotals.totalPayablesIRR)} ریال
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                مجموع پولی که شما باید به <strong>{formatNumber(overallTotals.creditorsCount)} نفر</strong> بپردازید
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-slate-800">
                  ⚖️ تراز خالص کل بازار (طلب منهای بدهی)
                </span>
                <div className="p-1.5 bg-teal-50 rounded-lg">
                  <Scale className="w-4 h-4 text-teal-700" />
                </div>
              </div>
              <div
                className={`text-lg sm:text-xl font-extrabold font-mono-num ${
                  overallTotals.netMarketPositionIRR >= 0 ? 'text-teal-800' : 'text-rose-700'
                }`}
              >
                {formatNumber(Math.abs(overallTotals.netMarketPositionIRR))} ریال
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {overallTotals.netMarketPositionIRR > 0
                  ? 'در مجموع بازار، شما از مردم طلبکار هستید'
                  : overallTotals.netMarketPositionIRR < 0
                  ? 'در مجموع بازار، شما به مردم بدهکار هستید'
                  : 'جمع کل طلب و بدهی برابر است'}
              </p>
            </div>
          </div>

          {/* جدول و کارت‌های لیست بدهکاران و بستانکاران */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 space-y-4 shadow-xs max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-teal-600 shrink-0" />
                  لیست کامل مشتریان و وضعیت حساب هر نفر ({formatNumber(debtorsAndCreditors.length)} نفر)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  روی هر شخص کلیک کنید تا ریز کامل خرید و فروش ارز و دریافت و پرداخت‌های او باز شود.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی نام مشتری..."
                    className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-none font-semibold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ لیست</span>
                </button>
              </div>
            </div>

            {/* فیلتر سریع وضعیت حساب */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                همه اشخاص ({state.contacts.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DEBTOR')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  statusFilter === 'DEBTOR'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                🟢 فقط بدهکاران به ما / طلب ما ({overallTotals.debtorsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CREDITOR')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  statusFilter === 'CREDITOR'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                🔴 فقط طلبکاران از ما / بدهی ما ({overallTotals.creditorsCount})
              </button>
            </div>

            {/* Mobile Cards View for Phone Screens */}
            <div className="sm:hidden space-y-3">
              {debtorsAndCreditors.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  هیچ طرف حسابی مطابق جستجو یافت نشد.
                </div>
              ) : (
                debtorsAndCreditors.map(({ contact, statement: st }) => (
                  <div
                    key={contact.id}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      setActiveTab('statement');
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs cursor-pointer active:bg-slate-100 transition shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <span className="font-extrabold text-slate-900 text-sm block">
                          {contact.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {contact.phone || contact.code}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                          st.finalStatusIRR === 'بدهکار'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : st.finalStatusIRR === 'بستانکار'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {getPlainStatusLabel(st.finalStatusIRR)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-mono-num">
                      <span className="text-slate-600 text-[11px] font-bold">مانده قطعی ریالی:</span>
                      <span className="font-extrabold text-sm text-slate-900">
                        {formatNumber(st.finalBalanceIRR)} ریال
                      </span>
                    </div>

                    {Object.entries(st.currencyBreakdown).length > 0 && (
                      <div className="pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11px] text-slate-500">مانده ارزی:</span>
                        <div className="flex flex-wrap gap-1 font-mono-num">
                          {Object.entries(st.currencyBreakdown).map(([curr, b]) =>
                            b.balanceForeign > 0 ? (
                              <span
                                key={curr}
                                className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-800"
                              >
                                {formatCurrencyAmount(b.balanceForeign, curr)} {curr} ({b.status})
                              </span>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-1 text-left">
                      <span className="text-[11px] font-extrabold text-teal-700 flex items-center justify-end gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        مشاهده ریز صورتحساب این شخص ←
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-700">
                    <th className="py-3 px-3">کد</th>
                    <th className="py-3 px-3">نام مشتری / طرف حساب</th>
                    <th className="py-3 px-3">تلفن</th>
                    <th className="py-3 px-3 text-left">کل بدهکار (ریال)</th>
                    <th className="py-3 px-3 text-left">کل بستانکار (ریال)</th>
                    <th className="py-3 px-3 text-left">مانده قطعی (ریال)</th>
                    <th className="py-3 px-3 text-left">مانده ارزی (دلار/یورو/...)</th>
                    <th className="py-3 px-3 text-center">وضعیت به زبان ساده</th>
                    <th className="py-3 px-3 text-center">صورتحساب تکی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {debtorsAndCreditors.map(({ contact, statement: st }) => (
                    <tr key={contact.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-500">
                        {contact.code}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">{contact.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {contact.phone || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-left">
                        {formatNumber(st.totalDebitIRR)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-left">
                        {formatNumber(st.totalCreditIRR)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-left font-extrabold text-slate-900">
                        {formatNumber(st.finalBalanceIRR)} ریال
                      </td>
                      <td className="py-2.5 px-3 font-mono text-left">
                        {Object.entries(st.currencyBreakdown).map(([curr, b]) =>
                          b.balanceForeign > 0 ? (
                            <div key={curr} className="font-bold">
                              {formatCurrencyAmount(b.balanceForeign, curr)} {curr} ({b.status})
                            </div>
                          ) : null
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] border inline-block ${
                            st.finalStatusIRR === 'بدهکار'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : st.finalStatusIRR === 'بستانکار'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {getPlainStatusLabel(st.finalStatusIRR)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setActiveTab('statement');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-xs font-extrabold text-teal-800 cursor-pointer"
                        >
                          مشاهده صورتحساب تکی
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* تب دوم: صورتحساب تکی هر شخص */}
      {activeTab === 'statement' && (
        <div className="space-y-4">
          {state.contacts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <User className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-800 text-sm">هیچ طرف حسابی تعریف نشده است</h3>
              <p className="text-xs text-slate-500">برای مشاهده کاردکس مالی، ابتدا یک طرف حساب اضافه نمایید.</p>
              <button
                type="button"
                onClick={() => setActiveTab('new_contact')}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition cursor-pointer"
              >
                + افزودن طرف حساب جدید
              </button>
            </div>
          ) : selectedContact && statement ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 space-y-4 shadow-xs max-w-full overflow-hidden">
              {/* Controls Row */}
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      انتخاب شخص برای مشاهده صورتحساب تکی:
                    </label>
                    <select
                      value={selectedContact.id}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm font-extrabold bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-teal-500 focus:outline-none"
                    >
                      {state.contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code}) — ارز پیش‌فرض: {c.defaultCurrency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      نوع نمایش صورتحساب:
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setStatementMode('rial')}
                        className={`py-2 px-2 text-xs font-extrabold rounded-lg transition cursor-pointer text-center ${
                          statementMode === 'rial'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ۱. صورتحساب به ریال
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatementMode('foreign')}
                        className={`py-2 px-2 text-xs font-extrabold rounded-lg transition cursor-pointer text-center ${
                          statementMode === 'foreign'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ۲. صورتحساب به ارز (دلار/یورو)
                      </button>
                    </div>
                  </div>
                </div>

                {/* دکمه‌های چاپ و ارسال صورتحساب */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExportOrPrint('download_pdf')}
                    className="py-2 px-3 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileDown className="w-4 h-4" />
                    دانلود PDF صورتحساب
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportOrPrint('print')}
                    className="py-2 px-3 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    چاپ صورتحساب A4
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendStatementToBot('bale')}
                    className="py-2 px-3 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    ارسال به بله مشتری
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendStatementToBot('telegram')}
                    className="py-2 px-3 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    ارسال تلگرام مشتری
                  </button>
                </div>
              </div>

              {/* ۴ کارت خلاصه وضعیت این شخص */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">نام مشتری / شخص</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1 truncate">
                    {selectedContact.name}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 font-mono">
                    کد: {selectedContact.code} · تلفن: {selectedContact.phone}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">جمع کل بدهکار (گرفته از ما)</div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono-num text-amber-800 mt-1">
                    {formatNumber(statement.totalDebitIRR)} ریال
                  </div>
                  <div className="text-[11px] font-mono-num text-slate-600 mt-1">
                    ارزی:{' '}
                    {formatCurrencyAmount(
                      statement.totalDebitForeign,
                      currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter
                    )}{' '}
                    {currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">جمع کل بستانکار (داده به ما)</div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono-num text-emerald-800 mt-1">
                    {formatNumber(statement.totalCreditIRR)} ریال
                  </div>
                  <div className="text-[11px] font-mono-num text-slate-600 mt-1">
                    ارزی:{' '}
                    {formatCurrencyAmount(
                      statement.totalCreditForeign,
                      currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter
                    )}{' '}
                    {currencyFilter === 'ALL' ? selectedContact.defaultCurrency : currencyFilter}
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-2xl border-2 ${
                    statement.finalStatusIRR === 'بدهکار'
                      ? 'bg-emerald-50 border-emerald-300'
                      : statement.finalStatusIRR === 'بستانکار'
                      ? 'bg-rose-50 border-rose-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-700 font-extrabold">
                    وضعیت نهایی حساب {selectedContact.name}:
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono-num text-slate-950 mt-1">
                    {formatNumber(statement.finalBalanceIRR)} ریال
                  </div>
                  <div
                    className={`text-[11px] font-extrabold mt-1 ${
                      statement.finalStatusIRR === 'بدهکار'
                        ? 'text-emerald-800'
                        : statement.finalStatusIRR === 'بستانکار'
                        ? 'text-rose-800'
                        : 'text-slate-600'
                    }`}
                  >
                    {getPlainStatusLabel(statement.finalStatusIRR)}
                  </div>
                </div>
              </div>

              {/* Currency Filter in Foreign Mode */}
              {statementMode === 'foreign' && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs">
                  <span className="font-bold text-slate-800">فیلتر ارز:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(['ALL', 'USD', 'EUR', 'AED', 'CNY', 'IRR'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrencyFilter(c)}
                        className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs cursor-pointer ${
                          currencyFilter === c
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {c === 'ALL' ? 'همه ارزها' : c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pocket Mobile Cards View for Phones */}
              <div className="sm:hidden space-y-3">
                {statement.rows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
                    هیچ گردش مالی برای این طرف حساب ثبت نشده است.
                  </div>
                ) : (
                  statement.rows.map((row, idx) => (
                    <div
                      key={row.lineId}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400">#{idx + 1}</span>
                          <span className="font-mono font-bold text-blue-700">
                            سند #{row.voucherNumber}
                          </span>
                        </div>
                        <span className="font-mono text-slate-500 text-[11px]">{row.date}</span>
                      </div>

                      <div className="text-slate-900 font-bold text-xs leading-relaxed">
                        {row.description}
                      </div>

                      {statementMode === 'rial' ? (
                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 font-mono-num text-[11px]">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">بدهکار (ریال)</span>
                            <span className="font-extrabold text-amber-800">
                              {row.debitIRR > 0 ? formatNumber(row.debitIRR) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">بستانکار (ریال)</span>
                            <span className="font-extrabold text-emerald-800">
                              {row.creditIRR > 0 ? formatNumber(row.creditIRR) : '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 font-mono-num text-[11px]">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">بدهکار ارزی</span>
                            <span className="font-extrabold text-amber-800">
                              {row.debitForeign > 0
                                ? `${formatCurrencyAmount(row.debitForeign, row.currency)} ${row.currency}`
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">بستانکار ارزی</span>
                            <span className="font-extrabold text-emerald-800">
                              {row.creditForeign > 0
                                ? `${formatCurrencyAmount(row.creditForeign, row.currency)} ${row.currency}`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 font-mono-num">
                        <span className="text-slate-500 text-[11px]">مانده تا این لحظه:</span>
                        <span className="font-extrabold text-teal-900">
                          {statementMode === 'rial'
                            ? `${formatNumber(row.runningBalanceIRR)} ریال (${getPlainStatusLabel(
                                row.balanceStatusIRR
                              )})`
                            : `${formatCurrencyAmount(row.runningBalanceForeign, row.currency)} ${
                                row.currency
                              } (${row.balanceStatusForeign})`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop / Tablet Table View */}
              <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    {statementMode === 'rial' ? (
                      <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-800">
                        <th className="py-3 px-3">ردیف</th>
                        <th className="py-3 px-3">تاریخ</th>
                        <th className="py-3 px-3">سند</th>
                        <th className="py-3 px-3">شرح معامله / دریافت و پرداخت</th>
                        <th className="py-3 px-3">ارز و نرخ</th>
                        <th className="py-3 px-3 text-left">بدهکار (ریال)</th>
                        <th className="py-3 px-3 text-left">بستانکار (ریال)</th>
                        <th className="py-3 px-3 text-center">وضعیت</th>
                        <th className="py-3 px-3 text-left bg-teal-50 text-teal-950">
                          مانده لحظه‌ای (ریال)
                        </th>
                      </tr>
                    ) : (
                      <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-800">
                        <th className="py-3 px-3">ردیف</th>
                        <th className="py-3 px-3">تاریخ</th>
                        <th className="py-3 px-3">سند</th>
                        <th className="py-3 px-3">شرح عملیات ارزی</th>
                        <th className="py-3 px-3">ارز</th>
                        <th className="py-3 px-3 text-left">نرخ تبدیل (ریال)</th>
                        <th className="py-3 px-3 text-left bg-emerald-50/70">بدهکار ارزی</th>
                        <th className="py-3 px-3 text-left bg-emerald-50/70">بستانکار ارزی</th>
                        <th className="py-3 px-3 text-center">تشخیص ارزی</th>
                        <th className="py-3 px-3 text-left bg-teal-50 text-teal-950">
                          مانده در گردش ارزی
                        </th>
                        <th className="py-3 px-3 text-left text-slate-600">
                          معادل مانده به ریال
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {statement.rows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500">
                          هیچ گردش مالی برای این طرف حساب یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      statement.rows.map((row, idx) =>
                        statementMode === 'rial' ? (
                          <tr key={row.lineId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono">{row.date}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                              #{row.voucherNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-900 font-semibold">{row.description}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {row.currency === 'IRR'
                                ? 'ریال'
                                : `${row.currency} (نرخ: ${formatNumber(row.exchangeRate)})`}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left font-bold text-amber-800">
                              {formatNumber(row.debitIRR)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left font-bold text-emerald-800">
                              {formatNumber(row.creditIRR)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              <span
                                className={
                                  row.balanceStatusIRR === 'بدهکار'
                                    ? 'text-emerald-700'
                                    : row.balanceStatusIRR === 'بستانکار'
                                    ? 'text-rose-700'
                                    : 'text-slate-500'
                                }
                              >
                                {getPlainStatusLabel(row.balanceStatusIRR)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left font-bold bg-teal-50/60 text-slate-900">
                              {formatNumber(row.runningBalanceIRR)}
                            </td>
                          </tr>
                        ) : (
                          <tr key={row.lineId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono">{row.date}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                              #{row.voucherNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-900 font-semibold">{row.description}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-800">
                              {row.currency}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left text-slate-600">
                              {formatNumber(row.exchangeRate)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left font-bold bg-emerald-50/30 text-amber-800">
                              {formatCurrencyAmount(row.debitForeign, row.currency)} {row.currency}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left font-bold bg-emerald-50/30 text-emerald-800">
                              {formatCurrencyAmount(row.creditForeign, row.currency)} {row.currency}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {row.balanceStatusForeign}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left font-bold bg-teal-50/60 text-teal-950">
                              {formatCurrencyAmount(row.runningBalanceForeign, row.currency)} {row.currency}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-left text-slate-600">
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
          ) : null}
        </div>
      )}

      {/* CREATE NEW CONTACT TAB */}
      {activeTab === 'new_contact' && (
        <form
          onSubmit={handleCreateContact}
          className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 max-w-full sm:max-w-2xl mx-auto space-y-4 shadow-xs"
        >
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-600 shrink-0" />
              تعریف مشتری یا طرف حساب جدید
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              پس از تعریف مشتری، می‌توانید برای او خرید و فروش ارز یا دریافت و پرداخت ثبت کنید.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-extrabold text-slate-700 mb-1">
                نام و نام خانوادگی / نام صرافی یا شرکت *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثلاً: علی رضایی یا صرافی النور دبی"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-white font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-extrabold text-slate-700 mb-1">
                نوع طرف حساب:
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as Contact['type'])}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="both">مشتری و همکار (خرید و فروش دوطرفه)</option>
                <option value="customer">مشتری</option>
                <option value="supplier">فروشنده ارز / تامین‌کننده</option>
                <option value="partner">شریک / صراف همکار</option>
              </select>
            </div>

            <div>
              <label className="block font-extrabold text-slate-700 mb-1">
                ارز اصلی مورد معامله با این شخص:
              </label>
              <select
                value={newDefaultCurr}
                onChange={(e) => setNewDefaultCurr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-white font-mono font-bold focus:ring-2 focus:ring-teal-500 outline-none"
              >
                {state.currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-extrabold text-slate-700 mb-1">
                شماره تلفن همراه:
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="مثال: 09121112233"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl font-mono font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-extrabold text-slate-700 mb-1">
                شناسه چت بله (اختیاری - برای ارسال صورتحساب):
              </label>
              <input
                type="text"
                value={newBaleId}
                onChange={(e) => setNewBaleId(e.target.value)}
                placeholder="491029384"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-extrabold text-slate-700 mb-1">
                شناسه چت تلگرام (اختیاری - برای ارسال صورتحساب):
              </label>
              <input
                type="text"
                value={newTelegramId}
                onChange={(e) => setNewTelegramId(e.target.value)}
                placeholder="982103455"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md shadow-teal-600/20 transition cursor-pointer"
            >
              ذخیره مشتری جدید
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
