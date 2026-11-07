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
import {
  exportOrPrintStandardLedgerPDF,
  exportOrPrintCurrencyDeliveryStatementPDF,
} from '../utils/pdfPrintReportService';
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
  Hash,
  PackageCheck,
  Landmark,
} from 'lucide-react';

interface PersonStatementsViewProps {
  state: AccountingState;
  onAddContact: (contact: Contact) => void;
  onRecordBotLog: (log: BotDeliveryLog) => void;
  initialContactId?: string | null;
}

interface GlobalReceiptMatch {
  id: string;
  trackingNumber: string;
  date: string;
  voucherOrDocNumber: string;
  contactId: string;
  contactName: string;
  contactCode: string;
  bankName: string;
  currency: CurrencyCode;
  exchangeRate: number;
  debitIRR: number;
  creditIRR: number;
  debitForeign: number;
  creditForeign: number;
  description: string;
  sourceLabel: string;
}

export const PersonStatementsView: React.FC<PersonStatementsViewProps> = ({
  state,
  onAddContact,
  onRecordBotLog,
  initialContactId,
}) => {
  const [activeTab, setActiveTab] = useState<
    'debtors_creditors' | 'statement' | 'tracking_search' | 'new_contact'
  >(initialContactId ? 'statement' : 'debtors_creditors');
  const [selectedContactId, setSelectedContactId] = useState<string>(
    initialContactId || state.contacts[0]?.id || ''
  );
  const [statementMode, setStatementMode] = useState<'rial' | 'foreign' | 'delivery'>('rial');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalTrackingQuery, setGlobalTrackingQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEBTOR' | 'CREDITOR'>('ALL');
  const [botToast, setBotToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialContactId) {
      setSelectedContactId(initialContactId);
      setActiveTab('statement');
    } else if (
      state.contacts.length > 0 &&
      (!selectedContactId || !state.contacts.some((c) => c.id === selectedContactId))
    ) {
      setSelectedContactId(state.contacts[0].id);
    }
  }, [initialContactId, state.contacts, selectedContactId]);

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

  // معاملات ارزی همین مشتری جهت صورتحساب تحویل مرحله‌ای ارز
  const selectedContactFXDeals = useMemo(() => {
    if (!selectedContact) return [];
    return state.fxDeals.filter((d) => d.contactId === selectedContact.id);
  }, [state.fxDeals, selectedContact]);

  // غنی‌سازی ردیف‌های صورتحساب با شماره فیش/رهگیری و توضیحات ثبت‌شده در اسناد و معاملات ارزی
  const enrichedStatementRows = useMemo(() => {
    if (!statement) return [];
    const voucherMap = new Map(state.vouchers.map((v) => [v.id, v]));
    const dealByVoucherId = new Map(
      state.fxDeals.filter((d) => d.linkedVoucherId).map((d) => [d.linkedVoucherId!, d])
    );
    const dealByNumber = new Map(state.fxDeals.map((d) => [d.dealNumber, d]));

    return statement.rows.map((row) => {
      const v = voucherMap.get(row.voucherId);
      let linkedDeal = dealByVoucherId.get(row.voucherId);
      if (!linkedDeal && v?.referenceNumber) {
        linkedDeal = dealByNumber.get(v.referenceNumber);
      }
      if (!linkedDeal) {
        for (const [dNum, dObj] of dealByNumber.entries()) {
          if (row.description.includes(dNum) || (v?.description || '').includes(dNum)) {
            linkedDeal = dObj;
            break;
          }
        }
      }

      const siblingBankLine = v?.lines.find(
        (ln) => ln.id !== row.lineId && (ln.bankId || ln.bankName || ln.trackingNumber)
      );

      const resolvedTracking = (
        row.trackingNumber ||
        siblingBankLine?.trackingNumber ||
        linkedDeal?.trackingNumber ||
        linkedDeal?.payments?.[0]?.trackingNumber ||
        v?.referenceNumber ||
        linkedDeal?.dealNumber ||
        `سند-#${row.voucherNumber}`
      ).trim();

      const descParts: string[] = [row.description.trim()];
      if (
        v?.description &&
        !row.description.includes(v.description.trim()) &&
        !v.description.startsWith('سند اتوماتیک')
      ) {
        descParts.push(`توضیحات سند: ${v.description.trim()}`);
      }
      if (
        siblingBankLine?.description &&
        !row.description.includes(siblingBankLine.description.trim()) &&
        siblingBankLine.description.includes('توضیحات')
      ) {
        descParts.push(siblingBankLine.description.trim());
      }
      if (linkedDeal?.notes && !row.description.includes(linkedDeal.notes.trim())) {
        descParts.push(`توضیحات ثبت‌شده: ${linkedDeal.notes.trim()}`);
      }

      return {
        ...row,
        trackingNumber: resolvedTracking,
        description: descParts.join(' — '),
        bankName: siblingBankLine?.bankName || '',
      };
    });
  }, [statement, state.vouchers, state.fxDeals]);

  // ساخت بانک جامع فیش‌ها و شماره‌های پیگیری کل مشتریان برای جستجوی سراسری آنی
  const allCustomerReceiptRecords = useMemo<GlobalReceiptMatch[]>(() => {
    const contactMap = new Map<string, Contact>(
      state.contacts.map((c) => [c.id, c])
    );
    const dealByVoucherId = new Map(
      state.fxDeals.filter((d) => d.linkedVoucherId).map((d) => [d.linkedVoucherId!, d])
    );
    const dealByNumber = new Map(state.fxDeals.map((d) => [d.dealNumber, d]));
    const list: GlobalReceiptMatch[] = [];

    // ۱. تمامی آرتیکل‌های سندهای حسابداری (دریافت، پرداخت، خرید/فروش ارز، فاکتور، و حتی اسناد بانکی)
    state.vouchers.forEach((v) => {
      const linkedDeal =
        dealByVoucherId.get(v.id) ||
        (v.referenceNumber ? dealByNumber.get(v.referenceNumber) : undefined);
      const bankLineInVoucher = v.lines.find((l) => l.bankName || l.bankId);
      const personLines = v.lines.filter((l) => l.contactId || l.contactName);

      if (personLines.length > 0) {
        personLines.forEach((ln) => {
          const cObj = ln.contactId ? contactMap.get(ln.contactId) : undefined;
          const matchingBankLine =
            v.lines.find(
              (bLn) =>
                bLn.bankName &&
                bLn.trackingNumber &&
                bLn.trackingNumber === ln.trackingNumber
            ) || bankLineInVoucher;

          const trk = (
            ln.trackingNumber ||
            matchingBankLine?.trackingNumber ||
            linkedDeal?.trackingNumber ||
            v.referenceNumber ||
            `سند-${v.voucherNumber}`
          ).trim();

          const fullDescParts = [ln.description || v.description];
          if (v.description && ln.description && !ln.description.includes(v.description)) {
            fullDescParts.push(`شرح سند: ${v.description}`);
          }
          if (linkedDeal?.notes && !fullDescParts.join(' ').includes(linkedDeal.notes)) {
            fullDescParts.push(`توضیحات: ${linkedDeal.notes}`);
          }

          list.push({
            id: `vln-${v.id}-${ln.id}`,
            trackingNumber: trk,
            date: v.date,
            voucherOrDocNumber: `سند #${v.voucherNumber}`,
            contactId: ln.contactId || '',
            contactName: cObj?.name || ln.contactName || linkedDeal?.contactName || 'شخص',
            contactCode: cObj?.code || '—',
            bankName: ln.bankName || matchingBankLine?.bankName || 'حساب دفتری / عمومی',
            currency: ln.currency,
            exchangeRate: ln.exchangeRate,
            debitIRR: ln.debitIRR,
            creditIRR: ln.creditIRR,
            debitForeign: ln.currency !== 'IRR' ? ln.debitForeign : 0,
            creditForeign: ln.currency !== 'IRR' ? ln.creditForeign : 0,
            description: fullDescParts.join(' — '),
            sourceLabel:
              v.autoType === 'fx_deal'
                ? 'معامله خرید/فروش ارز'
                : v.autoType === 'invoice'
                ? 'فاکتور فروش/خرید'
                : v.autoType === 'receive_from_person'
                ? 'فیش دریافت از شخص'
                : v.autoType === 'pay_to_person'
                ? 'فیش پرداخت به شخص'
                : 'سند دریافت و پرداخت',
          });
        });
      } else {
        // اسناد بانکی بدون شخص (انتقال، هزینه، شارژ حساب)
        v.lines
          .filter((l) => l.bankId || l.bankName || l.trackingNumber)
          .forEach((bLn) => {
            list.push({
              id: `vbnk-${v.id}-${bLn.id}`,
              trackingNumber: (
                bLn.trackingNumber ||
                v.referenceNumber ||
                `سند-${v.voucherNumber}`
              ).trim(),
              date: v.date,
              voucherOrDocNumber: `سند #${v.voucherNumber}`,
              contactId: '',
              contactName:
                v.autoType === 'bank_transfer'
                  ? 'انتقال داخلی بانک/صندوق'
                  : v.autoType === 'expense'
                  ? 'ثبت هزینه'
                  : 'عملیات خزانه',
              contactCode: 'داخلی',
              bankName: bLn.bankName || 'بانک / صندوق',
              currency: bLn.currency,
              exchangeRate: bLn.exchangeRate,
              debitIRR: bLn.debitIRR,
              creditIRR: bLn.creditIRR,
              debitForeign: bLn.currency !== 'IRR' ? bLn.debitForeign : 0,
              creditForeign: bLn.currency !== 'IRR' ? bLn.creditForeign : 0,
              description:
                bLn.description && v.description && !bLn.description.includes(v.description)
                  ? `${bLn.description} — ${v.description}`
                  : bLn.description || v.description,
              sourceLabel: 'سند مالی خزانه / بانک',
            });
          });
      }
    });

    // ۲. مراحل تحویل مرحله‌ای ارز (FXDeliverySplit) که ممکن است شماره پیگیری تحویل مجزا داشته باشند
    state.fxDeals.forEach((d) => {
      const cObj = contactMap.get(d.contactId);
      (d.deliverySplits || []).forEach((sp, idx) => {
        const alreadyInList = list.some(
          (item) =>
            item.trackingNumber.toLowerCase() === (sp.trackingNumber || '').toLowerCase() &&
            item.contactId === d.contactId
        );
        if (!alreadyInList && sp.trackingNumber) {
          list.push({
            id: `dlv-${d.id}-${sp.id}`,
            trackingNumber: sp.trackingNumber,
            date: sp.date,
            voucherOrDocNumber: `${d.dealNumber} (تحویل #${idx + 1})`,
            contactId: d.contactId,
            contactName: cObj?.name || d.contactName,
            contactCode: cObj?.code || '—',
            bankName: sp.vaultBankName || 'خزانه ارزی',
            currency: d.currency,
            exchangeRate: d.exchangeRate,
            debitIRR: 0,
            creditIRR: 0,
            debitForeign: d.type === 'buy' ? sp.amountForeign : 0,
            creditForeign: d.type === 'sell' ? sp.amountForeign : 0,
            description:
              sp.notes ||
              `تحویل مرحله ${idx + 1} ارز بابت معامله ${d.dealNumber} (${formatNumber(
                sp.amountForeign
              )} ${d.currency})`,
            sourceLabel: 'رسید تحویل مرحله‌ای ارز',
          });
        }
      });
    });

    return list;
  }, [state.vouchers, state.contacts, state.fxDeals]);

  const matchedGlobalReceipts = useMemo(() => {
    const q = globalTrackingQuery.trim().toLowerCase();
    if (!q) return allCustomerReceiptRecords;
    return allCustomerReceiptRecords.filter(
      (item) =>
        item.trackingNumber.toLowerCase().includes(q) ||
        item.contactName.toLowerCase().includes(q) ||
        item.bankName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.voucherOrDocNumber.toLowerCase().includes(q) ||
        String(item.debitIRR).includes(q) ||
        String(item.creditIRR).includes(q) ||
        String(item.debitForeign).includes(q) ||
        String(item.creditForeign).includes(q)
    );
  }, [allCustomerReceiptRecords, globalTrackingQuery]);

  const handleExportOrPrint = (action: 'print' | 'download_pdf') => {
    if (!selectedContact) return;
    if (statementMode === 'delivery') {
      exportOrPrintCurrencyDeliveryStatementPDF({
        contactName: selectedContact.name,
        deals: selectedContactFXDeals,
        companyName: state.companyName,
        fiscalYear: state.fiscalYear,
        mode: action === 'print' ? 'print' : 'download_pdf_html',
      });
      setBotToast(
        `صورتحساب تحویل مرحله‌ای ارز برای «${selectedContact.name}» آماده چاپ/دانلود شد.`
      );
      return;
    }

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
    const modeForBot = statementMode === 'foreign' ? 'foreign' : 'rial';
    const text = formatStatementBotMessage(
      selectedContact,
      statement,
      modeForBot,
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
      messageType: modeForBot === 'rial' ? 'statement_rial' : 'statement_foreign',
      text,
      summary: `ارسال صورتحساب ${
        modeForBot === 'rial' ? 'ریالی' : 'ارزی'
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
    const nextContactCodeNum =
      Math.max(1000, ...state.contacts.map((c) => parseInt(c.code.replace(/\D/g, ''), 10) || 1000)) + 1;
    const created: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${nextContactCodeNum}`,
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
      {/* نوار بالای صفحه + باکس جستجوی فوری شماره پیگیری فیش بین کل مشتریان */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight">
              بدهکاران و بستانکاران + صورتحساب کامل اشخاص + جستجوی سراسری فیش‌ها
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              نمایش خط‌به‌خط توضیحات، شماره پیگیری فیش‌ها، صورتحساب تحویل مرحله‌ای ارز و جستجوی آنی فیش بین تمام مشتریان.
            </p>
          </div>

          {/* نوار سرچ سریع شماره پیگیری فیش از هر جای این صفحه */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-teal-600 absolute right-3 top-2.5" />
            <input
              type="text"
              value={globalTrackingQuery}
              onChange={(e) => {
                setGlobalTrackingQuery(e.target.value);
                if (activeTab !== 'tracking_search') {
                  setActiveTab('tracking_search');
                }
              }}
              placeholder="🔍 سرچ شماره پیگیری فیش بین کل مشتریان..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-teal-50/70 border-2 border-teal-400 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-none font-bold text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
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
            ۲. صورتحساب تکی و تحویل ارز
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracking_search')}
            className={`py-2.5 px-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg transition cursor-pointer text-center truncate ${
              activeTab === 'tracking_search'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            ۳. 🔍 سرچ سراسری فیش‌ها
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

      {/* ===================================================================== */}
      {/* تب سوم: جستجوی سراسری شماره پیگیری فیش بین تمام مشتریان */}
      {/* ===================================================================== */}
      {activeTab === 'tracking_search' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Hash className="w-5 h-5 text-teal-600 shrink-0" />
                جستجوی سراسری شماره پیگیری فیش و تراکنش‌ها در بین تمام مشتریان
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                شماره پیگیری فیش، شماره حواله، مبلغ یا قسمتی از توضیحات را وارد کنید تا درجا مشخص شود مربوط به کدام مشتری، کدام بانک و کدام صورتحساب بوده است.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-extrabold font-mono-num shrink-0">
              تعداد نتایج یافت‌شده: {formatNumber(matchedGlobalReceipts.length)} مورد
            </span>
          </div>

          <div className="relative">
            <Search className="w-5 h-5 text-teal-600 absolute right-3.5 top-3" />
            <input
              type="text"
              value={globalTrackingQuery}
              onChange={(e) => setGlobalTrackingQuery(e.target.value)}
              placeholder="شماره پیگیری فیش را اینجا تایپ کنید (مثال: PAY-101-A یا TRK-M-101 یا نام مشتری یا مبلغ)..."
              className="w-full pr-11 pl-4 py-3 text-xs sm:text-sm bg-slate-50 border-2 border-teal-500 rounded-2xl focus:bg-white focus:outline-none font-extrabold text-slate-900"
              autoFocus
            />
          </div>

          {matchedGlobalReceipts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              هیچ فیش یا تراکنشی با شماره پیگیری یا عبارت «{globalTrackingQuery}» یافت نشد.
            </div>
          ) : (
            <div className="space-y-3">
              {matchedGlobalReceipts.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 border border-slate-200 hover:border-teal-400 rounded-2xl p-3.5 sm:p-4 space-y-2.5 transition shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-mono-num text-xs font-extrabold flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" />
                        شماره پیگیری فیش: {item.trackingNumber}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-extrabold">
                        👤 صاحب فیش / مشتری: {item.contactName} ({item.contactCode})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold">
                        {item.sourceLabel} ({item.voucherOrDocNumber})
                      </span>
                      <span className="font-mono-num text-xs text-slate-600 font-bold">
                        📅 تاریخ: {item.date}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContactId(item.contactId);
                        setStatementMode('rial');
                        setActiveTab('statement');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-900 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 text-teal-700" />
                      مشاهده صورتحساب کامل {item.contactName} ←
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Landmark className="w-3.5 h-3.5 text-teal-600" />
                        بانک / صندوق:
                      </span>
                      <strong className="text-slate-900 font-bold">{item.bankName}</strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between font-mono-num">
                      <span className="text-slate-500 font-sans">مبلغ ریالی:</span>
                      <strong
                        className={`font-extrabold ${
                          item.debitIRR > 0 ? 'text-amber-800' : 'text-emerald-800'
                        }`}
                      >
                        {item.debitIRR > 0
                          ? `بدهکار: ${formatNumber(item.debitIRR)} ریال`
                          : item.creditIRR > 0
                          ? `بستانکار (واریزی/پرداختی): ${formatNumber(item.creditIRR)} ریال`
                          : '—'}
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between font-mono-num">
                      <span className="text-slate-500 font-sans">مقدار و نرخ ارز:</span>
                      <strong className="text-slate-900 font-extrabold">
                        {item.currency === 'IRR'
                          ? 'ریال ایران (IRR)'
                          : `${formatCurrencyAmount(
                              item.debitForeign || item.creditForeign,
                              item.currency
                            )} ${item.currency} (نرخ: ${formatNumber(item.exchangeRate)})`}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed">
                    <strong className="text-slate-950">📝 شرح و توضیحات کامل ثبت‌شده در صورتحساب: </strong>
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب اول: گزارش کلی مانده بدهکاران و بستانکاران */}
      {/* ===================================================================== */}
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
                  روی هر شخص کلیک کنید تا ریز کامل خرید و فروش ارز، شماره پیگیری فیش‌ها و صورتحساب تحویل ارز او باز شود.
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

      {/* ===================================================================== */}
      {/* تب دوم: صورتحساب تکی هر شخص (ریالی، ارزی، و تحویل مرحله‌ای ارز) */}
      {/* ===================================================================== */}
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
                      نوع صورتحساب این شخص:
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setStatementMode('rial')}
                        className={`py-2 px-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg transition cursor-pointer text-center ${
                          statementMode === 'rial'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ۱. صورتحساب ریالی
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatementMode('foreign')}
                        className={`py-2 px-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg transition cursor-pointer text-center ${
                          statementMode === 'foreign'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ۲. صورتحساب ارزی
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatementMode('delivery')}
                        className={`py-2 px-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg transition cursor-pointer text-center ${
                          statementMode === 'delivery'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ۳. 📦 تحویل ارز
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

              {/* ۴ کارت خلاصه وضعیت این شخص (همراه با مانده ریالی و مانده ارزی درشت و واضح) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">نام مشتری / شخص</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1 truncate">
                    {selectedContact.name}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 font-mono">
                    کد: {selectedContact.code} · تلفن: {selectedContact.phone}
                  </div>
                  <div className="text-[11px] text-teal-800 font-bold mt-1">
                    ارز اصلی: {selectedContact.defaultCurrency}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">جمع کل بدهکار (گرفته از ما)</div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono-num text-amber-800 mt-1">
                    {formatNumber(statement.totalDebitIRR)} ریال
                  </div>
                  <div className="text-[11px] font-mono-num text-amber-900 font-extrabold mt-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 inline-block">
                    بدهکار ارزی:{' '}
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
                  <div className="text-[11px] font-mono-num text-emerald-900 font-extrabold mt-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 inline-block">
                    بستانکار ارزی:{' '}
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
                    مانده ریالی: {formatNumber(statement.finalBalanceIRR)} ریال
                  </div>
                  <div
                    className={`text-[11px] font-extrabold mt-0.5 ${
                      statement.finalStatusIRR === 'بدهکار'
                        ? 'text-emerald-800'
                        : statement.finalStatusIRR === 'بستانکار'
                        ? 'text-rose-800'
                        : 'text-slate-600'
                    }`}
                  >
                    {getPlainStatusLabel(statement.finalStatusIRR)}
                  </div>
                  {/* نمایش مستقیم مانده ارزی نهایی داخل کارت چهارم */}
                  <div className="mt-2 pt-2 border-t border-slate-300/70 space-y-1">
                    <div className="text-[11px] font-extrabold text-teal-900">
                      💰 مانده نهایی ارزی این شخص:
                    </div>
                    {Object.entries(statement.currencyBreakdown).filter(([c]) => c !== 'IRR')
                      .length === 0 ? (
                      <div className="text-xs font-mono-num font-extrabold text-slate-700">
                        0.00 {selectedContact.defaultCurrency} (تسویه ارزی)
                      </div>
                    ) : (
                      Object.entries(statement.currencyBreakdown)
                        .filter(([c]) => c !== 'IRR')
                        .map(([curr, b]) => (
                          <div
                            key={curr}
                            className="px-2 py-1 rounded-lg bg-white border border-teal-300 font-mono-num text-xs font-extrabold text-teal-950 flex items-center justify-between gap-1"
                          >
                            <span>
                              {formatCurrencyAmount(b.balanceForeign, curr)} {curr}
                            </span>
                            <span
                              className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${
                                b.status === 'بدهکار'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : b.status === 'بستانکار'
                                  ? 'bg-rose-100 text-rose-900'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {b.status === 'بدهکار'
                                ? 'بدهکار ارزی به ما'
                                : b.status === 'بستانکار'
                                ? 'طلبکار ارزی از ما (بستانکار)'
                                : 'تسویه ارزی'}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* بنر اختصاصی مانده ارزی به تفکیک ارزها (برای دید آنی صراف در بالای جدول) */}
              <div className="bg-gradient-to-l from-teal-50 via-emerald-50/70 to-cyan-50 border-2 border-teal-300 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-teal-700 shrink-0" />
                  <div>
                    <span className="text-xs sm:text-sm font-extrabold text-teal-950 block">
                      تراز و مانده قطعی ارزی «{selectedContact.name}» به تفکیک هر ارز:
                    </span>
                    <span className="text-[11px] text-teal-800">
                      این کادر مانده دقیق دلاری/ارزی مشتری را مستقل از نوسان ریال نشان می‌دهد.
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono-num">
                  {Object.entries(statement.currencyBreakdown).filter(([c]) => c !== 'IRR')
                    .length === 0 ? (
                    <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-extrabold text-slate-700">
                      مانده ارزی: ۰ (بدون گردش ارزی)
                    </span>
                  ) : (
                    Object.entries(statement.currencyBreakdown)
                      .filter(([c]) => c !== 'IRR')
                      .map(([curr, b]) => (
                        <div
                          key={curr}
                          className={`px-3.5 py-2 rounded-xl border-2 text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-xs ${
                            b.status === 'بدهکار'
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                              : b.status === 'بستانکار'
                              ? 'bg-rose-100 border-rose-400 text-rose-950'
                              : 'bg-white border-slate-300 text-slate-800'
                          }`}
                        >
                          <span>
                            مانده {curr}: {formatCurrencyAmount(b.balanceForeign, curr)} {curr}
                          </span>
                          <span className="font-sans text-xs px-2 py-0.5 rounded-lg bg-white/90 border border-current">
                            {b.status === 'بدهکار'
                              ? '🟢 بدهکار ارزی به ما (طلب ما)'
                              : b.status === 'بستانکار'
                              ? '🔴 طلبکار ارزی از ما (بستانکار)'
                              : '⚪ تسویه کامل ارزی'}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* حالت ۳: صورتحساب اختصاصی تحویل مرحله‌ای ارز این مشتری */}
              {statementMode === 'delivery' ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2 font-extrabold text-amber-950">
                      <PackageCheck className="w-5 h-5 text-amber-700 shrink-0" />
                      <span>
                        صورتحساب تحویل مرحله‌ای ارز برای «{selectedContact.name}» (ارزهای تحویل شده و مانده تحویل‌نشده)
                      </span>
                    </div>
                    <span className="font-mono-num font-bold text-amber-900">
                      تعداد معاملات ارزی این مشتری: {formatNumber(selectedContactFXDeals.length)} معامله
                    </span>
                  </div>

                  {selectedContactFXDeals.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
                      هیچ معامله خرید یا فروش ارزی برای این مشتری ثبت نشده است.
                    </div>
                  ) : (
                    selectedContactFXDeals.map((d) => {
                      const delivered = d.deliveredForeignAmount ?? d.foreignAmount;
                      const rem =
                        d.remainingForeignDelivery ??
                        Math.max(0, Number((d.foreignAmount - delivered).toFixed(2)));
                      const splits = d.deliverySplits || [];

                      return (
                        <div
                          key={d.id}
                          className="border-2 border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/60"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono-num font-extrabold text-teal-800 bg-white px-2.5 py-0.5 rounded-lg border border-teal-200">
                                {d.dealNumber}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-extrabold ${
                                  d.type === 'buy'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {d.type === 'buy'
                                  ? 'خرید ارز از مشتری (دریافت ارز)'
                                  : 'فروش ارز به مشتری (تحویل ارز به مشتری)'}
                              </span>
                              <span className="font-mono-num text-slate-600">تاریخ: {d.date}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 font-mono-num text-xs">
                              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold">
                                کل معامله: {formatCurrencyAmount(d.foreignAmount, d.currency)} {d.currency}
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold">
                                تحویل‌شده: {formatCurrencyAmount(delivered, d.currency)} {d.currency}
                              </span>
                              <span
                                className={`px-2.5 py-1 rounded-lg font-extrabold ${
                                  rem > 0
                                    ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                    : 'bg-teal-100 text-teal-900'
                                }`}
                              >
                                مانده تحویل‌نشده: {formatCurrencyAmount(rem, d.currency)} {d.currency}
                              </span>
                            </div>
                          </div>

                          {d.notes && (
                            <div className="text-xs text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
                              <strong>📝 توضیحات معامله:</strong> {d.notes}
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="text-xs font-extrabold text-slate-700">
                              ریز مراحل تحویل ارز (خط به خط):
                            </div>
                            {splits.length === 0 ? (
                              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600">
                                تحویل یکجا در تاریخ {d.date} به مقدار{' '}
                                <strong>
                                  {formatCurrencyAmount(delivered, d.currency)} {d.currency}
                                </strong>{' '}
                                (شماره پیگیری: {d.trackingNumber})
                              </div>
                            ) : (
                              splits.map((sp, i) => (
                                <div
                                  key={sp.id}
                                  className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                >
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-extrabold text-slate-900">
                                        مرحله #{i + 1}
                                      </span>
                                      <span className="font-mono text-slate-600">📅 {sp.date}</span>
                                      <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800 font-mono font-extrabold">
                                        شماره پیگیری فیش: {sp.trackingNumber || '—'}
                                      </span>
                                      <span className="text-slate-600">
                                        ({sp.vaultBankName || 'خزانه ارزی'})
                                      </span>
                                    </div>
                                    <div className="text-slate-800 font-medium">
                                      📝 توضیحات مرحله: {sp.notes || '—'}
                                    </div>
                                  </div>
                                  <div className="font-mono-num font-extrabold text-sm text-emerald-700 shrink-0">
                                    {formatCurrencyAmount(sp.amountForeign, d.currency)} {d.currency}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <>
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

                  {/* Pocket Mobile Cards View for Phones (همراه با شماره پیگیری فیش، مانده ارزی و شرح کامل خط به خط) */}
                  <div className="sm:hidden space-y-3">
                    {enrichedStatementRows.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
                        هیچ گردش مالی برای این طرف حساب ثبت نشده است.
                      </div>
                    ) : (
                      enrichedStatementRows.map((row, idx) => (
                        <div
                          key={row.lineId}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs shadow-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-slate-400">#{idx + 1}</span>
                              <span className="font-mono font-bold text-blue-700">
                                سند #{row.voucherNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-teal-600 text-white font-mono font-extrabold text-[11px]">
                                فیش / رهگیری: {row.trackingNumber}
                              </span>
                            </div>
                            <span className="font-mono text-slate-500 text-[11px]">{row.date}</span>
                          </div>

                          <div className="text-slate-900 font-bold text-xs leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-teal-800 text-[11px] font-extrabold block mb-0.5">
                              📝 شرح معامله و توضیحات ثبت‌شده:
                            </span>
                            {row.description}
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 font-mono-num text-[11px]">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-sans">بدهکار (ریال / ارزی)</span>
                              <span className="font-extrabold text-amber-800 block">
                                {row.debitIRR > 0 ? `${formatNumber(row.debitIRR)} ریال` : '—'}
                              </span>
                              {row.currency !== 'IRR' && row.debitForeign > 0 && (
                                <span className="font-bold text-amber-700 text-[10px] block">
                                  ({formatCurrencyAmount(row.debitForeign, row.currency)} {row.currency})
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-sans">بستانکار (ریال / ارزی)</span>
                              <span className="font-extrabold text-emerald-800 block">
                                {row.creditIRR > 0 ? `${formatNumber(row.creditIRR)} ریال` : '—'}
                              </span>
                              {row.currency !== 'IRR' && row.creditForeign > 0 && (
                                <span className="font-bold text-emerald-700 text-[10px] block">
                                  ({formatCurrencyAmount(row.creditForeign, row.currency)} {row.currency})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1 pt-1 border-t border-slate-200/80 font-mono-num text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-sans">مانده ریالی تا این لحظه:</span>
                              <span className="font-extrabold text-slate-900">
                                {formatNumber(row.runningBalanceIRR)} ریال ({getPlainStatusLabel(row.balanceStatusIRR)})
                              </span>
                            </div>
                            {row.currency !== 'IRR' && (
                              <div className="flex items-center justify-between bg-teal-50 px-2 py-1 rounded-lg border border-teal-200">
                                <span className="text-teal-900 font-sans font-bold">مانده ارزی تا این لحظه:</span>
                                <span className="font-extrabold text-teal-950">
                                  {formatCurrencyAmount(row.runningBalanceForeign, row.currency)} {row.currency} ({row.balanceStatusForeign})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop / Tablet Table View (با ستون شماره فیش/رهگیری، توضیحات کامل، مانده ارزی و مانده ریالی) */}
                  <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        {statementMode === 'rial' ? (
                          <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-800">
                            <th className="py-3 px-2">ردیف</th>
                            <th className="py-3 px-2">تاریخ</th>
                            <th className="py-3 px-2">سند</th>
                            <th className="py-3 px-2.5 text-teal-900 bg-teal-50/70">
                              شماره فیش / رهگیری / رسید
                            </th>
                            <th className="py-3 px-3">
                              شرح کامل معامله / دریافت و پرداخت و توضیحات ثبت‌شده
                            </th>
                            <th className="py-3 px-2">ارز و نرخ</th>
                            <th className="py-3 px-2.5 text-left">بدهکار (ریال)</th>
                            <th className="py-3 px-2.5 text-left">بستانکار (ریال)</th>
                            <th className="py-3 px-2 text-center">وضعیت</th>
                            <th className="py-3 px-2.5 text-left bg-teal-50 text-teal-950">
                              مانده لحظه‌ای (ریال)
                            </th>
                            <th className="py-3 px-2.5 text-left bg-emerald-50 text-emerald-950 border-r border-emerald-200">
                              مانده لحظه‌ای ارزی
                            </th>
                          </tr>
                        ) : (
                          <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-800">
                            <th className="py-3 px-2">ردیف</th>
                            <th className="py-3 px-2">تاریخ</th>
                            <th className="py-3 px-2">سند</th>
                            <th className="py-3 px-2.5 text-teal-900 bg-teal-50/70">
                              شماره فیش / رهگیری / رسید
                            </th>
                            <th className="py-3 px-3">
                              شرح کامل عملیات ارزی و توضیحات ثبت‌شده خط‌به‌خط
                            </th>
                            <th className="py-3 px-2">ارز</th>
                            <th className="py-3 px-2 text-left">نرخ تبدیل (ریال)</th>
                            <th className="py-3 px-2.5 text-left bg-amber-50/60">بدهکار ارزی</th>
                            <th className="py-3 px-2.5 text-left bg-emerald-50/60">بستانکار ارزی</th>
                            <th className="py-3 px-2 text-center">تشخیص ارزی</th>
                            <th className="py-3 px-3 text-left bg-teal-100/80 text-teal-950">
                              مانده در گردش ارزی
                            </th>
                            <th className="py-3 px-2.5 text-left text-slate-700">
                              معادل مانده به ریال
                            </th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {enrichedStatementRows.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="py-8 text-center text-slate-500">
                              هیچ گردش مالی برای این طرف حساب یافت نشد.
                            </td>
                          </tr>
                        ) : (
                          enrichedStatementRows.map((row, idx) =>
                            statementMode === 'rial' ? (
                              <tr key={row.lineId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-2 font-mono text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-2 font-mono">{row.date}</td>
                                <td className="py-2.5 px-2 font-mono font-bold text-blue-700">
                                  #{row.voucherNumber}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono font-extrabold text-teal-900 bg-teal-50/30">
                                  <span className="px-2 py-0.5 rounded-lg bg-teal-100/80 border border-teal-300 inline-block">
                                    {row.trackingNumber}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-900 font-semibold leading-relaxed">
                                  {row.description}
                                </td>
                                <td className="py-2.5 px-2 font-mono text-slate-600">
                                  {row.currency === 'IRR'
                                    ? 'ریال'
                                    : `${row.currency} (نرخ: ${formatNumber(row.exchangeRate)})`}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono text-left font-bold text-amber-800">
                                  {formatNumber(row.debitIRR)}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono text-left font-bold text-emerald-800">
                                  {formatNumber(row.creditIRR)}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold">
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
                                <td className="py-2.5 px-2.5 font-mono text-left font-extrabold bg-teal-50/60 text-slate-900">
                                  {formatNumber(row.runningBalanceIRR)} ریال
                                </td>
                                <td className="py-2.5 px-2.5 font-mono text-left font-extrabold bg-emerald-50/50 text-teal-950 border-r border-emerald-100">
                                  {row.currency === 'IRR' ? (
                                    <span className="text-slate-400 font-sans text-[11px]">ریالی</span>
                                  ) : (
                                    <span>
                                      {formatCurrencyAmount(row.runningBalanceForeign, row.currency)}{' '}
                                      {row.currency}{' '}
                                      <span className="font-sans text-[10px] text-teal-800">
                                        ({row.balanceStatusForeign})
                                      </span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ) : (
                              <tr key={row.lineId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-2 font-mono text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-2 font-mono">{row.date}</td>
                                <td className="py-2.5 px-2 font-mono font-bold text-blue-700">
                                  #{row.voucherNumber}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono font-extrabold text-teal-900 bg-teal-50/30">
                                  <span className="px-2 py-0.5 rounded-lg bg-teal-100/80 border border-teal-300 inline-block">
                                    {row.trackingNumber}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-900 font-semibold leading-relaxed">
                                  {row.description}
                                </td>
                                <td className="py-2.5 px-2 font-mono font-bold text-blue-800">
                                  {row.currency}
                                </td>
                                <td className="py-2.5 px-2 font-mono text-left text-slate-600">
                                  {formatNumber(row.exchangeRate)}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono text-left font-bold bg-amber-50/30 text-amber-800">
                                  {formatCurrencyAmount(row.debitForeign, row.currency)} {row.currency}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono text-left font-bold bg-emerald-50/30 text-emerald-800">
                                  {formatCurrencyAmount(row.creditForeign, row.currency)} {row.currency}
                                </td>
                                <td className="py-2.5 px-2 text-center font-extrabold">
                                  <span
                                    className={
                                      row.balanceStatusForeign === 'بدهکار'
                                        ? 'text-emerald-800'
                                        : row.balanceStatusForeign === 'بستانکار'
                                        ? 'text-rose-800'
                                        : 'text-slate-600'
                                    }
                                  >
                                    {row.balanceStatusForeign}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-left font-extrabold bg-teal-100/60 text-teal-950">
                                  {formatCurrencyAmount(row.runningBalanceForeign, row.currency)} {row.currency}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono text-left font-bold text-slate-700">
                                  {formatNumber(row.runningBalanceIRR)} ریال
                                </td>
                              </tr>
                            )
                          )
                        )}
                      </tbody>
                      {enrichedStatementRows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-extrabold text-xs">
                            <td colSpan={6} className="py-3 px-3 text-left">
                              جمع کل گردش و مانده نهایی حساب «{selectedContact.name}»:
                            </td>
                            {statementMode === 'rial' ? (
                              <>
                                <td className="py-3 px-2.5 font-mono text-left text-amber-300">
                                  {formatNumber(statement.totalDebitIRR)}
                                </td>
                                <td className="py-3 px-2.5 font-mono text-left text-emerald-300">
                                  {formatNumber(statement.totalCreditIRR)}
                                </td>
                                <td className="py-3 px-2 text-center text-teal-200">
                                  {statement.finalStatusIRR}
                                </td>
                                <td className="py-3 px-2.5 font-mono text-left text-white bg-teal-900">
                                  {formatNumber(statement.finalBalanceIRR)} ریال
                                </td>
                                <td className="py-3 px-2.5 font-mono text-left text-emerald-300 bg-slate-800">
                                  {Object.entries(statement.currencyBreakdown)
                                    .filter(([c]) => c !== 'IRR')
                                    .map(
                                      ([c, b]) =>
                                        `${formatCurrencyAmount(b.balanceForeign, c)} ${c} (${b.status})`
                                    )
                                    .join(' | ') || '0.00'}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 px-2"></td>
                                <td className="py-3 px-2.5 font-mono text-left text-amber-300">
                                  {formatCurrencyAmount(
                                    statement.totalDebitForeign,
                                    currencyFilter === 'ALL'
                                      ? selectedContact.defaultCurrency
                                      : currencyFilter
                                  )}
                                </td>
                                <td className="py-3 px-2.5 font-mono text-left text-emerald-300">
                                  {formatCurrencyAmount(
                                    statement.totalCreditForeign,
                                    currencyFilter === 'ALL'
                                      ? selectedContact.defaultCurrency
                                      : currencyFilter
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center text-teal-200">
                                  {statement.finalStatusForeign}
                                </td>
                                <td className="py-3 px-3 font-mono text-left text-emerald-300 bg-teal-900">
                                  {formatCurrencyAmount(
                                    statement.finalBalanceForeign,
                                    currencyFilter === 'ALL'
                                      ? selectedContact.defaultCurrency
                                      : currencyFilter
                                  )}{' '}
                                  {currencyFilter === 'ALL'
                                    ? selectedContact.defaultCurrency
                                    : currencyFilter}
                                </td>
                                <td className="py-3 px-2.5 font-mono text-left text-white">
                                  {formatNumber(statement.finalBalanceIRR)} ریال
                                </td>
                              </>
                            )}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              )}
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
