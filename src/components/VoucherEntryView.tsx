import React, { useState, useMemo } from 'react';
import {
  Account,
  Contact,
  BankAccount,
  Currency,
  JournalVoucher,
  VoucherLine,
  CurrencyCode,
  PaymentSplitLine,
} from '../types/accounting';
import {
  buildPersonStatement,
  formatNumber,
  parseFormattedNumber,
} from '../utils/accountingEngine';
import { MultiPaymentSplitsEditor } from './MultiPaymentSplitsEditor';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Receipt,
  TrendingUp,
  CheckCircle2,
  Trash2,
  Landmark,
  User,
  Coins,
  Plus,
  BookOpen,
  Sparkles,
  UserPlus,
  X,
  Eye,
} from 'lucide-react';

interface VoucherEntryViewProps {
  accounts: Account[];
  contacts: Contact[];
  banks: BankAccount[];
  currencies: Currency[];
  vouchers: JournalVoucher[];
  onAddVoucher: (voucher: JournalVoucher) => void;
  onUpdateVoucher?: (voucher: JournalVoucher) => void;
  onDeleteVoucher?: (id: string) => void;
  onAddContact?: (contact: Contact) => void;
}

type AutoFinanceType =
  | 'receive_from_person'
  | 'pay_to_person'
  | 'bank_transfer'
  | 'expense'
  | 'income';

