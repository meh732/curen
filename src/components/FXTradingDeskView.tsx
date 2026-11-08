import React, { useState, useMemo, useEffect } from 'react';
import {
  FXDeal,
  FXDeliverySplit,
  Currency,
  Contact,
  BankAccount,
  CurrencyCode,
  PaymentSplitLine,
  JournalVoucher,
  VoucherLine,
} from '../types/accounting';
import {
  formatNumber,
  formatCurrencyAmount,
  parseFormattedNumber,
  buildPersonStatement,
  getTodayJalaliDate,
  getCurrentJalaliYear,
} from '../utils/accountingEngine';
import {
  exportOrPrintSingleDealReceiptPDF,
  exportOrPrintFXDealsSummaryPDF,
} from '../utils/pdfPrintReportService';
import { MultiPaymentSplitsEditor } from './MultiPaymentSplitsEditor';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  CheckCircle2,
  Trash2,
  Landmark,
  UserPlus,
  Printer,
  Eye,
  X,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  PackageCheck,
  Search,
  Edit3,
  Hash,
} from 'lucide-react';

interface FXTradingDeskViewProps {
  fxDeals: FXDeal[];
  currencies: Currency[];
  contacts: Contact[];
  banks: BankAccount[];
  vouchers?: JournalVoucher[];
  companyName?: string;
  fiscalYear?: string;
  onExecuteDeal: (deal: FXDeal) => void;
  onUpdateDeal?: (deal: FXDeal) => void;
  onRecordDealDelivery?: (dealId: string, split: FXDeliverySplit) => void;
  onAddContact?: (contact: Contact) => void;
  onDeleteDeal?: (id: string) => void;
  onAddVoucher?: (voucher: JournalVoucher) => void;
  onUpdateVoucher?: (voucher: JournalVoucher) => void;
  onDeleteVoucher?: (id: string) => void;
}

