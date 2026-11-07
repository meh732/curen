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
} from '../types/accounting';
import {
  formatNumber,
  formatCurrencyAmount,
  parseFormattedNumber,
  buildPersonStatement,
} from '../utils/accountingEngine';
import { exportOrPrintCurrencyDeliveryStatementPDF } from '../utils/pdfPrintReportService';
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
  PlusCircle,
  FileDown,
  Clock,
  Search,
  Edit3,
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
}

export const FXTradingDeskView: React.FC<FXTradingDeskViewProps> = ({
  fxDeals,
  currencies,
  contacts,
  banks,
  vouchers = [],
  companyName = 'آرکا (ARKA) — صرافی و خدمات ارزی',
  fiscalYear = 'سال مالی ۱۴۰۴',
  onExecuteDeal,
  onUpdateDeal,
  onRecordDealDelivery,
  onAddContact,
  onDeleteDeal,
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
  const [dealDate, setDealDate] = useState<string>('1404/08/12');
  const [dealNotes, setDealNotes] = useState<string>('');
  const [dealTrackingNumber, setDealTrackingNumber] = useState<string>('');

  // وضعیت تحویل ارز در لحظه ثبت معامله (تحویل یکجا یا تحویل مرحله‌ای)
  const [isStagedDelivery, setIsStagedDelivery] = useState<boolean>(false);
  const [initialDeliveredForeign, setInitialDeliveredForeign] = useState<number>(0);
  const [initialDeliveryTracking, setInitialDeliveryTracking] = useState<string>('');
  const [initialDeliveryNotes, setInitialDeliveryNotes] = useState<string>('');

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

  // مودال ثبت تحویل مرحله‌ای جدید برای یک معامله باز
  const [deliveryModalDealId, setDeliveryModalDealId] = useState<string | null>(null);
  const [stageAmountForeign, setStageAmountForeign] = useState<number>(0);
  const [stageDate, setStageDate] = useState<string>('1404/08/12');
  const [stageVaultBankId, setStageVaultBankId] = useState<string>('');
  const [stageTrackingNumber, setStageTrackingNumber] = useState<string>('');
  const [stageNotes, setStageNotes] = useState<string>('');
  const [deliverySuccessToast, setDeliverySuccessToast] = useState<string | null>(null);

  // فیلتر مشتری در تب صورتحساب تحویل ارز
  const [deliveryFilterContactId, setDeliveryFilterContactId] = useState<string>('ALL');

  // جستجوی شماره معامله، فیش، نام شخص یا ارز در فهرست معاملات
  const [dealSearchQuery, setDealSearchQuery] = useState<string>('');

  // وضعیت ویرایش معامله
  const [editingDealId, setEditingDealId] = useState<string | null>(null);

  const activeDeliveryDeal = useMemo(
    () => fxDeals.find((d) => d.id === deliveryModalDealId) || null,
    [fxDeals, deliveryModalDealId]
  );

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
    setIsStagedDelivery(d.deliveryStatus === 'partial' || (d.remainingForeignDelivery ?? 0) > 0);
    setInitialDeliveredForeign(d.deliveredForeignAmount ?? d.foreignAmount);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingDealId(null);
    setForeignAmount(0);
    setInitialDeliveredForeign(0);
    setDealNotes('');
    setDealTrackingNumber('');
    setIsStagedDelivery(false);
    setPayments([]);
  };

  const handleCurrencyChange = (code: CurrencyCode) => {
    setCurrency(code);
    const suggested = getSuggestedRateForCurrency(code);
    setDealRate(suggested);
    const vaultForCur = banks.find((b) => b.currency === code);
    if (vaultForCur) setTargetVaultBankId(vaultForCur.id);
  };

  const handleForeignAmountChange = (val: number) => {
    setForeignAmount(val);
    if (!isStagedDelivery) {
      setInitialDeliveredForeign(val);
    } else if (initialDeliveredForeign > val) {
      setInitialDeliveredForeign(val);
    }
  };

  const baseTotalIRR = Math.round(foreignAmount * dealRate);
  const totalIRR =
    dealType === 'buy'
      ? baseTotalIRR + commissionIRR
      : Math.max(0, baseTotalIRR - commissionIRR);

  const effectiveDeliveredNow = isStagedDelivery
    ? Math.min(foreignAmount, Math.max(0, initialDeliveredForeign))
    : foreignAmount;
  const remainingUndeliveredNow = Math.max(
    0,
    Number((foreignAmount - effectiveDeliveredNow).toFixed(2))
  );

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
    const dealNum = `FX-1404-${nextDealSeq}`;
    const trkMain = dealTrackingNumber.trim() || dealNum;
    const vaultBank = banks.find((b) => b.id === targetVaultBankId);

    const deliverySplits: FXDeliverySplit[] = [];
    if (effectiveDeliveredNow > 0) {
      deliverySplits.push({
        id: `dlv-${Date.now()}-1`,
        date: dealDate || '1404/08/12',
        amountForeign: effectiveDeliveredNow,
        vaultBankId: targetVaultBankId,
        vaultBankName: vaultBank?.bankName || `خزانه ارزی (${currency})`,
        trackingNumber: initialDeliveryTracking.trim() || `${trkMain}-DLV1`,
        notes:
          initialDeliveryNotes.trim() ||
          (remainingUndeliveredNow > 0
            ? `تحویل مرحله اول: ${formatNumber(effectiveDeliveredNow)} ${currency} تحویل شد و ${formatNumber(
                remainingUndeliveredNow
              )} ${currency} باقی ماند.`
            : `تحویل کامل یکجا (${formatNumber(effectiveDeliveredNow)} ${currency})`),
      });
    }

    const deliveryStatus: FXDeal['deliveryStatus'] =
      remainingUndeliveredNow === 0
        ? 'delivered'
        : effectiveDeliveredNow > 0
        ? 'partial'
        : 'pending';

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
          deliverySplits:
            existing.deliverySplits && existing.deliverySplits.length > 0
              ? existing.deliverySplits
              : deliverySplits,
          trackingNumber: trkMain,
          notes: dealNotes.trim() || undefined,
        };

        onUpdateDeal(updatedDeal);
        setEditingDealId(null);
        setLastCreatedDeal(updatedDeal);
        setPayments([]);
        setDealNotes('');
        setDealTrackingNumber('');
        setIsStagedDelivery(false);
        setForeignAmount(0);
        setInitialDeliveredForeign(0);
        setInitialDeliveryTracking('');
        setInitialDeliveryNotes('');
        return;
      }
    }

    const newDeal: FXDeal = {
      id: `fx-${Date.now()}`,
      dealNumber: dealNum,
      date: dealDate || '1404/08/12',
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
      deliverySplits,
      trackingNumber: trkMain,
      linkedVoucherId: `vch-fx-${Date.now()}`,
      notes: dealNotes.trim() || undefined,
    };

    onExecuteDeal(newDeal);
    setLastCreatedDeal(newDeal);
    setPayments([]);
    setDealNotes('');
    setDealTrackingNumber('');
    setIsStagedDelivery(false);
    setForeignAmount(0);
    setInitialDeliveredForeign(0);
    setInitialDeliveryTracking('');
    setInitialDeliveryNotes('');
  };

  const openDeliveryModal = (deal: FXDeal) => {
    const delivered = deal.deliveredForeignAmount ?? deal.foreignAmount;
    const rem = deal.remainingForeignDelivery ?? Math.max(0, Number((deal.foreignAmount - delivered).toFixed(2)));
    setDeliveryModalDealId(deal.id);
    setStageAmountForeign(rem > 0 ? rem : 0);
    setStageDate('1404/08/12');
    const matchingVault =
      banks.find((b) => b.id === deal.targetForeignBankId) ||
      banks.find((b) => b.currency === deal.currency) ||
      banks[0];
    setStageVaultBankId(matchingVault?.id || '');
    setStageTrackingNumber(`${deal.dealNumber}-DLV${(deal.deliverySplits?.length || 1) + 1}`);
    setStageNotes('');
  };

  const handleSaveDeliveryStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeliveryDeal || !onRecordDealDelivery || stageAmountForeign <= 0) return;

    const vault = banks.find((b) => b.id === stageVaultBankId);
    const split: FXDeliverySplit = {
      id: `dlv-${Date.now()}`,
      date: stageDate || '1404/08/12',
      amountForeign: stageAmountForeign,
      vaultBankId: stageVaultBankId,
      vaultBankName: vault?.bankName || `خزانه ارزی (${activeDeliveryDeal.currency})`,
      trackingNumber:
        stageTrackingNumber.trim() ||
        `${activeDeliveryDeal.dealNumber}-DLV${(activeDeliveryDeal.deliverySplits?.length || 1) + 1}`,
      notes:
        stageNotes.trim() ||
        `تحویل مرحله‌ای ${formatNumber(stageAmountForeign)} ${activeDeliveryDeal.currency} بابت معامله ${
          activeDeliveryDeal.dealNumber
        }`,
    };

    onRecordDealDelivery(activeDeliveryDeal.id, split);
    setDeliverySuccessToast(
      `مرحله تحویل جدید به مقدار ${formatNumber(stageAmountForeign)} ${
        activeDeliveryDeal.currency
      } برای معامله «${activeDeliveryDeal.dealNumber}» (${activeDeliveryDeal.contactName}) ثبت شد.`
    );
    setDeliveryModalDealId(null);
  };

  // محاسبه خلاصه تحویل ارز برای تب دوم (صورتحساب تحویل ارز مشتریان)
  const filteredDeliveryDeals = useMemo(() => {
    if (deliveryFilterContactId === 'ALL') return fxDeals;
    return fxDeals.filter((d) => d.contactId === deliveryFilterContactId);
  }, [fxDeals, deliveryFilterContactId]);

  const deliveryCurrencySummary = useMemo(() => {
    const map: Record<
      string,
      {
        totalBought: number;
        deliveredBought: number;
        undeliveredBought: number; // ارزی که خریدیم ولی هنوز از مشتری تحویل نگرفتیم (مشتری باید به ما تحویل دهد)
        totalSold: number;
        deliveredSold: number;
        undeliveredSold: number; // ارزی که فروختیم ولی هنوز به مشتری تحویل ندادیم (ما باید به مشتری تحویل دهیم)
      }
    > = {};

    filteredDeliveryDeals.forEach((d) => {
      const cur = d.currency;
      if (!map[cur]) {
        map[cur] = {
          totalBought: 0,
          deliveredBought: 0,
          undeliveredBought: 0,
          totalSold: 0,
          deliveredSold: 0,
          undeliveredSold: 0,
        };
      }
      const delivered = d.deliveredForeignAmount ?? d.foreignAmount;
      const rem =
        d.remainingForeignDelivery ??
        Math.max(0, Number((d.foreignAmount - delivered).toFixed(2)));

      if (d.type === 'buy') {
        map[cur].totalBought = Number((map[cur].totalBought + d.foreignAmount).toFixed(2));
        map[cur].deliveredBought = Number((map[cur].deliveredBought + delivered).toFixed(2));
        map[cur].undeliveredBought = Number((map[cur].undeliveredBought + rem).toFixed(2));
      } else {
        map[cur].totalSold = Number((map[cur].totalSold + d.foreignAmount).toFixed(2));
        map[cur].deliveredSold = Number((map[cur].deliveredSold + delivered).toFixed(2));
        map[cur].undeliveredSold = Number((map[cur].undeliveredSold + rem).toFixed(2));
      }
    });

    return map;
  }, [filteredDeliveryDeals]);

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* نوار انتخاب بخش: ثبت معامله ارز یا صورتحساب تحویل مرحله‌ای ارز */}
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
            <span>۱. ثبت خرید و فروش ارز + فهرست معاملات</span>
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
            <span>۲. تحویل مرحله‌ای ارز و صورتحساب تحویل ارز مشتری</span>
          </button>
        </div>
      </div>

      {deliverySuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deliverySuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeliverySuccessToast(null)}
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
                        معامله {lastCreatedDeal.type === 'buy' ? 'خرید ارز' : 'فروش ارز'} با موفقیت ثبت شد!
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 font-mono-num font-extrabold text-xs text-emerald-900">
                        شماره رسید: {lastCreatedDeal.dealNumber}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5 font-medium">
                      حساب <strong>{lastCreatedDeal.contactName}</strong> و وضعیت تحویل ارز به صورت خودکار بروزرسانی شد.
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white p-3 rounded-xl border border-emerald-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">مشتری / طرف حساب:</span>
                  <strong className="text-slate-900 font-extrabold">{lastCreatedDeal.contactName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">مقدار کل معامله:</span>
                  <strong className="text-slate-900 font-mono-num font-extrabold">
                    {formatNumber(lastCreatedDeal.foreignAmount)} {lastCreatedDeal.currency} (نرخ:{' '}
                    {formatNumber(lastCreatedDeal.exchangeRate)})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">وضعیت تحویل ارز:</span>
                  <strong className="text-teal-800 font-mono-num font-extrabold">
                    تحویل‌شده: {formatNumber(lastCreatedDeal.deliveredForeignAmount ?? lastCreatedDeal.foreignAmount)}{' '}
                    {lastCreatedDeal.currency} | مانده تحویل:{' '}
                    {formatNumber(lastCreatedDeal.remainingForeignDelivery ?? 0)} {lastCreatedDeal.currency}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">مانده ریالی در حساب شخص:</span>
                  <strong className="text-amber-800 font-mono-num font-extrabold">
                    {formatNumber(lastCreatedDeal.remainingAmountIRR || 0)} ریال
                  </strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {(lastCreatedDeal.remainingForeignDelivery ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => openDeliveryModal(lastCreatedDeal)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4" />
                    ثبت مرحله بعدی تحویل ارز ({formatNumber(lastCreatedDeal.remainingForeignDelivery || 0)}{' '}
                    {lastCreatedDeal.currency})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewDeal(lastCreatedDeal)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  مشاهده و چاپ رسید معامله ({lastCreatedDeal.dealNumber})
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
                    در حال ویرایش معامله{' '}
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
                  ثبت خرید و فروش ارز (با قابلیت تحویل یکجا یا چندمرحله‌ای ارز)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  اگر مثلاً ۷,۰۰۰ دلار می‌خرید یا می‌فروشید ولی در این لحظه فقط بخشی از آن را تحویل گرفته‌اید، گزینه «تحویل مرحله‌ای» را روشن کنید.
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
                  <span>۱. خرید ارز از مشتری</span>
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
                  <span>۲. فروش ارز به مشتری</span>
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
                      {dealType === 'buy' ? 'فروشنده ارز (مشتری / همکار):' : 'خریدار ارز (مشتری / شخص):'}
                    </label>
                    {onAddContact && (
                      <button
                        type="button"
                        onClick={() => setShowQuickContact(!showQuickContact)}
                        className="text-[11px] text-teal-700 hover:text-teal-800 font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + مشتری جدید
                      </button>
                    )}
                  </div>
                  {contacts.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowQuickContact(true)}
                      className="w-full py-2 px-3 rounded-xl border-2 border-dashed border-teal-400 bg-teal-50 text-teal-900 font-bold text-xs cursor-pointer"
                    >
                      + ابتدا نام اولین مشتری را ثبت کنید
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
                        {c.name} ({c.code}) — نرخ پیش‌فرض: {formatNumber(c.defaultRateToIRR)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* صندوق یا حساب ارزی */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {dealType === 'buy'
                      ? `ورود ${currency} به کدام صندوق/حساب؟`
                      : `خروج ${currency} از کدام صندوق/حساب؟`}
                  </label>
                  <select
                    value={targetVaultBankId}
                    onChange={(e) => setTargetVaultBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {banks.length === 0 ? (
                      <option value="">صندوق ارزی پیش‌فرض صرافی</option>
                    ) : (
                      banks
                        .filter((b) => b.currency === currency || b.currency !== 'IRR')
                        .map((b) => (
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
                    تاریخ معامله:
                  </label>
                  <input
                    type="text"
                    value={dealDate}
                    onChange={(e) => setDealDate(e.target.value)}
                    placeholder="1404/08/12"
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
                      placeholder="مثلاً: محمدی - بازار یا صرافی پارسیان"
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
                      ذخیره و انتخاب مشتری
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
                      وضعیت فعلی حساب <strong className="text-slate-900">{selectedContact.name}</strong> قبل از این معامله:
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
                        ? 'حساب ریالی تسویه کامل (۰ ریال)'
                        : `${formatNumber(currentCustomerStatement.finalBalanceIRR)} ریال (${
                            currentCustomerStatement.finalStatusIRR === 'بدهکار'
                              ? 'بدهکار به ما / طلب ما'
                              : 'طلبکار از ما / بدهی ما'
                          })`}
                    </span>
                    {Object.entries(currentCustomerStatement.currencyBreakdown).map(([cur, b]) =>
                      b.balanceForeign > 0 ? (
                        <span
                          key={cur}
                          className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-[11px]"
                        >
                          {formatCurrencyAmount(b.balanceForeign, cur)} {cur} ({b.status})
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
                    مقدار کل ارز مورد معامله ({currency}):
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={foreignAmount ? formatNumber(foreignAmount) : ''}
                    onChange={(e) => handleForeignAmountChange(parseFormattedNumber(e.target.value))}
                    placeholder={`مقدار ${currency} (مثلاً ۵,۰۰۰)`}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-700">
                      نرخ توافقی هر ۱ {currency} (به ریال):
                    </label>
                    {getSuggestedRateForCurrency(currency) > 0 && (
                      <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        پیشنهاد آخرین نرخ: {formatNumber(getSuggestedRateForCurrency(currency))}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dealRate ? formatNumber(dealRate) : ''}
                    onChange={(e) => setDealRate(parseFormattedNumber(e.target.value))}
                    placeholder={
                      getSuggestedRateForCurrency(currency) > 0
                        ? `مثلاً ${formatNumber(getSuggestedRateForCurrency(currency))}`
                        : 'نرخ معامله (ریال)'
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    کارمزد یا هزینه جانبی (ریال - اختیاری):
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

              {/* بخش جدید: وضعیت تحویل خودِ ارز (یکجا یا چند مرحله‌ای) */}
              <div className="bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-amber-950 flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        وضعیت تحویل خودِ ارز ({formatNumber(foreignAmount)} {currency}) در این لحظه:
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      مثلاً اگر ۷,۰۰۰ دلار معامله کرده‌اید اما الان فقط بخشی از آن را تحویل گرفته‌اید (یا هنوز تحویل نگرفته‌اید)، گزینه دوم را انتخاب کنید.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-amber-300">
                    <button
                      type="button"
                      onClick={() => {
                        setIsStagedDelivery(false);
                        setInitialDeliveredForeign(foreignAmount);
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        !isStagedDelivery
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      🟢 تحویل کامل یکجا ({formatNumber(foreignAmount)} {currency})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsStagedDelivery(true);
                        if (initialDeliveredForeign >= foreignAmount) {
                          setInitialDeliveredForeign(0);
                        }
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        isStagedDelivery
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      📦 تحویل مرحله‌ای / ناقص (چند مرحله)
                    </button>
                  </div>
                </div>

                {isStagedDelivery && (
                  <div className="bg-white border border-amber-300 rounded-xl p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-extrabold text-slate-800 mb-1">
                          مقدار {currency} تحویل‌شده در همین لحظه (مرحله ۱):
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={initialDeliveredForeign ? formatNumber(initialDeliveredForeign) : '0'}
                          onChange={(e) =>
                            setInitialDeliveredForeign(
                              Math.min(foreignAmount, Math.max(0, parseFormattedNumber(e.target.value)))
                            )
                          }
                          placeholder={`از ۰ تا ${formatNumber(foreignAmount)}`}
                          className="w-full bg-amber-50 border-2 border-amber-400 rounded-xl px-3 py-2 text-xs sm:text-sm font-extrabold font-mono-num text-slate-900 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          اگر هنوز هیچ ارزی تحویل نگرفته/نداده‌اید، عدد ۰ بگذارید.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          شماره پیگیری / فیش تحویل مرحله ۱:
                        </label>
                        <input
                          type="text"
                          value={initialDeliveryTracking}
                          onChange={(e) => setInitialDeliveryTracking(e.target.value)}
                          placeholder="مثلاً: DLV-7000-1"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono-num text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          توضیحات تحویل مرحله اول:
                        </label>
                        <input
                          type="text"
                          value={initialDeliveryNotes}
                          onChange={(e) => setInitialDeliveryNotes(e.target.value)}
                          placeholder="مثلاً: ۲۰۰۰ دلار نقدی تحویل شد، ۵۰۰۰ دلار فردا..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-100/70 border border-amber-300 rounded-xl px-3.5 py-2 text-xs">
                      <span className="font-bold text-amber-950">
                        تحویل‌شده در لحظه ثبت:{' '}
                        <strong className="font-mono-num text-emerald-800">
                          {formatNumber(effectiveDeliveredNow)} {currency}
                        </strong>
                      </span>
                      <span className="font-extrabold text-rose-800">
                        ⚠️ مانده ارز تحویل‌نشده (برای تحویل در مراحل بعدی):{' '}
                        <strong className="font-mono-num text-sm">
                          {formatNumber(remainingUndeliveredNow)} {currency}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
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
                      🟡 نسیه / دفتری (بماند در حساب شخص)
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
                            currency: defaultBank.currency,
                            amountForeign:
                              defaultBank.currency === 'IRR'
                                ? totalIRR
                                : Number((totalIRR / dealRate).toFixed(2)),
                            exchangeRate: defaultBank.currency === 'IRR' ? 1 : dealRate,
                            amountIRR: totalIRR,
                            trackingNumber: '',
                            description: `تسویه کامل معامله ${currency}`,
                          },
                        ]);
                      }}
                      className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        payments.length > 0 && paidSumIRR >= totalIRR
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-emerald-800 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      🟢 تسویه نقدی/بانکی کامل همین الان
                    </button>
                  </div>
                </div>
              </div>

              {/* بخش دریافت و پرداخت ترکیبی چند بانکی و چند صندوقی برای تسویه این معامله ارز */}
              <MultiPaymentSplitsEditor
                title={
                  dealType === 'sell'
                    ? 'مبلغ دریافتی از مشتری بابت این فروش ارز (اگر بخشی یا کل پول را الان داده است)'
                    : 'مبلغ پرداختی شما به مشتری بابت این خرید ارز (اگر بخشی یا کل پول را الان داده‌اید)'
                }
                subtitle="شماره پیگیری هر فیش و توضیحات آن را وارد کنید تا دقیقاً خط به خط در صورتحساب مشتری و جستجوی سراسری فیش‌ها ثبت شود."
                totalTargetIRR={totalIRR}
                splits={payments}
                onChange={setPayments}
                banks={banks}
                currencies={currencies}
                mode={dealType === 'sell' ? 'receipt' : 'payment'}
                contactName={selectedContact?.name}
              />

              {/* شماره پیگیری کلی معامله و توضیحات کامل */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-extrabold text-teal-800 mb-1">
                    شماره پیگیری / حواله معامله (در صورتحساب می‌آید):
                  </label>
                  <input
                    type="text"
                    value={dealTrackingNumber}
                    onChange={(e) => setDealTrackingNumber(e.target.value)}
                    placeholder={`پیش‌فرض: FX-1404-${1001 + fxDeals.length}`}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono-num text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    توضیحات کامل معامله (دقیقاً خط به خط در صورتحساب مشتری نمایش داده می‌شود):
                  </label>
                  <input
                    type="text"
                    value={dealNotes}
                    onChange={(e) => setDealNotes(e.target.value)}
                    placeholder="مثلاً: خرید ۷۰۰۰ دلار توافقی — تحویل طی دو مرحله در دفتر مرکزی..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* باکس خلاصه ضد اشتباه به زبان خودمانی قبل از ثبت */}
              <div className="bg-blue-50/70 border-2 border-blue-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>خلاصه ساده این معامله (قبل از ثبت بررسی کنید):</span>
                </div>

                <p className="text-xs text-slate-800 leading-relaxed">
                  شما در حال{' '}
                  <strong className={dealType === 'buy' ? 'text-emerald-800' : 'text-amber-800'}>
                    {dealType === 'buy' ? 'خرید' : 'فروش'} {formatNumber(foreignAmount)} {currency}
                  </strong>{' '}
                  با نرخ هر واحد <strong className="font-mono-num">{formatNumber(dealRate)} ریال</strong>{' '}
                  {dealType === 'buy' ? 'از' : 'به'}{' '}
                  <strong className="text-slate-950">{selectedContact?.name || 'مشتری'}</strong> هستید.
                  جمع کل معامله <strong className="font-mono-num">{formatNumber(totalIRR)} ریال</strong> است.
                  {remainingUndeliveredNow > 0 && (
                    <span className="text-amber-900 font-bold block mt-1">
                      📦 توجه تحویل مرحله‌ای: در این لحظه{' '}
                      <strong>
                        {formatNumber(effectiveDeliveredNow)} {currency}
                      </strong>{' '}
                      تحویل شده و{' '}
                      <strong className="text-rose-700">
                        {formatNumber(remainingUndeliveredNow)} {currency}
                      </strong>{' '}
                      به عنوان «مانده ارز تحویل‌نشده» در صورتحساب تحویل ارز مشتری ثبت می‌گردد.
                    </span>
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                    <span className="text-[11px] text-slate-500 block">
                      {dealType === 'sell' ? 'دریافتی ریالی فعلی شما:' : 'پرداختی ریالی فعلی شما:'}
                    </span>
                    <strong className="font-mono-num text-emerald-700 font-extrabold">
                      {formatNumber(paidSumIRR)} ریال
                    </strong>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                    <span className="text-[11px] text-slate-500 block">
                      مانده ریالی این معامله (نسیه):
                    </span>
                    <strong className="font-mono-num text-amber-800 font-extrabold">
                      {formatNumber(remainingIRR)} ریال
                    </strong>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-blue-200">
                    <span className="text-[11px] text-slate-500 block">
                      وضعیت نهایی ریالی {selectedContact?.name || 'مشتری'} بعد از ثبت:
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
                  <span>لطفاً ابتدا با دکمه «+ مشتری جدید» در بالای فرم، نام طرف حساب را وارد کنید.</span>
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
                      ذخیره تغییرات معامله
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
                      ? `ثبت قطعی خرید ${formatNumber(foreignAmount)} ${currency} و صدور رسید`
                      : `ثبت قطعی فروش ${formatNumber(foreignAmount)} ${currency} و صدور رسید`}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* تاریخچه معاملات ارزی ثبت شده */}
          <div
            id="fx-deals-print"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-teal-600 shrink-0" />
                  فهرست معاملات خرید و فروش ارز ({formatNumber(fxDeals.length)})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  برای معاملاتی که ارز آن‌ها در چند مرحله تحویل می‌شود، روی دکمه «ثبت تحویل مرحله‌ای ارز» کلیک کنید.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab('delivery_statement')}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-xs font-extrabold text-amber-900 border border-amber-300 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4 text-amber-600" />
                  مشاهده صورتحساب تحویل ارز مشتریان
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-teal-600" />
                  چاپ لیست
                </button>
              </div>
            </div>

            {/* نوار جستجوی پیشرفته معاملات بر اساس شماره معامله، کد رهگیری، مشتری و ارز */}
            <div className="relative mb-3.5">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={dealSearchQuery}
                onChange={(e) => setDealSearchQuery(e.target.value)}
                placeholder="🔍 جستجوی شماره معامله (مثلاً FX-1404-1002)، کد پیگیری، نام شخص یا نوع ارز..."
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
                    ? `معامله‌ای منطبق با عبارت «${dealSearchQuery}» پیدا نشد.`
                    : 'هنوز هیچ معامله خرید یا فروش ارزی ثبت نشده است.'}
                </div>
              ) : (
                filteredDeals.map((d) => {
                  const paid =
                    d.paidAmountIRR ?? (d.settlementMethod !== 'credit_account' ? d.totalIRR : 0);
                  const rem = d.remainingAmountIRR ?? Math.max(0, d.totalIRR - paid);
                  const deliveredFor = d.deliveredForeignAmount ?? d.foreignAmount;
                  const remFor =
                    d.remainingForeignDelivery ??
                    Math.max(0, Number((d.foreignAmount - deliveredFor).toFixed(2)));

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
                              پیگیری: {d.trackingNumber}
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                              d.type === 'buy'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {d.type === 'buy' ? 'خرید ارز از شخص' : 'فروش ارز به شخص'}
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
                            {remFor > 0 && onRecordDealDelivery && (
                              <button
                                type="button"
                                onClick={() => openDeliveryModal(d)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>
                                  ثبت تحویل مرحله‌ای ({formatNumber(remFor)} {d.currency} مانده)
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewDeal(d)}
                              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>مشاهده رسید</span>
                            </button>
                            {onUpdateDeal && (
                              <button
                                type="button"
                                onClick={() => handleStartEditDeal(d)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                title="ویرایش این معامله و مبالغ آن"
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
                                      `آیا از حذف معامله ${d.dealNumber} (طرف حساب: ${d.contactName}) و سند مالی پیوسته آن اطمینان دارید؟`
                                    )
                                  ) {
                                    onDeleteDeal(d.id);
                                  }
                                }}
                                className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer"
                                title="حذف معامله و سند مربوطه"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* نوار وضعیت تحویل ارز (تحویل شده و مانده تحویل‌نشده) */}
                      <div
                        className={`flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl border ${
                          remFor > 0
                            ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <PackageCheck className="w-4 h-4 text-teal-700 shrink-0" />
                          <span>
                            وضعیت تحویل خودِ ارز ({d.currency}):{' '}
                            <strong className="font-mono-num text-emerald-800">
                              {formatNumber(deliveredFor)} {d.currency} تحویل شده
                            </strong>
                          </span>
                          <span className="text-slate-300">|</span>
                          {remFor > 0 ? (
                            <span className="font-extrabold text-rose-700">
                              ⚠️ مانده تحویل‌نشده: {formatNumber(remFor)} {d.currency} (
                              {d.type === 'buy'
                                ? 'مشتری هنوز به شما تحویل نداده'
                                : 'شما هنوز به مشتری تحویل نداده‌اید'}
                              )
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-800">
                              ✓ تحویل کامل انجام شده است
                            </span>
                          )}
                        </div>

                        {d.deliverySplits && d.deliverySplits.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {d.deliverySplits.map((sp, i) => (
                              <span
                                key={sp.id}
                                className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono-num text-slate-700"
                              >
                                مرحله {i + 1}: {formatNumber(sp.amountForeign)} {d.currency} ({sp.date} — پیگیری:{' '}
                                {sp.trackingNumber})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* نمایش ریز پرداخت یا دریافت ترکیبی ریالی */}
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
                            مانده نسیه ریالی در حساب {d.contactName}:{' '}
                            <strong className="text-amber-800 font-mono-num">
                              {formatNumber(rem)} ریال
                            </strong>
                          </span>
                        </div>

                        {d.payments && d.payments.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {d.payments.map((p) => (
                              <span
                                key={p.id}
                                className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono-num"
                              >
                                {p.bankName}:{' '}
                                {p.currency === 'IRR'
                                  ? `${formatNumber(p.amountIRR)} ریال`
                                  : `${formatNumber(p.amountForeign)} ${p.currency} (نرخ ${formatNumber(
                                      p.exchangeRate
                                    )})`}
                                {p.trackingNumber ? ` | فیش: ${p.trackingNumber}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {d.notes && (
                        <div className="text-xs text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                          <strong className="text-slate-900">📝 توضیحات معامله:</strong> {d.notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* تب دوم: تحویل مرحله‌ای ارز و صورتحساب اختصاصی تحویل ارز مشتریان */}
      {/* ===================================================================== */}
      {subTab === 'delivery_statement' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-teal-600 shrink-0" />
                  صورتحساب اختصاصی تحویل مرحله‌ای ارز مشتریان (تحویل گرفته شده و تحویل نشده)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  در این بخش به تفکیک هر مشتری می‌بینید چقدر ارز معامله شده، در چه مراحلی تحویل گرفته یا داده شده، و چقدر ارز تحویل‌نشده باقی مانده است.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={deliveryFilterContactId}
                  onChange={(e) => setDeliveryFilterContactId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  <option value="ALL">همه مشتریان ({fxDeals.length} معامله)</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      فقط صورتحساب تحویل ارز: {c.name} ({c.code})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const targetName =
                      deliveryFilterContactId === 'ALL'
                        ? 'کل مشتریان صرافی'
                        : contacts.find((c) => c.id === deliveryFilterContactId)?.name || 'مشتری';
                    exportOrPrintCurrencyDeliveryStatementPDF({
                      contactName: targetName,
                      deals: filteredDeliveryDeals,
                      companyName,
                      fiscalYear,
                      mode: 'print',
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  چاپ A4 صورتحساب تحویل ارز
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetName =
                      deliveryFilterContactId === 'ALL'
                        ? 'کل مشتریان صرافی'
                        : contacts.find((c) => c.id === deliveryFilterContactId)?.name || 'مشتری';
                    exportOrPrintCurrencyDeliveryStatementPDF({
                      contactName: targetName,
                      deals: filteredDeliveryDeals,
                      companyName,
                      fiscalYear,
                      mode: 'download_pdf_html',
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileDown className="w-4 h-4" />
                  دانلود PDF تحویل ارز
                </button>
              </div>
            </div>

            {/* کارت‌های خلاصه تحویل ارز به تفکیک هر ارز */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {Object.entries(deliveryCurrencySummary).map(([cur, s]) => (
                <div
                  key={cur}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      وضعیت تحویل ارز {cur}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-teal-100 text-teal-900 font-mono font-extrabold">
                      {cur}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 font-mono-num">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">کل خرید ما از مشتری</span>
                      <strong className="text-slate-900 font-extrabold">
                        {formatNumber(s.totalBought)} {cur}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 block font-sans">تحویل گرفته شده</span>
                      <strong className="text-emerald-700 font-extrabold">
                        {formatNumber(s.deliveredBought)} {cur}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-700 block font-sans">
                        مانده تحویل‌نشده به ما
                      </span>
                      <strong className="text-rose-700 font-extrabold">
                        {formatNumber(s.undeliveredBought)} {cur}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 font-mono-num">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">کل فروش ما به مشتری</span>
                      <strong className="text-slate-900 font-extrabold">
                        {formatNumber(s.totalSold)} {cur}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 block font-sans">تحویل داده شده</span>
                      <strong className="text-emerald-700 font-extrabold">
                        {formatNumber(s.deliveredSold)} {cur}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-800 block font-sans">
                        مانده تعهد تحویل ما
                      </span>
                      <strong className="text-amber-800 font-extrabold">
                        {formatNumber(s.undeliveredSold)} {cur}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* لیست خط به خط معاملات و مراحل تحویل هر معامله */}
            <div className="space-y-4">
              {filteredDeliveryDeals.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  هیچ معامله ارزی برای این فیلتر ثبت نشده است.
                </div>
              ) : (
                filteredDeliveryDeals.map((d) => {
                  const deliveredFor = d.deliveredForeignAmount ?? d.foreignAmount;
                  const remFor =
                    d.remainingForeignDelivery ??
                    Math.max(0, Number((d.foreignAmount - deliveredFor).toFixed(2)));
                  const splits = d.deliverySplits || [];

                  return (
                    <div
                      key={d.id}
                      className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs"
                    >
                      <div className="bg-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono-num font-extrabold text-teal-800 bg-white px-2.5 py-1 rounded-lg border border-teal-200">
                            {d.dealNumber}
                          </span>
                          <span className="font-extrabold text-slate-900">👤 {d.contactName}</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              d.type === 'buy'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.type === 'buy'
                              ? 'خرید ارز (مشتری باید ارز تحویل دهد)'
                              : 'فروش ارز (ما باید ارز تحویل دهیم)'}
                          </span>
                          <span className="font-mono-num text-slate-600">تاریخ معامله: {d.date}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {remFor > 0 && onRecordDealDelivery && (
                            <button
                              type="button"
                              onClick={() => openDeliveryModal(d)}
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <PlusCircle className="w-4 h-4" />
                              ثبت مرحله جدید تحویل ({formatNumber(remFor)} {d.currency} مانده)
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* خلاصه مقادیر این معامله */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <span className="text-slate-600 font-bold">کل ارز معامله‌شده:</span>
                            <strong className="font-mono-num text-sm font-extrabold text-slate-900">
                              {formatCurrencyAmount(d.foreignAmount, d.currency)} {d.currency}
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                            <span className="text-emerald-900 font-bold">جمع تحویل‌شده تا این لحظه:</span>
                            <strong className="font-mono-num text-sm font-extrabold text-emerald-800">
                              {formatCurrencyAmount(deliveredFor, d.currency)} {d.currency}
                            </strong>
                          </div>
                          <div
                            className={`p-2.5 rounded-xl border flex items-center justify-between ${
                              remFor > 0
                                ? 'bg-rose-50 border-rose-300 text-rose-900'
                                : 'bg-teal-50 border-teal-200 text-teal-900'
                            }`}
                          >
                            <span className="font-bold">مانده ارز تحویل‌نشده:</span>
                            <strong className="font-mono-num text-sm font-extrabold">
                              {remFor > 0
                                ? `${formatCurrencyAmount(remFor, d.currency)} ${d.currency}`
                                : '۰ (تسویه و تحویل کامل)'}
                            </strong>
                          </div>
                        </div>

                        {d.notes && (
                          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950">
                            <strong>توضیحات کلی معامله:</strong> {d.notes}
                          </div>
                        )}

                        {/* جدول ریز مراحل تحویل خط به خط */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-right border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-700">
                                <th className="py-2.5 px-3">مرحله</th>
                                <th className="py-2.5 px-3">تاریخ تحویل</th>
                                <th className="py-2.5 px-3">شماره پیگیری / فیش تحویل</th>
                                <th className="py-2.5 px-3">صندوق / حساب ارزی</th>
                                <th className="py-2.5 px-3 text-left">مقدار تحویل‌شده</th>
                                <th className="py-2.5 px-3">توضیحات خط به خط این مرحله</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {splits.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-3 px-3 text-center text-slate-500">
                                    {deliveredFor > 0
                                      ? `تحویل یکجا در تاریخ ${d.date} به مقدار ${formatCurrencyAmount(
                                          deliveredFor,
                                          d.currency
                                        )} ${d.currency} (شماره پیگیری: ${d.trackingNumber})`
                                      : 'هنوز هیچ مرحله تحویلی برای این معامله ثبت نشده است.'}
                                  </td>
                                </tr>
                              ) : (
                                splits.map((sp, sIdx) => (
                                  <tr key={sp.id} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 font-mono font-bold text-slate-600">
                                      مرحله #{sIdx + 1}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-700">{sp.date}</td>
                                    <td className="py-2 px-3 font-mono font-extrabold text-teal-800">
                                      {sp.trackingNumber || '—'}
                                    </td>
                                    <td className="py-2 px-3 font-bold text-slate-800">
                                      {sp.vaultBankName || 'خزانه ارزی'}
                                    </td>
                                    <td className="py-2 px-3 font-mono font-extrabold text-emerald-700 text-left">
                                      {formatCurrencyAmount(sp.amountForeign, d.currency)} {d.currency}
                                    </td>
                                    <td className="py-2 px-3 text-slate-800 font-medium">
                                      {sp.notes || '—'}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* مودال ثبت تحویل مرحله‌ای جدید برای یک معامله */}
      {/* ===================================================================== */}
      {activeDeliveryDeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white border-2 border-amber-300 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    ثبت مرحله جدید تحویل ارز ({activeDeliveryDeal.dealNumber})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    مشتری: <strong>{activeDeliveryDeal.contactName}</strong> | کل معامله:{' '}
                    {formatNumber(activeDeliveryDeal.foreignAmount)} {activeDeliveryDeal.currency}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryModalDealId(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-700" />
                مانده ارز تحویل‌نشده از این معامله:
              </span>
              <strong className="font-mono-num text-sm font-extrabold text-rose-700">
                {formatNumber(
                  activeDeliveryDeal.remainingForeignDelivery ??
                    Math.max(
                      0,
                      activeDeliveryDeal.foreignAmount -
                        (activeDeliveryDeal.deliveredForeignAmount ?? activeDeliveryDeal.foreignAmount)
                    )
                )}{' '}
                {activeDeliveryDeal.currency}
              </strong>
            </div>

            <form onSubmit={handleSaveDeliveryStage} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">
                    مقدار تحویل در این مرحله ({activeDeliveryDeal.currency}) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={stageAmountForeign ? formatNumber(stageAmountForeign) : ''}
                    onChange={(e) => setStageAmountForeign(parseFormattedNumber(e.target.value))}
                    className="w-full bg-white border-2 border-teal-500 rounded-xl px-3 py-2 text-sm font-extrabold font-mono-num text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">تاریخ این تحویل *</label>
                  <input
                    type="text"
                    required
                    value={stageDate}
                    onChange={(e) => setStageDate(e.target.value)}
                    placeholder="1404/08/13"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono-num font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    صندوق / حساب ارزی {activeDeliveryDeal.type === 'buy' ? 'مقصد ورود' : 'مبدأ خروج'}:
                  </label>
                  <select
                    value={stageVaultBankId}
                    onChange={(e) => setStageVaultBankId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({b.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-teal-800 mb-1">
                    شماره پیگیری فیش / رسید تحویل:
                  </label>
                  <input
                    type="text"
                    value={stageTrackingNumber}
                    onChange={(e) => setStageTrackingNumber(e.target.value)}
                    placeholder="مثلاً: DLV-202"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono-num text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  توضیحات خط به خط این مرحله تحویل (در صورتحساب می‌آید):
                </label>
                <input
                  type="text"
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  placeholder="مثلاً: تحویل مرحله دوم به نماینده مشتری در صرافی..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDeliveryModalDealId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  ثبت قطعی این مرحله تحویل ارز
                </button>
              </div>
            </form>
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
                  رسید رسمی معامله {previewDeal.type === 'buy' ? 'خرید ارز' : 'فروش ارز'}
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
                <span className="text-slate-500 block">شماره رسید معامله:</span>
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
              <div className="bg-slate-100 px-4 py-2.5 font-extrabold text-slate-800 flex justify-between">
                <span>شرح ارز مورد معامله و وضعیت تحویل</span>
                <span>مقدار و نرخ</span>
              </div>
              <div className="p-4 space-y-2.5 divide-y divide-slate-100">
                <div className="flex justify-between items-center pb-2">
                  <span className="text-slate-600 font-medium">مقدار کل ارز ({previewDeal.currency}):</span>
                  <strong className="font-mono-num text-sm font-extrabold text-slate-900">
                    {formatNumber(previewDeal.foreignAmount)} {previewDeal.currency}
                  </strong>
                </div>
                <div className="flex justify-between items-center pt-2 pb-2">
                  <span className="text-slate-600 font-medium">مقدار تحویل‌شده تا این لحظه:</span>
                  <strong className="font-mono-num text-sm font-extrabold text-emerald-700">
                    {formatNumber(previewDeal.deliveredForeignAmount ?? previewDeal.foreignAmount)}{' '}
                    {previewDeal.currency}
                  </strong>
                </div>
                <div className="flex justify-between items-center pt-2 pb-2">
                  <span className="text-slate-600 font-medium">مانده ارز تحویل‌نشده:</span>
                  <strong className="font-mono-num text-sm font-extrabold text-rose-700">
                    {formatNumber(previewDeal.remainingForeignDelivery ?? 0)} {previewDeal.currency}
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

            {previewDeal.deliverySplits && previewDeal.deliverySplits.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                <strong className="text-amber-950 block">ریز مراحل تحویل ارز:</strong>
                {previewDeal.deliverySplits.map((sp, i) => (
                  <div key={sp.id} className="flex justify-between text-slate-800 border-b border-amber-200/60 pb-1">
                    <span>
                      مرحله {i + 1} ({sp.date}) — پیگیری: <strong className="font-mono">{sp.trackingNumber}</strong>
                      {sp.notes ? ` — ${sp.notes}` : ''}
                    </span>
                    <strong className="font-mono-num text-emerald-800">
                      {formatNumber(sp.amountForeign)} {previewDeal.currency}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-800 block text-[11px] font-bold">مبلغ تسویه‌شده (نقد/بانک):</span>
                <strong className="font-mono-num text-sm font-extrabold text-emerald-950 mt-0.5 block">
                  {formatNumber(previewDeal.paidAmountIRR ?? 0)} ریال
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-800 block text-[11px] font-bold">مانده در حساب شخص (نسیه):</span>
                <strong className="font-mono-num text-sm font-extrabold text-amber-950 mt-0.5 block">
                  {formatNumber(previewDeal.remainingAmountIRR ?? 0)} ریال
                </strong>
              </div>
            </div>

            {previewDeal.notes && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <strong>توضیحات کامل:</strong> {previewDeal.notes}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
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