export const VoucherEntryView: React.FC<VoucherEntryViewProps> = ({
  accounts,
  contacts,
  banks,
  currencies,
  vouchers,
  onAddVoucher,
  onUpdateVoucher,
  onDeleteVoucher,
  onAddContact,
}) => {
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [entryTab, setEntryTab] = useState<'auto' | 'manual'>('auto');
  const [autoType, setAutoType] = useState<AutoFinanceType>('receive_from_person');
  const [date, setDate] = useState('1404/08/12');
  const [description, setDescription] = useState('');

  // فیلدهای مشترک حالت اتوماتیک
  const [selectedContactId, setSelectedContactId] = useState<string>(contacts[0]?.id || '');

  // برای دریافت از شخص / پرداخت به شخص (تک‌ردیفی سریع یا چند بانکی ترکیبی)
  const [splits, setSplits] = useState<PaymentSplitLine[]>(() => {
    const firstBank = banks[0];
    return firstBank
      ? [
          {
            id: 'spl-init-1',
            bankId: firstBank.id,
            bankName: firstBank.bankName,
            currency: firstBank.currency,
            amountForeign: 0,
            exchangeRate: 1,
            amountIRR: 0,
            trackingNumber: '',
          },
        ]
      : [];
  });

  // برای انتقال بین دو بانک/صندوق، یا ثبت هزینه و درآمد
  const [sourceBankId, setSourceBankId] = useState<string>(banks[0]?.id || '');
  const [destBankId, setDestBankId] = useState<string>(banks[1]?.id || banks[0]?.id || '');
  const [txCurrency, setTxCurrency] = useState<CurrencyCode>('IRR');
  const [txAmountForeign, setTxAmountForeign] = useState<number>(0);
  const [txExchangeRate, setTxExchangeRate] = useState<number>(1);
  const [expenseAccountCode, setExpenseAccountCode] = useState<string>('5201');
  const [incomeAccountCode, setIncomeAccountCode] = useState<string>('4101');

  // تعریف سریع شخص
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // پیام موفقیت و کارت تایید سند
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submittedVoucherSuccess, setSubmittedVoucherSuccess] = useState<JournalVoucher | null>(null);

  // تب سند دستی (پیشرفته)
  const [manualLines, setManualLines] = useState<Partial<VoucherLine>[]>([
    { id: 'ml-1', accountCode: '1102', currency: 'IRR', exchangeRate: 1, debitIRR: 0, creditIRR: 0 },
    { id: 'ml-2', accountCode: '1104', currency: 'IRR', exchangeRate: 1, debitIRR: 0, creditIRR: 0 },
  ]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // محاسبه مانده لحظه‌ای شخص انتخاب‌شده
  const selectedContactStatement = useMemo(() => {
    if (!selectedContactId) return null;
    return buildPersonStatement(vouchers, selectedContactId);
  }, [selectedContactId, vouchers]);

  const getRateForCurrency = (code: CurrencyCode): number => {
    if (code === 'IRR') return 1;
    return currencies.find((c) => c.code === code)?.defaultRateToIRR || 1;
  };

  const getAccountHelperForBank = (bank?: BankAccount) => {
    if (!bank) return { code: '1102', name: 'موجودی بانک‌های ریالی' };
    if (bank.currency !== 'IRR') {
      return { code: '1103', name: 'موجودی بانک‌ها و خزانه‌های ارزی' };
    }
    if (bank.kind === 'cash_box') {
      return { code: '1101', name: 'موجودی نقد و صندوق‌ها (ریالی و ارزی)' };
    }
    return { code: '1102', name: 'موجودی بانک‌های ریالی' };
  };

  const handleQuickCreateContact = () => {
    if (!newContactName.trim() || !onAddContact) return;
    const newC: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${1006 + contacts.length}`,
      name: newContactName.trim(),
      type: 'both',
      phone: newContactPhone.trim(),
      defaultCurrency: 'IRR',
      creditLimitIRR: 0,
    };
    onAddContact(newC);
    setSelectedContactId(newC.id);
    setNewContactName('');
    setNewContactPhone('');
    setShowQuickContact(false);
  };

  const handleSourceBankChange = (bId: string) => {
    setSourceBankId(bId);
    const b = banks.find((x) => x.id === bId);
    if (b) {
      setTxCurrency(b.currency);
      setTxExchangeRate(getRateForCurrency(b.currency));
    }
  };

  const txComputedIRR =
    txCurrency === 'IRR'
      ? Math.round(txAmountForeign)
      : Math.round(txAmountForeign * txExchangeRate);

  const handleAutoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const voucherNumber = 1004 + vouchers.length;
    const lines: VoucherLine[] = [];
    let autoTitle = '';

    if (autoType === 'receive_from_person' || autoType === 'pay_to_person') {
      const validSplits = splits.filter((s) => s.bankId && s.amountIRR > 0);
      if (!selectedContact || validSplits.length === 0) return;

      const isReceipt = autoType === 'receive_from_person';
      const totalIRR = validSplits.reduce((s, x) => s + x.amountIRR, 0);

      const personAccCode = selectedContact.type === 'supplier' ? '2101' : '1104';
      const personAccName =
        personAccCode === '2101'
          ? 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)'
          : 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)';

      validSplits.forEach((sp, idx) => {
        const bank = banks.find((b) => b.id === sp.bankId);
        const bankAcc = getAccountHelperForBank(bank);
        const baseActionDesc = isReceipt
          ? `دریافت از ${selectedContact.name} و واریز به ${bank?.bankName || 'بانک/صندوق'}`
          : `پرداخت به ${selectedContact.name} از ${bank?.bankName || 'بانک/صندوق'}`;

        const extraNotes = [description.trim(), (sp.description || '').trim()]
          .filter(Boolean)
          .join(' — ');
        const lineDesc = extraNotes ? `${baseActionDesc} | توضیحات: ${extraNotes}` : baseActionDesc;
        const trk = (sp.trackingNumber || '').trim() || `AUTO-${voucherNumber}-${idx + 1}`;

        // ردیف بانک / صندوق
        lines.push({
          id: `ln-auto-b-${Date.now()}-${idx}`,
          accountCode: bankAcc.code,
          accountName: bankAcc.name,
          bankId: sp.bankId,
          bankName: bank?.bankName,
          description: `${lineDesc} (شماره پیگیری فیش: ${trk})`,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isReceipt ? sp.amountForeign : 0,
          creditForeign: isReceipt ? 0 : sp.amountForeign,
          debitIRR: isReceipt ? sp.amountIRR : 0,
          creditIRR: isReceipt ? 0 : sp.amountIRR,
          trackingNumber: trk,
          reconciled: true,
        });

        // ردیف طرف حساب (شخص)
        lines.push({
          id: `ln-auto-p-${Date.now()}-${idx}`,
          accountCode: personAccCode,
          accountName: personAccName,
          contactId: selectedContact.id,
          contactName: selectedContact.name,
          description: `${lineDesc} (${
            sp.currency !== 'IRR'
              ? `${formatNumber(sp.amountForeign)} ${sp.currency} به ارزش هر واحد ${formatNumber(
                  sp.exchangeRate
                )} ریال`
              : `${formatNumber(sp.amountIRR)} ریال`
          })`,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isReceipt ? 0 : sp.amountForeign,
          creditForeign: isReceipt ? sp.amountForeign : 0,
          debitIRR: isReceipt ? 0 : sp.amountIRR,
          creditIRR: isReceipt ? sp.amountIRR : 0,
          trackingNumber: trk,
        });
      });

      autoTitle =
        description.trim() ||
        (isReceipt
          ? `سند اتوماتیک دریافت از ${selectedContact.name} (${formatNumber(totalIRR)} ریال)`
          : `سند اتوماتیک پرداخت به ${selectedContact.name} (${formatNumber(totalIRR)} ریال)`);
    } else if (autoType === 'bank_transfer') {
      if (txComputedIRR <= 0 || !sourceBankId || !destBankId) return;
      const srcBank = banks.find((b) => b.id === sourceBankId);
      const dstBank = banks.find((b) => b.id === destBankId);
      const srcAcc = getAccountHelperForBank(srcBank);
      const dstAcc = getAccountHelperForBank(dstBank);

      autoTitle =
        description.trim() ||
        `انتقال وجه از ${srcBank?.bankName || 'مبدأ'} به ${dstBank?.bankName || 'مقصد'}`;

      // بدهکار شدن بانک مقصد (ورود وجه)
      lines.push({
        id: `ln-tr-in-${Date.now()}`,
        accountCode: dstAcc.code,
        accountName: dstAcc.name,
        bankId: destBankId,
        bankName: dstBank?.bankName,
        description: `ورود وجه انتقالی از ${srcBank?.bankName} - ${autoTitle}`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: txAmountForeign,
        creditForeign: 0,
        debitIRR: txComputedIRR,
        creditIRR: 0,
        reconciled: true,
      });

      // بستانکار شدن بانک مبدأ (خروج وجه)
      lines.push({
        id: `ln-tr-out-${Date.now()}`,
        accountCode: srcAcc.code,
        accountName: srcAcc.name,
        bankId: sourceBankId,
        bankName: srcBank?.bankName,
        description: `خروج وجه انتقالی به ${dstBank?.bankName} - ${autoTitle}`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: 0,
        creditForeign: txAmountForeign,
        debitIRR: 0,
        creditIRR: txComputedIRR,
        reconciled: true,
      });
    } else if (autoType === 'expense') {
      if (txComputedIRR <= 0 || !sourceBankId) return;
      const srcBank = banks.find((b) => b.id === sourceBankId);
      const srcAcc = getAccountHelperForBank(srcBank);
      const expNode = accounts.find((a) => a.code === expenseAccountCode);

      autoTitle =
        description.trim() ||
        `پرداخت هزینه (${expNode?.name || 'هزینه'}) از ${srcBank?.bankName || 'بانک/صندوق'}`;

      lines.push({
        id: `ln-exp-d-${Date.now()}`,
        accountCode: expNode?.code || '5201',
        accountName: expNode?.name || 'هزینه‌های شخصی، حقوق و دستمزد',
        description: autoTitle,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: txAmountForeign,
        creditForeign: 0,
        debitIRR: txComputedIRR,
        creditIRR: 0,
      });

      lines.push({
        id: `ln-exp-c-${Date.now()}`,
        accountCode: srcAcc.code,
        accountName: srcAcc.name,
        bankId: sourceBankId,
        bankName: srcBank?.bankName,
        description: autoTitle,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: 0,
        creditForeign: txAmountForeign,
        debitIRR: 0,
        creditIRR: txComputedIRR,
        reconciled: true,
      });
    } else if (autoType === 'income') {
      if (txComputedIRR <= 0 || !sourceBankId) return;
      const dstBank = banks.find((b) => b.id === sourceBankId);
      const dstAcc = getAccountHelperForBank(dstBank);
      const incNode = accounts.find((a) => a.code === incomeAccountCode);

      autoTitle =
        description.trim() ||
        `واریز به ${dstBank?.bankName || 'بانک/صندوق'} بابت ${
          incNode?.name || 'درآمد / شارژ حساب'
        }`;

      lines.push({
        id: `ln-inc-d-${Date.now()}`,
        accountCode: dstAcc.code,
        accountName: dstAcc.name,
        bankId: sourceBankId,
        bankName: dstBank?.bankName,
        description: autoTitle,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: txAmountForeign,
        creditForeign: 0,
        debitIRR: txComputedIRR,
        creditIRR: 0,
        reconciled: true,
      });

      lines.push({
        id: `ln-inc-c-${Date.now()}`,
        accountCode: incNode?.code || '4101',
        accountName: incNode?.name || 'درآمد فروش ریالی',
        description: autoTitle,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: 0,
        creditForeign: txAmountForeign,
        debitIRR: 0,
        creditIRR: txComputedIRR,
      });
    }

    if (lines.length === 0) return;

    const newVoucher: JournalVoucher = {
      id: `vch-auto-${Date.now()}`,
      voucherNumber,
      date,
      description: autoTitle,
      status: 'permanent',
      createdAt: date,
      autoType,
      lines,
    };

    if (editingVoucherId && onUpdateVoucher) {
      const existing = vouchers.find((v) => v.id === editingVoucherId);
      onUpdateVoucher({
        ...newVoucher,
        id: editingVoucherId,
        voucherNumber: existing?.voucherNumber || voucherNumber,
      });
      setEditingVoucherId(null);
      setSuccessMsg(`سند شماره ${existing?.voucherNumber || voucherNumber} با موفقیت اصلاح و به‌روز شد.`);
    } else {
      onAddVoucher(newVoucher);
      setSuccessMsg(
        `سند اتوماتیک شماره ${voucherNumber} با موفقیت ثبت شد و موجودی بانک/صندوق و حساب شخص به‌روز گردید.`
      );
    }

    setSubmittedVoucherSuccess(newVoucher);
    setDescription('');
    setTxAmountForeign(0);
    if (splits.length > 0) {
      setSplits([
        {
          ...splits[0],
          id: `spl-${Date.now()}`,
          amountForeign: 0,
          amountIRR: 0,
          trackingNumber: '',
        },
      ]);
    }
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleStartEditVoucher = (v: JournalVoucher) => {
    setEditingVoucherId(v.id);
    setDate(v.date);
    setDescription(v.description);

    // If it has autoType, open auto tab
    if (v.autoType && v.autoType !== 'manual') {
      setEntryTab('auto');
      if (
        v.autoType === 'receive_from_person' ||
        v.autoType === 'pay_to_person' ||
        v.autoType === 'bank_transfer' ||
        v.autoType === 'expense' ||
        v.autoType === 'income'
      ) {
        setAutoType(v.autoType);
      }
      // Populate contact if available
      const firstContact = v.lines.find((l) => l.contactId);
      if (firstContact && firstContact.contactId) {
        setSelectedContactId(firstContact.contactId);
      }
      // Populate splits from bank lines
      const bankLines = v.lines.filter((l) => l.bankId);
      if (bankLines.length > 0) {
        const loadedSplits: PaymentSplitLine[] = bankLines.map((bl, i) => ({
          id: `spl-edit-${i}`,
          bankId: bl.bankId || '',
          bankName: bl.bankName || '',
          currency: bl.currency,
          amountForeign: bl.debitForeign || bl.creditForeign,
          exchangeRate: bl.exchangeRate,
          amountIRR: bl.debitIRR || bl.creditIRR,
          trackingNumber: bl.trackingNumber || '',
          description: bl.description,
        }));
        setSplits(loadedSplits);
      }
    } else {
      // Manual entry edit
      setEntryTab('manual');
      setManualLines(v.lines);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditVoucher = () => {
    setEditingVoucherId(null);
    setDescription('');
  };

  // ثبت سند دستی
  const totalManualDebit = manualLines.reduce((s, l) => s + (l.debitIRR || 0), 0);
  const totalManualCredit = manualLines.reduce((s, l) => s + (l.creditIRR || 0), 0);
  const isManualBalanced = totalManualDebit > 0 && totalManualDebit === totalManualCredit;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManualBalanced) return;

    const voucherLines: VoucherLine[] = manualLines.map((ml, i) => {
      const acc = accounts.find((a) => a.code === ml.accountCode);
      const bnk = ml.bankId ? banks.find((b) => b.id === ml.bankId) : undefined;
      const cnt = ml.contactId ? contacts.find((c) => c.id === ml.contactId) : undefined;
      return {
        id: `ml-${Date.now()}-${i}`,
        accountCode: ml.accountCode || '1102',
        accountName: acc?.name || 'حساب',
        contactId: ml.contactId || undefined,
        contactName: cnt?.name,
        bankId: ml.bankId || undefined,
        bankName: bnk?.bankName,
        description: ml.description || description || 'ثبت سند',
        currency: (ml.currency as CurrencyCode) || 'IRR',
        exchangeRate: ml.exchangeRate || 1,
        debitForeign: ml.debitIRR || 0,
        creditForeign: ml.creditIRR || 0,
        debitIRR: ml.debitIRR || 0,
        creditIRR: ml.creditIRR || 0,
      };
    });

    onAddVoucher({
      id: `vch-man-${Date.now()}`,
      voucherNumber: 1004 + vouchers.length,
      date,
      description: description || 'سند حسابداری',
      status: 'permanent',
      createdAt: date,
      autoType: 'manual',
      lines: voucherLines,
    });
    setDescription('');
  };

  const moeinAccounts = accounts.filter((a) => a.level === 'moein');

  return (
    <div className="space-y-6">
      {/* نوار انتخاب حالت اتوماتیک (شخصی و راحت) یا سند دستی */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              امور مالی و ثبت اتوماتیک دریافت، پرداخت، انتقال و هزینه
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              بدون نیاز به دانش حسابداری، فقط نوع عملیات را انتخاب کنید تا سند بانک، صندوق و حساب شخص به صورت ۱۰۰٪ خودکار صادر شود.
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setEntryTab('auto')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                entryTab === 'auto'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ثبت اتوماتیک و آسان (پیشنهادی)
            </button>
            <button
              type="button"
              onClick={() => setEntryTab('manual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                entryTab === 'manual'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              ثبت سند دستی (حرفه‌ای)
            </button>
          </div>
        </div>

        {editingVoucherId && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 font-bold">
            <span>
              در حال ویرایش و اصلاح سند شماره: {vouchers.find((v) => v.id === editingVoucherId)?.voucherNumber}
            </span>
            <button
              type="button"
              onClick={handleCancelEditVoucher}
              className="text-xs text-rose-700 hover:text-rose-800 underline cursor-pointer"
            >
              انصراف از ویرایش
            </button>
          </div>
        )}

        {/* SUCCESS CONFIRMATION CARD ON VOUCHER SUBMIT */}
        {submittedVoucherSuccess && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-emerald-950 text-sm sm:text-base">
                    سند مالی شماره #{submittedVoucherSuccess.voucherNumber} با موفقیت ثبت شد!
                  </h3>
                  <p className="text-xs text-emerald-800">
                    مانده حساب بانک، صندوق و طرف حساب در دیتابیس به‌روز گردید.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSubmittedVoucherSuccess(null)}
                className="p-1 rounded-xl text-emerald-700 hover:bg-emerald-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-emerald-200 text-xs font-mono-num">
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">شماره سند:</span>
                <span className="font-extrabold text-teal-800 text-sm">#{submittedVoucherSuccess.voucherNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">تاریخ سند:</span>
                <span className="font-extrabold text-slate-900 text-sm">{submittedVoucherSuccess.date}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">شرح سند:</span>
                <span className="font-extrabold text-slate-900 text-xs font-sans truncate block">{submittedVoucherSuccess.description}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setSubmittedVoucherSuccess(null)}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs cursor-pointer transition shadow-md shadow-teal-600/20"
              >
                + ثبت سند جدید
              </button>
            </div>
          </div>
        )}

        {successMsg && !submittedVoucherSuccess && (
          <div className="mb-5 bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {entryTab === 'auto' ? (
          <form onSubmit={handleAutoSubmit} className="space-y-6">
            {/* ۵ کارت انتخاب نوع عملیات اتوماتیک */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={() => setAutoType('receive_from_person')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'receive_from_person'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    ورود پول / ارز
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">
                  دریافت از شخص و واریز به بانک/صندوق
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  مشتری یا شخص پول/ارز به بانک یا صندوق شما داده است
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutoType('pay_to_person')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'pay_to_person'
                    ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <ArrowUpRight className="w-5 h-5 text-rose-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                    خروج پول / ارز
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">پرداخت به شخص از بانک/صندوق</div>
                <p className="text-[11px] text-slate-600 mt-1">
                  از بانک یا صندوق خودتان به شخص پول یا ارز پرداخت کرده‌اید
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutoType('bank_transfer')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'bank_transfer'
                    ? 'bg-sky-50 border-sky-500 text-sky-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <ArrowLeftRight className="w-5 h-5 text-sky-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold">
                    جابجایی داخلی
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">انتقال بین بانک‌ها و صندوق‌ها</div>
                <p className="text-[11px] text-slate-600 mt-1">
                  کارت به کارت یا جابجایی پول بین بانک‌ها و صندوق‌های خودتان
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutoType('expense')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'expense'
                    ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Receipt className="w-5 h-5 text-amber-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    ثبت خرج
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">ثبت هزینه شخصی / کاری</div>
                <p className="text-[11px] text-slate-600 mt-1">
                  پرداخت اجاره، حقوق، کارمزد یا هزینه‌های شخصی از بانک/صندوق
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutoType('income')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'income'
                    ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                    شارژ حساب
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">درآمد متفرقه / شارژ بانک</div>
                <p className="text-[11px] text-slate-600 mt-1">
                  واریز درآمد متفرقه یا افزایش موجودی بانک و صندوق
                </p>
              </button>
            </div>

            {/* محتوای فرم بر اساس نوع عملیات انتخابی */}
            {(autoType === 'receive_from_person' || autoType === 'pay_to_person') && (
              <div className="space-y-5 bg-slate-50/70 border border-slate-200 rounded-xl p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-teal-600" />
                        {autoType === 'receive_from_person'
                          ? 'دریافت وجه/ارز از کدام شخص؟'
                          : 'پرداخت وجه/ارز به کدام شخص؟'}
                      </label>
                      {onAddContact && (
                        <button
                          type="button"
                          onClick={() => setShowQuickContact(!showQuickContact)}
                          className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          + شخص جدید
                        </button>
                      )}
                    </div>
                    <select
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || 'بدون تلفن'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">تاریخ عملیات</label>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  {/* نمایش مانده لحظه‌ای شخص انتخاب شده */}
                  {selectedContactStatement && (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between shadow-xs">
                      <span className="text-xs text-slate-600">وضعیت فعلی حساب این شخص:</span>
                      <span
                        className={`text-xs font-extrabold font-mono-num ${
                          selectedContactStatement.finalStatusIRR === 'بدهکار'
                            ? 'text-emerald-700'
                            : selectedContactStatement.finalStatusIRR === 'بستانکار'
                            ? 'text-rose-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {selectedContactStatement.finalStatusIRR === 'تسویه'
                          ? 'تسویه (۰ ریال)'
                          : `${formatNumber(selectedContactStatement.finalBalanceIRR)} ریال (${
                              selectedContactStatement.finalStatusIRR === 'بدهکار'
                                ? 'طلب ما از ایشان'
                                : 'بدهی ما به ایشان'
                            })`}
                      </span>
                    </div>
                  )}
                </div>

                {showQuickContact && (
                  <div className="bg-white border border-teal-300 rounded-xl p-3 flex flex-wrap items-end gap-3 shadow-xs">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-bold text-teal-800 mb-1">نام شخص</label>
                      <input
                        type="text"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="مثلاً: رضا محمدی"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                      />
                    </div>
                    <div className="w-48">
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">شماره تماس</label>
                      <input
                        type="text"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickCreateContact}
                      className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                    >
                      ذخیره شخص
                    </button>
                  </div>
                )}

                <MultiPaymentSplitsEditor
                  title={
                    autoType === 'receive_from_person'
                      ? `انتخاب بانک یا صندوق مقصد (واریز دریافتی از ${
                          selectedContact?.name || 'شخص'
                        })`
                      : `انتخاب بانک یا صندوق مبدأ (برداشت جهت پرداخت به ${
                          selectedContact?.name || 'شخص'
                        })`
                  }
                  subtitle="می‌توانید یک یا چند بانک و صندوق را انتخاب کنید. اگر دریافت یا پرداخت شما ارزی (دلار، درهم، یورو، یوان) است، نوع ارز را انتخاب کرده و ارزش ریالی آن را تعیین کنید."
                  totalTargetIRR={0}
                  splits={splits}
                  onChange={setSplits}
                  banks={banks}
                  currencies={currencies}
                  mode={autoType === 'receive_from_person' ? 'receipt' : 'payment'}
                  contactName={selectedContact?.name}
                />
              </div>
            )}

            {/* حالت ۳، ۴ و ۵: انتقال بین بانک‌ها، ثبت هزینه، یا ثبت درآمد */}
            {(autoType === 'bank_transfer' ||
              autoType === 'expense' ||
              autoType === 'income') && (
              <div className="space-y-4 bg-slate-50/70 border border-slate-200 rounded-xl p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {autoType === 'bank_transfer'
                        ? 'از بانک یا صندوق مبدأ (برداشت)'
                        : autoType === 'expense'
                        ? 'پرداخت از کدام بانک یا صندوق؟'
                        : 'واریز به کدام بانک یا صندوق؟'}
                    </label>
                    <select
                      value={sourceBankId}
                      onChange={(e) => handleSourceBankChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                          {b.bankName} ({b.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {autoType === 'bank_transfer' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        به بانک یا صندوق مقصد (واریز)
                      </label>
                      <select
                        value={destBankId}
                        onChange={(e) => setDestBankId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                      >
                        {banks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                            {b.bankName} ({b.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {autoType === 'expense' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">نوع هزینه</label>
                      <select
                        value={expenseAccountCode}
                        onChange={(e) => setExpenseAccountCode(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                      >
                        {moeinAccounts
                          .filter((a) => a.category === 'expense')
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {autoType === 'income' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">منبع واریز / شارژ</label>
                      <select
                        value={incomeAccountCode}
                        onChange={(e) => setIncomeAccountCode(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                      >
                        {moeinAccounts
                          .filter((a) => a.category === 'revenue' || a.category === 'equity')
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">تاریخ</label>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                </div>

                {/* مبلغ و تعیین ارزش ارز در صورت ارزی بودن */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">نوع پول / ارز</label>
                    <select
                      value={txCurrency}
                      onChange={(e) => {
                        const c = e.target.value as CurrencyCode;
                        setTxCurrency(c);
                        setTxExchangeRate(getRateForCurrency(c));
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      <option value="IRR">ریال ایران (IRR)</option>
                      {currencies
                        .filter((c) => c.code !== 'IRR')
                        .map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {txCurrency === 'IRR' ? 'مبلغ (ریال)' : `مبلغ ارزی (${txCurrency})`}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={txAmountForeign ? formatNumber(txAmountForeign) : ''}
                      onChange={(e) => setTxAmountForeign(parseFormattedNumber(e.target.value))}
                      placeholder="مثلاً 10,000,000"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  {txCurrency !== 'IRR' && (
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-amber-600" />
                        تعیین ارزش هر ۱ {txCurrency} (به ریال)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={txExchangeRate ? formatNumber(txExchangeRate) : ''}
                        onChange={(e) => setTxExchangeRate(parseFormattedNumber(e.target.value))}
                        className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-900 font-mono-num focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                      />
                    </div>
                  )}

                  <div className="bg-white border border-teal-300 rounded-lg px-3.5 py-2 flex items-center justify-between shadow-xs">
                    <span className="text-xs text-slate-600">معادل ریالی سند:</span>
                    <span className="text-sm font-extrabold text-teal-700 font-mono-num">
                      {formatNumber(txComputedIRR)} ریال
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* شرح دلخواه و دکمه ثبت اتوماتیک */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex-1 min-w-[260px]">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیحات یا بابت (اختیاری - اگر خالی بگذارید سیستم خودش شرح استاندارد می‌نویسد)..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm flex items-center gap-2 transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                ثبت اتوماتیک سند مالی و به‌روزرسانی بانک/حساب
              </button>
            </div>
          </form>
        ) : (
          /* فرم سند دستی برای کاربران حرفه‌ای */
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">تاریخ سند</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">شرح کلی سند</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="شرح سند..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              {manualLines.map((line, idx) => (
                <div
                  key={line.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 items-center"
                >
                  <div className="md:col-span-3">
                    <select
                      value={line.accountCode}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = { ...next[idx], accountCode: e.target.value };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                    >
                      {moeinAccounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={line.contactId || ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = { ...next[idx], contactId: e.target.value || undefined };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                    >
                      <option value="">-- بدون شخص --</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={line.bankId || ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = { ...next[idx], bankId: e.target.value || undefined };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                    >
                      <option value="">-- بدون بانک/صندوق --</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="بدهکار (ریال)"
                      value={line.debitIRR ? formatNumber(line.debitIRR) : ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = {
                          ...next[idx],
                          debitIRR: parseFormattedNumber(e.target.value),
                          creditIRR: 0,
                        };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="بستانکار (ریال)"
                      value={line.creditIRR ? formatNumber(line.creditIRR) : ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = {
                          ...next[idx],
                          creditIRR: parseFormattedNumber(e.target.value),
                          debitIRR: 0,
                        };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600"
                    />
                  </div>
                  <div className="md:col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        manualLines.length > 2 &&
                        setManualLines(manualLines.filter((_, i) => i !== idx))
                      }
                      className="text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() =>
                  setManualLines([
                    ...manualLines,
                    {
                      id: `ml-${Date.now()}`,
                      accountCode: '1102',
                      currency: 'IRR',
                      exchangeRate: 1,
                      debitIRR: 0,
                      creditIRR: 0,
                    },
                  ])
                }
                className="text-xs bg-slate-100 hover:bg-slate-200 text-teal-800 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                افزودن آرتیکل
              </button>

              <button
                type="submit"
                disabled={!isManualBalanced}
                className="px-5 py-2 rounded-xl bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs cursor-pointer shadow-xs"
              >
                ثبت سند دستی
              </button>
            </div>
          </form>
        )}
      </div>

      {/* فهرست اسناد مالی ثبت‌شده (اتوماتیک و دستی) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-teal-600" />
          تاریخچه اسناد مالی و تراکنش‌های ثبت‌شده ({formatNumber(vouchers.length)} سند)
        </h3>

        <div className="space-y-3">
          {vouchers.map((v) => {
            const sumIRR = v.lines.reduce((s, l) => s + l.debitIRR, 0);
            return (
              <div
                key={v.id}
                className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-mono-num text-xs font-bold border border-teal-200">
                      سند #{v.voucherNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-mono-num">{v.date}</span>
                    <span className="text-sm font-bold text-slate-900">{v.description}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-emerald-700 font-mono-num">
                      جمع سند: {formatNumber(sumIRR)} ریال
                    </span>
                    {onUpdateVoucher && (
                      <button
                        type="button"
                        onClick={() => handleStartEditVoucher(v)}
                        className="text-teal-700 hover:text-teal-800 p-1 rounded hover:bg-teal-50 cursor-pointer text-xs flex items-center gap-1 font-bold"
                        title="ویرایش و اصلاح این سند"
                      >
                        ویرایش
                      </button>
                    )}
                    {onDeleteVoucher && v.id !== 'vch-1' && (
                      <button
                        type="button"
                        onClick={() => onDeleteVoucher(v.id)}
                        className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                        title="حذف این سند"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {v.lines.map((ln) => {
                    const bankObj = ln.bankId ? banks.find((b) => b.id === ln.bankId) : undefined;
                    const contactObj = ln.contactId
                      ? contacts.find((c) => c.id === ln.contactId)
                      : undefined;
                    return (
                      <div
                        key={ln.id}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="truncate">
                          <span className="font-bold text-slate-900">{ln.accountName}</span>
                          {bankObj && (
                            <span className="text-teal-700 font-bold mr-1.5">({bankObj.bankName})</span>
                          )}
                          {contactObj && (
                            <span className="text-amber-800 font-bold mr-1.5">({contactObj.name})</span>
                          )}
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {ln.description}
                          </p>
                        </div>
                        <div className="text-left shrink-0 font-mono-num">
                          {ln.debitIRR > 0 ? (
                            <span className="text-emerald-700 font-bold">
                              بدهکار: {formatNumber(ln.debitIRR)}
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold">
                              بستانکار: {formatNumber(ln.creditIRR)}
                            </span>
                          )}
                          {ln.currency !== 'IRR' && (
                            <div className="text-[10px] text-amber-800 font-semibold">
                              ({formatNumber(ln.debitForeign || ln.creditForeign)} {ln.currency} ×{' '}
                              {formatNumber(ln.exchangeRate)})
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