export const FXTradingDeskView: React.FC<FXTradingDeskViewProps> = ({
  fxDeals,
  currencies,
  contacts,
  banks,
  vouchers = [],
  companyName = 'آرکا (ARKA) — صرافی و خدمات ارزی',
  fiscalYear = '۱۴۰۴',
  onExecuteDeal,
  onUpdateDeal,
  onAddContact,
  onDeleteDeal,
  onAddVoucher,
  onUpdateVoucher,
  onDeleteVoucher,
}) => {
  const [subTab, setSubTab] = useState<'trade_form' | 'delivery_statement'>('trade_form');

  const foreignCurrencies = currencies.filter((c) => c.code !== 'IRR');
  const [dealType, setDealType] = useState<'buy' | 'sell'>('buy');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  // پیشنهاد فی بر اساس آخرین معامله ثبت شده برای این ارز
  const getSuggestedRateForCurrency = (cur: CurrencyCode): number => {
    for (let i = fxDeals.length - 1; i >= 0; i--) {
      if (fxDeals[i].currency === cur && fxDeals[i].exchangeRate > 0) {
        return fxDeals[i].exchangeRate;
      }
    }
    const curCfg = currencies.find((c) => c.code === cur);
    return curCfg?.defaultRateToIRR || 0;
  };

  // مقدار ارز و تحویل به صورت پیش‌فرض خام (۰) هستند تا کاربر مقدار دلخواه را وارد کند
  const [foreignAmount, setForeignAmount] = useState<number>(0);
  const [dealDate, setDealDate] = useState<string>(() => getTodayJalaliDate());
  const [dealNotes, setDealNotes] = useState<string>('');
  const [dealTrackingNumber, setDealTrackingNumber] = useState<string>('');

  // آیا ارز در لحظه معامله تحویل صندوق شده یا در حساب ارزی شخص می‌ماند تا بعداً در بخش تحویل ارز ثبت شود؟
  const [isDeferredDelivery, setIsDeferredDelivery] = useState<boolean>(false);

  // فی بر اساس آخرین معامله ارز پیشنهاد می‌شود
  const [dealRate, setDealRate] = useState<number>(() => getSuggestedRateForCurrency('USD'));
  const [commissionIRR, setCommissionIRR] = useState<number>(0);
  const [contactId, setContactId] = useState<string>(contacts[0]?.id || '');

  // صندوق یا حساب ارزی که ارز معامله‌شده به آن وارد یا از آن خارج می‌شود
  const matchingForeignBanks = banks.filter((b) => b.currency === currency);
  const [targetVaultBankId, setTargetVaultBankId] = useState<string>(
    matchingForeignBanks[0]?.id ||
      banks.find((b) => b.currency !== 'IRR')?.id ||
      banks[0]?.id ||
      ''
  );

  useEffect(() => {
    if (contacts.length > 0 && (!contactId || !contacts.some((c) => c.id === contactId))) {
      setContactId(contacts[0].id);
    }
  }, [contacts, contactId]);

  useEffect(() => {
    if (banks.length > 0 && (!targetVaultBankId || !banks.some((b) => b.id === targetVaultBankId))) {
      const match =
        banks.find((b) => b.currency === currency) ||
        banks.find((b) => b.currency !== 'IRR') ||
        banks[0];
      if (match) setTargetVaultBankId(match.id);
    }
  }, [banks, targetVaultBankId, currency]);

  // ردیف‌های دریافت یا پرداخت معادل ریالی معامله (چند بانکی / چند صندوقی)
  const [payments, setPayments] = useState<PaymentSplitLine[]>([]);

  // تعریف سریع شخص
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // بنر تایید فوری پس از ثبت معامله + مودال مشاهده رسید معامله
  const [lastCreatedDeal, setLastCreatedDeal] = useState<FXDeal | null>(null);
  const [previewDeal, setPreviewDeal] = useState<FXDeal | null>(null);

  // جستجوی شماره معامله، فیش، نام شخص یا ارز در فهرست معاملات
  const [dealSearchQuery, setDealSearchQuery] = useState<string>('');

  // وضعیت ویرایش معامله
  const [editingDealId, setEditingDealId] = useState<string | null>(null);

  // =========================================================================
  // استیت‌های تب دوم: تحویل ارز اشخاص (دریافت و پرداخت ارزی مستقل، دقیقاً مثل دریافت و پرداخت ریالی)
  // =========================================================================
  const [dlvEditingVoucherId, setDlvEditingVoucherId] = useState<string | null>(null);
  const [dlvDirection, setDlvDirection] = useState<'receive' | 'pay'>('receive');
  const [dlvContactId, setDlvContactId] = useState<string>(contacts[0]?.id || '');
  const [dlvCurrency, setDlvCurrency] = useState<CurrencyCode>(foreignCurrencies[0]?.code || 'USD');
  const [dlvAmount, setDlvAmount] = useState<number>(0);
  const [dlvBankId, setDlvBankId] = useState<string>(
    banks.find((b) => b.currency !== 'IRR')?.id || banks[0]?.id || ''
  );
  const [dlvDate, setDlvDate] = useState<string>(() => getTodayJalaliDate());
  const [dlvTracking, setDlvTracking] = useState<string>('');
  const [dlvNotes, setDlvNotes] = useState<string>('');
  const [dlvSearchQuery, setDlvSearchQuery] = useState<string>('');
  const [dlvSuccessToast, setDlvSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (contacts.length > 0 && (!dlvContactId || !contacts.some((c) => c.id === dlvContactId))) {
      setDlvContactId(contacts[0].id);
    }
  }, [contacts, dlvContactId]);

  useEffect(() => {
    if (banks.length > 0 && (!dlvBankId || !banks.some((b) => b.id === dlvBankId))) {
      const match =
        banks.find((b) => b.currency === dlvCurrency) ||
        banks.find((b) => b.currency !== 'IRR') ||
        banks[0];
      if (match) setDlvBankId(match.id);
    }
  }, [banks, dlvBankId, dlvCurrency]);

  const dlvSelectedContact = contacts.find((c) => c.id === dlvContactId) || contacts[0];
  const dlvContactStatement = useMemo(() => {
    if (!dlvSelectedContact) return null;
    return buildPersonStatement(vouchers, dlvSelectedContact.id, 'ALL');
  }, [vouchers, dlvSelectedContact]);

  // فهرست اسناد تحویل ارز (دریافت و پرداخت ارزی اشخاص)
  const currencyDeliveryVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const isExplicitCurrencyDlv =
        v.autoType === 'currency_receive_from_person' ||
        v.autoType === 'currency_pay_to_person';
      const isForeignPersonReceiptOrPay =
        (v.autoType === 'receive_from_person' || v.autoType === 'pay_to_person') &&
        v.lines.some((l) => l.currency !== 'IRR' && ((l.debitForeign || 0) > 0 || (l.creditForeign || 0) > 0));
      if (!isExplicitCurrencyDlv && !isForeignPersonReceiptOrPay) return false;

      if (!dlvSearchQuery.trim()) return true;
      const q = dlvSearchQuery.trim().toLowerCase();
      return (
        String(v.voucherNumber).includes(q) ||
        (v.referenceNumber || '').toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.date.includes(q) ||
        v.lines.some(
          (l) =>
            (l.contactName || '').toLowerCase().includes(q) ||
            (l.trackingNumber || '').toLowerCase().includes(q) ||
            l.currency.toLowerCase().includes(q)
        )
      );
    });
  }, [vouchers, dlvSearchQuery]);

  const handleSaveCurrencyDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dlvSelectedContact || dlvAmount <= 0 || !onAddVoucher) return;

    const existingVch = dlvEditingVoucherId
      ? vouchers.find((v) => v.id === dlvEditingVoucherId)
      : undefined;
    const nextVchNum =
      existingVch?.voucherNumber ||
      Math.max(1003, ...vouchers.map((v) => v.voucherNumber || 0)) + 1;

    const isRec = dlvDirection === 'receive';
    const vaultBank = banks.find((b) => b.id === dlvBankId) || banks[0];
    const personAccCode = dlvSelectedContact.type === 'supplier' ? '2101' : '1104';
    const personAccName =
      personAccCode === '2101'
        ? 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)'
        : 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)';
    const trk = dlvTracking.trim() || `DLV-${nextVchNum}`;
    const rate = 1; // تحویل و دریافت ارز سند خالص ارزی است و بدون فی ریالی ثبت می‌شود

    const baseDesc = isRec
      ? `دریافت ارز (${formatNumber(dlvAmount)} ${dlvCurrency}) از ${
          dlvSelectedContact.name
        } و ورود به ${vaultBank?.bankName || `صندوق ارزی (${dlvCurrency})`}`
      : `تحویل / پرداخت ارز (${formatNumber(dlvAmount)} ${dlvCurrency}) به ${
          dlvSelectedContact.name
        } از ${vaultBank?.bankName || `صندوق ارزی (${dlvCurrency})`}`;
    const fullDesc = dlvNotes.trim() ? `${baseDesc} | توضیحات: ${dlvNotes.trim()}` : baseDesc;

    const lines: VoucherLine[] = [
      {
        id: `ln-dlv-b-${Date.now()}-1`,
        accountCode: '1103',
        accountName: 'موجودی بانک‌ها و خزانه‌های ارزی',
        bankId: vaultBank?.id,
        bankName: vaultBank?.bankName || `صندوق ارزی (${dlvCurrency})`,
        description: `${fullDesc} [شماره فیش/رهگیری: ${trk}]`,
        currency: dlvCurrency,
        exchangeRate: rate,
        debitForeign: isRec ? dlvAmount : 0,
        creditForeign: isRec ? 0 : dlvAmount,
        debitIRR: 0,
        creditIRR: 0,
        trackingNumber: trk,
        reconciled: true,
      },
      {
        id: `ln-dlv-p-${Date.now()}-2`,
        accountCode: personAccCode,
        accountName: personAccName,
        contactId: dlvSelectedContact.id,
        contactName: dlvSelectedContact.name,
        description: `${fullDesc} [شماره فیش/رهگیری: ${trk}]`,
        currency: dlvCurrency,
        exchangeRate: rate,
        debitForeign: isRec ? 0 : dlvAmount,
        creditForeign: isRec ? dlvAmount : 0,
        debitIRR: 0,
        creditIRR: 0,
        trackingNumber: trk,
      },
    ];

    const targetVoucher: JournalVoucher = {
      id: dlvEditingVoucherId || `vch-dlv-${Date.now()}`,
      voucherNumber: nextVchNum,
      date: dlvDate || getTodayJalaliDate(),
      description: fullDesc,
      referenceNumber: trk,
      status: 'permanent',
      createdAt: dlvDate || getTodayJalaliDate(),
      autoType: isRec ? 'currency_receive_from_person' : 'currency_pay_to_person',
      lines,
    };

    if (dlvEditingVoucherId && onUpdateVoucher) {
      onUpdateVoucher(targetVoucher);
      setDlvEditingVoucherId(null);
      setDlvSuccessToast(
        `سند تحویل ارز شماره #${nextVchNum} (${formatNumber(dlvAmount)} ${dlvCurrency} - ${dlvSelectedContact.name}) با موفقیت ویرایش شد.`
      );
    } else {
      onAddVoucher(targetVoucher);
      setDlvSuccessToast(
        `${isRec ? 'دریافت' : 'تحویل / پرداخت'} ${formatNumber(dlvAmount)} ${dlvCurrency} ${
          isRec ? 'از' : 'به'
        } «${dlvSelectedContact.name}» در صورتحساب شخص و موجودی صندوق ثبت شد.`
      );
    }

    setDlvAmount(0);
    setDlvTracking('');
    setDlvNotes('');
  };

  const handleStartEditDeliveryVoucher = (v: JournalVoucher) => {
    setDlvEditingVoucherId(v.id);
    setDlvDate(v.date);
    const bankLine = v.lines.find((l) => l.bankId) || v.lines[0];
    const personLine = v.lines.find((l) => l.contactId) || v.lines[1];
    const isRec =
      v.autoType === 'currency_receive_from_person' ||
      v.autoType === 'receive_from_person' ||
      (bankLine?.debitForeign || 0) > 0;
    setDlvDirection(isRec ? 'receive' : 'pay');
    if (personLine?.contactId) setDlvContactId(personLine.contactId);
    if (bankLine?.currency && bankLine.currency !== 'IRR') setDlvCurrency(bankLine.currency);
    setDlvAmount(bankLine?.debitForeign || bankLine?.creditForeign || 0);
    if (bankLine?.bankId) setDlvBankId(bankLine.bankId);
    setDlvTracking(v.referenceNumber || bankLine?.trackingNumber || '');
    setDlvNotes(v.description);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredDeals = useMemo(() => {
    if (!dealSearchQuery.trim()) return fxDeals;
    const q = dealSearchQuery.trim().toLowerCase();
    return fxDeals.filter(
      (d) =>
        d.dealNumber.toLowerCase().includes(q) ||
        (d.trackingNumber && d.trackingNumber.toLowerCase().includes(q)) ||
        d.contactName.toLowerCase().includes(q) ||
        d.currency.toLowerCase().includes(q) ||
        d.date.includes(q)
    );
  }, [fxDeals, dealSearchQuery]);

  const handleStartEditDeal = (d: FXDeal) => {
    setEditingDealId(d.id);
    setDealType(d.type);
    setCurrency(d.currency);
    setForeignAmount(d.foreignAmount);
    setDealRate(d.exchangeRate);
    setCommissionIRR(d.commissionIRR || 0);
    setContactId(d.contactId);
    setDealDate(d.date);
    setDealTrackingNumber(d.trackingNumber || '');
    setDealNotes(d.notes || '');
    if (d.targetForeignBankId) setTargetVaultBankId(d.targetForeignBankId);
    setPayments(d.payments || []);
    setIsDeferredDelivery((d.deliveredForeignAmount ?? d.foreignAmount) === 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingDealId(null);
    setForeignAmount(0);
    setDealNotes('');
    setDealTrackingNumber('');
    setIsDeferredDelivery(false);
    setPayments([]);
  };

  const handleCurrencyChange = (code: CurrencyCode) => {
    setCurrency(code);
    const suggested = getSuggestedRateForCurrency(code);
    setDealRate(suggested);
    const vaultForCur = banks.find((b) => b.currency === code);
    if (vaultForCur) setTargetVaultBankId(vaultForCur.id);
  };

  const baseTotalIRR = Math.round(foreignAmount * dealRate);
  const totalIRR =
    dealType === 'buy'
      ? baseTotalIRR + commissionIRR
      : Math.max(0, baseTotalIRR - commissionIRR);

  const effectiveDeliveredNow = isDeferredDelivery ? 0 : foreignAmount;
  const remainingUndeliveredNow = isDeferredDelivery ? foreignAmount : 0;

  const selectedContact = contacts.find((c) => c.id === contactId) || contacts[0];

  // محاسبه وضعیت فعلی مشتری قبل از ثبت این معامله
  const currentCustomerStatement = useMemo(() => {
    if (!selectedContact) return null;
    return buildPersonStatement(vouchers, selectedContact.id, 'ALL');
  }, [vouchers, selectedContact]);

  const validPayments = useMemo(
    () => payments.filter((p) => p.bankId && p.amountIRR > 0),
    [payments]
  );
  const paidSumIRR = useMemo(
    () => validPayments.reduce((s, p) => s + p.amountIRR, 0),
    [validPayments]
  );
  const remainingIRR = Math.max(0, totalIRR - paidSumIRR);

  // محاسبه مانده جدید مشتری بعد از این معامله به زبان ساده
  const projectedBalanceInfo = useMemo(() => {
    const prevSigned =
      currentCustomerStatement?.finalStatusIRR === 'بدهکار'
        ? currentCustomerStatement.finalBalanceIRR
        : currentCustomerStatement?.finalStatusIRR === 'بستانکار'
        ? -currentCustomerStatement.finalBalanceIRR
        : 0;

    const deltaSigned = dealType === 'sell' ? remainingIRR : -remainingIRR;
    const nextSigned = prevSigned + deltaSigned;

    return {
      absBalance: Math.abs(nextSigned),
      statusLabel:
        nextSigned > 0
          ? 'بدهکار به ما (باید به ما پول بدهد)'
          : nextSigned < 0
          ? 'طلبکار از ما (ما باید به او پول بدهیم)'
          : 'تسویه کامل (بی‌حساب)',
      badgeColor:
        nextSigned > 0
          ? 'text-emerald-800 bg-emerald-100 border-emerald-300'
          : nextSigned < 0
          ? 'text-rose-800 bg-rose-100 border-rose-300'
          : 'text-slate-700 bg-slate-100 border-slate-300',
    };
  }, [currentCustomerStatement, dealType, remainingIRR]);

  const handleQuickCreateContact = () => {
    if (!newContactName.trim() || !onAddContact) return;
    const nextContactCodeNum =
      Math.max(1000, ...contacts.map((c) => parseInt(c.code.replace(/\D/g, ''), 10) || 1000)) + 1;
    const newC: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${nextContactCodeNum}`,
      name: newContactName.trim(),
      type: 'both',
      phone: newContactPhone.trim(),
      defaultCurrency: currency,
      creditLimitIRR: 0,
    };
    onAddContact(newC);
    setContactId(newC.id);
    setDlvContactId(newC.id);
    setNewContactName('');
    setNewContactPhone('');
    setShowQuickContact(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetContact = selectedContact;
    if (foreignAmount <= 0 || dealRate <= 0 || !targetContact) return;

    let settlementMethod: FXDeal['settlementMethod'] = 'credit_account';
    if (validPayments.length > 1) settlementMethod = 'multi_split';
    else if (paidSumIRR >= totalIRR) settlementMethod = 'bank_transfer';
    else if (paidSumIRR > 0) settlementMethod = 'multi_split';

    const nextDealSeq =
      Math.max(
        1000,
        ...fxDeals.map((d) => {
          const tail = d.dealNumber.split('-').pop() || '1000';
          return parseInt(tail.replace(/\D/g, ''), 10) || 1000;
        })
      ) + 1;
    const dealNum = `FX-${getCurrentJalaliYear()}-${nextDealSeq}`;
    const trkMain = dealTrackingNumber.trim() || dealNum;
    const deliveryStatus: FXDeal['deliveryStatus'] = isDeferredDelivery ? 'pending' : 'delivered';

    if (editingDealId && onUpdateDeal) {
      const existing = fxDeals.find((d) => d.id === editingDealId);
      if (existing) {
        const updatedDeal: FXDeal = {
          ...existing,
          date: dealDate || existing.date,
          type: dealType,
          currency,
          foreignAmount,
          exchangeRate: dealRate,
          totalIRR,
          commissionIRR,
          contactId: targetContact.id,
          contactName: targetContact.name,
          settlementMethod,
          targetForeignBankId: targetVaultBankId,
          payments: validPayments,
          paidAmountIRR: paidSumIRR,
          remainingAmountIRR: remainingIRR,
          deliveredForeignAmount: effectiveDeliveredNow,
          remainingForeignDelivery: remainingUndeliveredNow,
          deliveryStatus,
          trackingNumber: trkMain,
          notes: dealNotes.trim() || undefined,
        };

        onUpdateDeal(updatedDeal);
        setEditingDealId(null);
        setLastCreatedDeal(updatedDeal);
        setPayments([]);
        setDealNotes('');
        setDealTrackingNumber('');
        setIsDeferredDelivery(false);
        setForeignAmount(0);
        return;
      }
    }

    const newDeal: FXDeal = {
      id: `fx-${Date.now()}`,
      dealNumber: dealNum,
      date: dealDate || getTodayJalaliDate(),
      type: dealType,
      currency,
      foreignAmount,
      exchangeRate: dealRate,
      totalIRR,
      commissionIRR,
      contactId: targetContact.id,
      contactName: targetContact.name,
      settlementMethod,
      targetForeignBankId: targetVaultBankId,
      payments: validPayments,
      paidAmountIRR: paidSumIRR,
      remainingAmountIRR: remainingIRR,
      deliveredForeignAmount: effectiveDeliveredNow,
      remainingForeignDelivery: remainingUndeliveredNow,
      deliveryStatus,
      trackingNumber: trkMain,
      linkedVoucherId: `vch-fx-${Date.now()}`,
      notes: dealNotes.trim() || undefined,
    };

    onExecuteDeal(newDeal);
    setLastCreatedDeal(newDeal);
    setPayments([]);
    setDealNotes('');
    setDealTrackingNumber('');
    setIsDeferredDelivery(false);
    setForeignAmount(0);
  };

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* نوار انتخاب بخش: ثبت معامله ارز یا تحویل ارز اشخاص (دریافت و پرداخت ارزی) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('trade_form')}
            className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              subTab === 'trade_form'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>۱. ثبت فاکتور خرید و فروش ارز + فهرست معاملات</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('delivery_statement')}
            className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              subTab === 'delivery_statement'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <PackageCheck className="w-4 h-4 shrink-0" />
            <span>۲. تحویل ارز اشخاص (دریافت و پرداخت ارزی مثل ریالی)</span>
          </button>
        </div>
      </div>

      {dlvSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{dlvSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setDlvSuccessToast(null)}
            className="text-emerald-800 underline cursor-pointer shrink-0"
          >
            بستن
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب اول: ثبت خرید و فروش ارز + فهرست معاملات */}
      {/* ===================================================================== */}
      {subTab === 'trade_form' && (
        <>
          {/* بنر تایید فوری پس از ثبت معامله ارز */}
          {lastCreatedDeal && (
            <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 shadow-md space-y-3 animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-extrabold text-emerald-950">
                        فاکتور {lastCreatedDeal.type === 'buy' ? 'خرید ارز' : 'فروش ارز'} با موفقیت ثبت شد!
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 font-mono-num font-extrabold text-xs text-emerald-900">
                        شماره رسید: {lastCreatedDeal.dealNumber}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5 font-medium">
                      صورتحساب <strong>{lastCreatedDeal.contactName}</strong> به صورت خودکار بروزرسانی شد.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLastCreatedDeal(null)}
                  className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {(lastCreatedDeal.remainingForeignDelivery ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDlvContactId(lastCreatedDeal.contactId);
                      setDlvCurrency(lastCreatedDeal.currency);
                      setDlvDirection(lastCreatedDeal.type === 'buy' ? 'receive' : 'pay');
                      setSubTab('delivery_statement');
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4" />
                    رفتن به بخش تحویل ارز ({lastCreatedDeal.contactName})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewDeal(lastCreatedDeal)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  مشاهده و چاپ رسید ({lastCreatedDeal.dealNumber})
                </button>
              </div>
            </div>
          )}

          {/* فرم ثبت خرید یا فروش ارز به زبان ساده */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
            {editingDealId && (
              <div className="mb-4 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-950 font-bold animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    در حال ویرایش فاکتور معامله{' '}
                    <strong className="font-mono-num">
                      {fxDeals.find((d) => d.id === editingDealId)?.dealNumber}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-slate-700 cursor-pointer text-xs font-bold transition"
                >
                  انصراف از ویرایش
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500 shrink-0" />
                  ثبت فاکتور خرید و فروش ارز
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  اگر ارز را در روزهای آینده در چند مرحله تحویل می‌گیرید یا می‌دهید، گزینه «تحویل ارز بعداً» را انتخاب کنید تا در صورتحساب ارزی شخص ثبت شود.
                </p>
              </div>

              {/* کلید بزرگ انتخاب خرید یا فروش */}
              <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto gap-1">
                <button
                  type="button"
                  onClick={() => setDealType('buy')}
                  className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dealType === 'buy'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 shrink-0" />
                  <span>۱. فاکتور خرید ارز از شخص</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDealType('sell')}
                  className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dealType === 'sell'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                  <span>۲. فاکتور فروش ارز به شخص</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ردیف اول: مشتری، نوع ارز، تاریخ و صندوق ارزی */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* انتخاب طرف حساب */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-700">
                      {dealType === 'buy' ? 'فروشنده ارز (مشتری / شخص):' : 'خریدار ارز (مشتری / شخص):'}
                    </label>
                    {onAddContact && (
                      <button
                        type="button"
                        onClick={() => setShowQuickContact(!showQuickContact)}
                        className="text-[11px] text-teal-700 hover:text-teal-800 font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + شخص جدید
                      </button>
                    )}
                  </div>
                  {contacts.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowQuickContact(true)}
                      className="w-full py-2 px-3 rounded-xl border-2 border-dashed border-teal-400 bg-teal-50 text-teal-900 font-bold text-xs cursor-pointer"
                    >
                      + ابتدا نام اولین شخص را ثبت کنید
                    </button>
                  ) : (
                    <select
                      value={selectedContact?.id || ''}
                      onChange={(e) => setContactId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                    >
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* انتخاب نوع ارز */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    نوع ارز مورد معامله:
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {foreignCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* صندوق یا حساب ارزی */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {dealType === 'buy'
                      ? `صندوق/حساب ارزی (${currency}):`
                      : `صندوق/حساب ارزی (${currency}):`}
                  </label>
                  <select
                    value={targetVaultBankId}
                    onChange={(e) => setTargetVaultBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {banks.length === 0 ? (
                      <option value="">صندوق ارزی پیش‌فرض صرافی</option>
                    ) : (
                      banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                          {b.bankName} ({b.currency})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* تاریخ معامله */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    تاریخ فاکتور:
                  </label>
                  <input
                    type="text"
                    value={dealDate}
                    onChange={(e) => setDealDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono-num font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* فرم سریع تعریف مشتری جدید */}
              {showQuickContact && (
                <div className="bg-teal-50/70 border border-teal-300 rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-extrabold text-teal-950 mb-1">
                      نام مشتری یا همکار جدید *
                    </label>
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder="مثلاً: مرادی یا صرافی پارسیان"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div className="sm:w-48">
                    <label className="block text-xs font-bold text-slate-700 mb-1">شماره موبایل</label>
                    <input
                      type="text"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="0912..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono-num"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleQuickCreateContact}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs cursor-pointer"
                    >
                      ذخیره و انتخاب شخص
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickContact(false)}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}

              {/* نوار نمایش وضعیت فعلی حساب این مشتری قبل از معامله */}
              {selectedContact && currentCustomerStatement && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-slate-600 font-medium">
                      وضعیت فعلی حساب <strong className="text-slate-900">{selectedContact.name}</strong>:
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono-num">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg font-extrabold border ${
                        currentCustomerStatement.finalStatusIRR === 'بدهکار'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : currentCustomerStatement.finalStatusIRR === 'بستانکار'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {currentCustomerStatement.finalStatusIRR === 'تسویه'
                        ? 'حساب ریالی تسویه (۰ ریال)'
                        : `${formatNumber(currentCustomerStatement.finalBalanceIRR)} ریال (${
                            currentCustomerStatement.finalStatusIRR === 'بدهکار'
                              ? 'بدهکار به ما'
                              : 'طلبکار از ما'
                          })`}
                    </span>
                    {Object.entries(currentCustomerStatement.currencyBreakdown).map(([cur, b]) =>
                      b.balanceForeign > 0 ? (
                        <span
                          key={cur}
                          className="px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-extrabold text-[11px]"
                        >
                          مانده ارزی {cur}: {formatCurrencyAmount(b.balanceForeign, cur)} {cur} ({b.status})
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* مقدار ارز، نرخ معامله و جمع ریالی */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    مقدار ارز ({currency}):
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={foreignAmount ? formatNumber(foreignAmount) : ''}
                    onChange={(e) => setForeignAmount(parseFormattedNumber(e.target.value))}
                    placeholder={`مقدار ${currency} (مثلاً ۱,۰۰۰)`}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-700">
                      نرخ هر ۱ {currency} (به ریال):
                    </label>
                    {getSuggestedRateForCurrency(currency) > 0 && (
                      <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        آخرین فی: {formatNumber(getSuggestedRateForCurrency(currency))}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dealRate ? formatNumber(dealRate) : ''}
                    onChange={(e) => setDealRate(parseFormattedNumber(e.target.value))}
                    placeholder="نرخ معامله (ریال)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    کارمزد انتقال (ریال - اختیاری):
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={commissionIRR ? formatNumber(commissionIRR) : '0'}
                    onChange={(e) => setCommissionIRR(parseFormattedNumber(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col justify-center bg-teal-50 border border-teal-200 rounded-xl px-3.5 py-2.5">
                  <span className="text-[11px] text-teal-800 font-bold">جمع کل معامله به ریال:</span>
                  <span className="text-base sm:text-lg font-extrabold text-teal-950 font-mono-num mt-0.5">
                    {formatNumber(totalIRR)} ریال
                  </span>
                </div>
              </div>

              {/* وضعیت تحویل خودِ ارز (همزمان یا ثبت در حساب ارزی شخص برای تحویل در روزهای بعد) */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>وضعیت تحویل خودِ ارز ({currency}):</span>
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    اگر ارز را فردا یا در چند مرحله تحویل می‌گیرید/می‌دهید، گزینه دوم را بزنید تا در صورتحساب ارزی شخص بماند و هر بار در «تحویل ارز» یا «دریافت/پرداخت» ثبت کنید.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-amber-300 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsDeferredDelivery(false)}
                    className={`px-3 py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      !isDeferredDelivery
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🟢 تحویل همزمان ارز در همین لحظه
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeferredDelivery(true)}
                    className={`px-3 py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      isDeferredDelivery
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    ⏳ ارز در حساب شخص بماند (تحویل در مراحل بعد)
                  </button>
                </div>
              </div>

              {/* انتخاب سریع نحوه تسویه ریالی معامله */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-extrabold text-slate-800">
                    پول ریالی این معامله چطور تسویه می‌شود؟
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setPayments([])}
                      className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        payments.length === 0
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-white text-amber-800 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      🟡 نسیه ریالی (بماند در حساب شخص)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const defaultBank = banks.find((b) => b.currency === 'IRR') || banks[0];
                        if (!defaultBank) return;
                        setPayments([
                          {
                            id: `spl-full-${Date.now()}`,
                            bankId: defaultBank.id,
                            bankName: defaultBank.bankName,
                            currency: 'IRR',
                            amountForeign: totalIRR,
                            exchangeRate: 1,
                            amountIRR: totalIRR,
                            trackingNumber: '',
                            description: `تسویه ریالی معامله ${currency}`,
                          },
                        ]);
                      }}
                      className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        payments.length > 0 && paidSumIRR >= totalIRR
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-emerald-800 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      🟢 تسویه نقدی/بانکی ریالی همین الان
                    </button>
                  </div>
                </div>
              </div>

              {/* بخش دریافت و پرداخت ترکیبی چند بانکی برای تسویه ریالی */}
              <MultiPaymentSplitsEditor
                title={
                  dealType === 'sell'
                    ? 'مبلغ دریافتی از مشتری بابت این فروش ارز (اختیاری)'
                    : 'مبلغ پرداختی شما به مشتری بابت این خرید ارز (اختیاری)'
                }
                subtitle="اگر بخشی یا کل وجه ریالی الان پرداخت شده است، بانک/صندوق را انتخاب کنید."
                totalTargetIRR={totalIRR}
                splits={payments}
                onChange={setPayments}
                banks={banks}
                currencies={currencies}
                mode={dealType === 'sell' ? 'receipt' : 'payment'}
                contactName={selectedContact?.name}
              />

              {/* یک فیلد واحد برای شماره فیش/حواله و توضیحات کامل */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-extrabold text-teal-800 mb-1">
                    شماره فیش / کد رهگیری معامله (در صورتحساب می‌آید):
                  </label>
                  <input
                    type="text"
                    value={dealTrackingNumber}
                    onChange={(e) => setDealTrackingNumber(e.target.value)}
                    placeholder={`پیش‌فرض: FX-${getCurrentJalaliYear()}-${1001 + fxDeals.length}`}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono-num text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    توضیحات معامله (در صورتحساب شخص نمایش داده می‌شود):
                  </label>
                  <input
                    type="text"
                    value={dealNotes}
                    onChange={(e) => setDealNotes(e.target.value)}
                    placeholder="توضیحات اختیاری..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* باکس خلاصه قبل از ثبت */}
              <div className="bg-blue-50/70 border-2 border-blue-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>خلاصه ثبت در صورتحساب «{selectedContact?.name || 'مشتری'}»:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                    <span className="text-[11px] text-slate-500 block">وضعیت تحویل ارز ({currency}):</span>
                    <strong className="font-mono-num text-teal-900 font-extrabold">
                      {isDeferredDelivery
                        ? `${formatNumber(foreignAmount)} ${currency} در حساب ارزی شخص می‌ماند`
                        : `${formatNumber(foreignAmount)} ${currency} تحویل صندوق شد (تسویه ارزی)`}
                    </strong>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                    <span className="text-[11px] text-slate-500 block">مانده ریالی این فاکتور:</span>
                    <strong className="font-mono-num text-amber-800 font-extrabold">
                      {formatNumber(remainingIRR)} ریال
                    </strong>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                    <span className="text-[11px] text-slate-500 block">
                      مانده نهایی ریالی {selectedContact?.name || 'مشتری'}:
                    </span>
                    <strong className="font-mono-num text-slate-900 font-extrabold block">
                      {formatNumber(projectedBalanceInfo.absBalance)} ریال
                    </strong>
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${projectedBalanceInfo.badgeColor}`}
                    >
                      {projectedBalanceInfo.statusLabel}
                    </span>
                  </div>
                </div>
              </div>

              {contacts.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>لطفاً ابتدا با دکمه «+ شخص جدید» در بالای فرم، نام طرف حساب را وارد کنید.</span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                {editingDealId ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs sm:text-sm cursor-pointer transition"
                    >
                      انصراف از ویرایش
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedContact || foreignAmount <= 0 || dealRate <= 0}
                      className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50 transition"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ذخیره تغییرات فاکتور معامله
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!selectedContact || foreignAmount <= 0 || dealRate <= 0}
                    className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50 ${
                      dealType === 'buy'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {dealType === 'buy'
                      ? `ثبت قطعی فاکتور خرید ${formatNumber(foreignAmount)} ${currency}`
                      : `ثبت قطعی فاکتور فروش ${formatNumber(foreignAmount)} ${currency}`}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* تاریخچه معاملات ارزی ثبت شده با جستجو، ویرایش و حذف */}
          <div
            id="fx-deals-print"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-teal-600 shrink-0" />
                  فهرست فاکتورهای خرید و فروش ارز ({formatNumber(fxDeals.length)})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  امکان جستجوی فوری بر اساس شماره فاکتور/فیش، ویرایش مبالغ و حذف فاکتور
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab('delivery_statement')}
                  className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-xs font-extrabold text-teal-900 border border-teal-300 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4 text-teal-600" />
                  ثبت تحویل ارز (دریافت/پرداخت ارزی اشخاص)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportOrPrintFXDealsSummaryPDF(
                      filteredDeals,
                      companyName || 'صرافی آرکا',
                      fiscalYear || '۱۴۰۴',
                      'print'
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-teal-600" />
                  چاپ لیست
                </button>
              </div>
            </div>

            {/* نوار جستجوی پیشرفته معاملات */}
            <div className="relative mb-3.5">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={dealSearchQuery}
                onChange={(e) => setDealSearchQuery(e.target.value)}
                placeholder="🔍 جستجوی شماره فاکتور (مثلاً FX-1001)، کد پیگیری، نام شخص یا نوع ارز..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition"
              />
              {dealSearchQuery && (
                <button
                  type="button"
                  onClick={() => setDealSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {filteredDeals.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                  {dealSearchQuery.trim()
                    ? `فاکتوری منطبق با عبارت «${dealSearchQuery}» پیدا نشد.`
                    : 'هنوز هیچ فاکتور خرید یا فروش ارزی ثبت نشده است.'}
                </div>
              ) : (
                filteredDeals.map((d) => {
                  const paid =
                    d.paidAmountIRR ?? (d.settlementMethod !== 'credit_account' ? d.totalIRR : 0);
                  const rem = d.remainingAmountIRR ?? Math.max(0, d.totalIRR - paid);
                  const isDeferred = (d.deliveredForeignAmount ?? d.foreignAmount) === 0;

                  return (
                    <div
                      key={d.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 hover:border-teal-300 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-num font-extrabold text-teal-800 text-xs sm:text-sm bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                            {d.dealNumber}
                          </span>
                          {d.trackingNumber && d.trackingNumber !== d.dealNumber && (
                            <span className="font-mono-num font-bold text-slate-700 text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                              فیش/پیگیری: {d.trackingNumber}
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                              d.type === 'buy'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {d.type === 'buy' ? 'فاکتور خرید ارز' : 'فاکتور فروش ارز'}
                          </span>
                          <span className="font-extrabold text-slate-900 text-xs sm:text-sm font-mono-num">
                            {formatNumber(d.foreignAmount)} {d.currency}
                          </span>
                          <span className="text-xs text-slate-600 font-mono-num">
                            (نرخ: {formatNumber(d.exchangeRate)} ریال)
                          </span>
                          <span className="text-xs text-slate-900 font-extrabold bg-white px-2 py-0.5 rounded border border-slate-200">
                            👤 {d.contactName}
                          </span>
                          <span className="text-xs text-slate-500 font-mono-num">{d.date}</span>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono-num">
                            جمع: {formatNumber(d.totalIRR)} ریال
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setPreviewDeal(d)}
                              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>رسید</span>
                            </button>
                            {onUpdateDeal && (
                              <button
                                type="button"
                                onClick={() => handleStartEditDeal(d)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>ویرایش</span>
                              </button>
                            )}
                            {onDeleteDeal && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `آیا از حذف فاکتور ${d.dealNumber} (طرف حساب: ${d.contactName}) و سند مالی آن اطمینان دارید؟`
                                    )
                                  ) {
                                    onDeleteDeal(d.id);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200">
                        <div className="flex flex-wrap items-center gap-2">
                          <Landmark className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>
                            تسویه‌شده ریالی:{' '}
                            <strong className="text-emerald-700 font-mono-num">
                              {formatNumber(paid)} ریال
                            </strong>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span>
                            مانده ریالی:{' '}
                            <strong className="text-amber-800 font-mono-num">
                              {formatNumber(rem)} ریال
                            </strong>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span>
                            وضعیت ارز:{' '}
                            <strong className={isDeferred ? 'text-amber-700' : 'text-emerald-700'}>
                              {isDeferred
                                ? `در حساب ارزی ${d.contactName} (تحویل از بخش تحویل ارز)`
                                : 'تحویل همزمان به صندوق'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* تب دوم: تحویل ارز اشخاص (دریافت و پرداخت ارزی مثل دریافت و پرداخت ریالی) */}
      {/* ===================================================================== */}
      {subTab === 'delivery_statement' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
            {dlvEditingVoucherId && (
              <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-center justify-between text-xs text-amber-950 font-bold">
                <span className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-700" />
                  در حال ویرایش سند تحویل ارز شماره: #
                  {vouchers.find((v) => v.id === dlvEditingVoucherId)?.voucherNumber}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDlvEditingVoucherId(null);
                    setDlvAmount(0);
                    setDlvTracking('');
                    setDlvNotes('');
                  }}
                  className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-rose-700 font-extrabold cursor-pointer"
                >
                  انصراف از ویرایش
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-teal-600 shrink-0" />
                  تحویل ارز اشخاص (دریافت و پرداخت مستقیم ارزی)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  شخص را انتخاب کنید و هر مقدار ارز (کمتر، برابر یا بیشتر از مانده) که تحویل گرفته‌اید یا تحویل داده‌اید را ثبت کنید تا مستقیماً در صورتحساب ارزی آن شخص بنشیند.
                </p>
              </div>

              <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto gap-1">
                <button
                  type="button"
                  onClick={() => setDlvDirection('receive')}
                  className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dlvDirection === 'receive'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 shrink-0" />
                  <span>۱. دریافت ارز از شخص (ورود به صندوق)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDlvDirection('pay')}
                  className={`px-4 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dlvDirection === 'pay'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                  <span>۲. پرداخت / تحویل ارز به شخص (خروج از صندوق)</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveCurrencyDelivery} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* انتخاب شخص */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-800">
                      {dlvDirection === 'receive'
                        ? 'دریافت ارز از کدام شخص؟'
                        : 'تحویل / پرداخت ارز به کدام شخص؟'}
                    </label>
                    {onAddContact && (
                      <button
                        type="button"
                        onClick={() => setShowQuickContact(!showQuickContact)}
                        className="text-[11px] text-teal-700 font-extrabold cursor-pointer"
                      >
                        + شخص جدید
                      </button>
                    )}
                  </div>
                  <select
                    value={dlvSelectedContact?.id || ''}
                    onChange={(e) => setDlvContactId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* انتخاب نوع ارز */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    نوع ارز:
                  </label>
                  <select
                    value={dlvCurrency}
                    onChange={(e) => {
                      const c = e.target.value as CurrencyCode;
                      setDlvCurrency(c);
                      const match = banks.find((b) => b.currency === c);
                      if (match) setDlvBankId(match.id);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {foreignCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* مبلغ ارز */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    مبلغ ارز ({dlvCurrency}):
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={dlvAmount ? formatNumber(dlvAmount) : ''}
                    onChange={(e) => setDlvAmount(parseFormattedNumber(e.target.value))}
                    placeholder={`مثلاً 500 ${dlvCurrency}`}
                    className="w-full bg-white border-2 border-teal-500 rounded-xl px-3 py-2 text-sm font-extrabold font-mono-num text-slate-900 focus:outline-none"
                  />
                </div>

                {/* صندوق یا بانک ارزی */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    {dlvDirection === 'receive' ? 'صندوق/بانک مقصد:' : 'صندوق/بانک مبدأ:'}
                  </label>
                  <select
                    value={dlvBankId}
                    onChange={(e) => setDlvBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {banks.length === 0 ? (
                      <option value="">صندوق ارزی ({dlvCurrency})</option>
                    ) : (
                      banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                          {b.bankName} ({b.currency})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* نمایش وضعیت ارزی فعلی شخص انتخاب‌شده */}
              {dlvSelectedContact && dlvContactStatement && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700">
                    مانده‌های فعلی در صورتحساب «{dlvSelectedContact.name}»:
                  </span>
                  <div className="flex flex-wrap items-center gap-2 font-mono-num">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-800">
                      مانده ریالی:{' '}
                      {dlvContactStatement.finalStatusIRR === 'تسویه'
                        ? '۰ ریال (تسویه)'
                        : `${formatNumber(dlvContactStatement.finalBalanceIRR)} ریال (${dlvContactStatement.finalStatusIRR})`}
                    </span>
                    {Object.entries(dlvContactStatement.currencyBreakdown)
                      .filter(([c]) => c !== 'IRR')
                      .map(([cur, b]) => (
                        <span
                          key={cur}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 font-extrabold text-teal-900"
                        >
                          مانده {cur}: {formatCurrencyAmount(b.balanceForeign, cur)} {cur} (
                          {b.status === 'بدهکار'
                            ? 'بدهکار به ما — باید تحویل دهد'
                            : b.status === 'بستانکار'
                            ? 'طلبکار از ما — باید تحویل دهیم'
                            : 'تسویه'}
                          )
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* تاریخ، شماره فیش واحد و توضیحات */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 items-end">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">تاریخ:</label>
                  <input
                    type="text"
                    value={dlvDate}
                    onChange={(e) => setDlvDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono-num font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-teal-800 mb-1">
                    شماره فیش / کد رهگیری:
                  </label>
                  <input
                    type="text"
                    value={dlvTracking}
                    onChange={(e) => setDlvTracking(e.target.value)}
                    placeholder="مثلاً: DLV-201"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono-num font-bold text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    توضیحات (در صورتحساب شخص ثبت می‌شود):
                  </label>
                  <input
                    type="text"
                    value={dlvNotes}
                    onChange={(e) => setDlvNotes(e.target.value)}
                    placeholder="مثلاً: تحویل مرحله اول ارز به نماینده شخص..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!dlvSelectedContact || dlvAmount <= 0}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 text-white shadow-md cursor-pointer disabled:opacity-50 transition ${
                    dlvDirection === 'receive'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {dlvEditingVoucherId
                    ? 'ذخیره تغییرات سند تحویل ارز'
                    : dlvDirection === 'receive'
                    ? `ثبت دریافت ${formatNumber(dlvAmount)} ${dlvCurrency} از ${
                        dlvSelectedContact?.name || 'شخص'
                      }`
                    : `ثبت تحویل / پرداخت ${formatNumber(dlvAmount)} ${dlvCurrency} به ${
                        dlvSelectedContact?.name || 'شخص'
                      }`}
                </button>
              </div>
            </form>
          </div>

          {/* فهرست تحویل ارزهای ثبت شده با جستجو، ویرایش و حذف */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-teal-600" />
                تاریخچه اسناد تحویل ارز — دریافت و پرداخت‌های ارزی ({formatNumber(currencyDeliveryVouchers.length)})
              </h3>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={dlvSearchQuery}
                  onChange={(e) => setDlvSearchQuery(e.target.value)}
                  placeholder="🔍 جستجوی نام شخص، شماره فیش، ارز یا تاریخ..."
                  className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-none font-bold"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {currencyDeliveryVouchers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  هنوز هیچ سند تحویل ارزی ثبت نشده است.
                </div>
              ) : (
                currencyDeliveryVouchers.map((v) => {
                  const bankLine = v.lines.find((l) => l.bankId) || v.lines[0];
                  const personLine = v.lines.find((l) => l.contactId) || v.lines[1];
                  const isRec = (bankLine?.debitForeign || 0) > 0;
                  const amt = bankLine?.debitForeign || bankLine?.creditForeign || 0;
                  const cur = bankLine?.currency || 'USD';

                  return (
                    <div
                      key={v.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-mono-num font-extrabold">
                            سند #{v.voucherNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                              isRec
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isRec ? 'دریافت ارز از شخص' : 'تحویل / پرداخت ارز به شخص'}
                          </span>
                          <span className="font-extrabold text-slate-900">
                            👤 {personLine?.contactName || 'شخص'}
                          </span>
                          <span className="font-mono-num font-extrabold text-teal-900 text-sm">
                            {formatCurrencyAmount(amt, cur)} {cur}
                          </span>
                          {v.referenceNumber && (
                            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono-num text-[11px] text-slate-700 flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {v.referenceNumber}
                            </span>
                          )}
                          <span className="font-mono-num text-slate-500">{v.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-600">{v.description}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onUpdateVoucher && (
                          <button
                            type="button"
                            onClick={() => handleStartEditDeliveryVoucher(v)}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>ویرایش</span>
                          </button>
                        )}
                        {onDeleteVoucher && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `آیا از حذف سند تحویل ارز شماره #${v.voucherNumber} اطمینان دارید؟`
                                )
                              ) {
                                onDeleteVoucher(v.id);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال مشاهده و چاپ رسید رسمی معامله ارز */}
      {previewDeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold text-teal-700 block">{companyName}</span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  رسید رسمی فاکتور {previewDeal.type === 'buy' ? 'خرید ارز' : 'فروش ارز'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDeal(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">شماره فاکتور:</span>
                <strong className="font-mono-num text-sm text-teal-800 font-extrabold">
                  {previewDeal.dealNumber}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">تاریخ ثبت:</span>
                <strong className="font-mono-num text-sm text-slate-900 font-extrabold">
                  {previewDeal.date}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">نام طرف حساب / مشتری:</span>
                <strong className="text-sm text-slate-900 font-extrabold">
                  {previewDeal.contactName}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">نوع عملیات:</span>
                <strong
                  className={`text-sm font-extrabold ${
                    previewDeal.type === 'buy' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {previewDeal.type === 'buy' ? 'خرید ارز توسط صرافی' : 'فروش ارز به مشتری'}
                </strong>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <div className="p-4 space-y-2.5 divide-y divide-slate-100">
                <div className="flex justify-between items-center pb-2">
                  <span className="text-slate-600 font-medium">مقدار کل ارز ({previewDeal.currency}):</span>
                  <strong className="font-mono-num text-sm font-extrabold text-slate-900">
                    {formatNumber(previewDeal.foreignAmount)} {previewDeal.currency}
                  </strong>
                </div>
                <div className="flex justify-between items-center pt-2 pb-2">
                  <span className="text-slate-600 font-medium">نرخ توافقی هر واحد:</span>
                  <strong className="font-mono-num text-sm font-extrabold text-slate-900">
                    {formatNumber(previewDeal.exchangeRate)} ریال
                  </strong>
                </div>
                <div className="flex justify-between items-center pt-2 bg-teal-50/60 -mx-4 px-4 py-2.5">
                  <span className="font-extrabold text-teal-950">مبلغ کل معامله به ریال:</span>
                  <strong className="font-mono-num text-base font-extrabold text-teal-900">
                    {formatNumber(previewDeal.totalIRR)} ریال
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() =>
                  previewDeal &&
                  exportOrPrintSingleDealReceiptPDF(
                    previewDeal,
                    companyName || 'صرافی آرکا',
                    'print'
                  )
                }
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                چاپ / ذخیره PDF رسید
              </button>
              <button
                type="button"
                onClick={() => setPreviewDeal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
