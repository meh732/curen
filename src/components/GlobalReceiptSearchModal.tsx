import React, { useMemo, useState } from 'react';
import {
  AccountingState,
  Contact,
  CurrencyCode,
} from '../types/accounting';
import {
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import {
  Search,
  Hash,
  X,
  FileText,
  Landmark,
  User,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
} from 'lucide-react';

interface GlobalReceiptSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AccountingState;
  initialQuery?: string;
  onOpenPersonStatement: (contactId: string) => void;
  onNavigateToVouchers?: () => void;
}

export interface SystemReceiptSearchItem {
  id: string;
  trackingNumber: string;
  date: string;
  docNumberLabel: string;
  voucherNumber?: number;
  contactId?: string;
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
  categoryLabel: string;
  directionLabel: 'دریافت / واریز' | 'پرداخت / برداشت' | 'معامله ارز' | 'تحویل ارز' | 'سند مالی';
}

export const GlobalReceiptSearchModal: React.FC<GlobalReceiptSearchModalProps> = ({
  isOpen,
  onClose,
  state,
  initialQuery = '',
  onOpenPersonStatement,
  onNavigateToVouchers,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VOUCHER_PAY_REC' | 'FX_DEAL' | 'DELIVERY'>('ALL');

  const allSystemReceipts = useMemo<SystemReceiptSearchItem[]>(() => {
    const contactMap = new Map<string, Contact>(
      state.contacts.map((c) => [c.id, c])
    );
    const dealByVoucherId = new Map(
      state.fxDeals.filter((d) => d.linkedVoucherId).map((d) => [d.linkedVoucherId!, d])
    );
    const dealByNumber = new Map(
      state.fxDeals.map((d) => [d.dealNumber, d])
    );

    const items: SystemReceiptSearchItem[] = [];
    const seenKeys = new Set<string>();

    // ۱. تمامی اسناد حسابداری (ثبت دریافت و پرداخت به اشخاص، انتقال بانکی، هزینه، درآمد، معاملات ارز، فاکتورها)
    state.vouchers.forEach((v) => {
      const linkedDeal =
        dealByVoucherId.get(v.id) ||
        (v.referenceNumber ? dealByNumber.get(v.referenceNumber) : undefined);

      const bankLines = v.lines.filter((l) => l.bankId || l.bankName);
      const personLines = v.lines.filter((l) => l.contactId || l.contactName);

      if (personLines.length > 0) {
        personLines.forEach((pLn, idx) => {
          const contactObj = pLn.contactId ? contactMap.get(pLn.contactId) : undefined;
          const matchingBank =
            bankLines.find(
              (bLn) =>
                bLn.trackingNumber &&
                pLn.trackingNumber &&
                bLn.trackingNumber === pLn.trackingNumber
            ) ||
            bankLines[idx] ||
            bankLines[0];

          const resolvedTracking = (
            pLn.trackingNumber ||
            matchingBank?.trackingNumber ||
            linkedDeal?.trackingNumber ||
            v.referenceNumber ||
            `سند-${v.voucherNumber}`
          ).trim();

          // ترکیب توضیحات کامل آرتیکل شخص، آرتیکل بانک، شرح سند و توضیحات معامله ارز
          const descParts: string[] = [];
          if (pLn.description) descParts.push(pLn.description.trim());
          if (
            matchingBank?.description &&
            !descParts.some((d) => d.includes(matchingBank.description.trim()))
          ) {
            descParts.push(matchingBank.description.trim());
          }
          if (
            v.description &&
            !descParts.some((d) => d.includes(v.description.trim()))
          ) {
            descParts.push(`شرح سند: ${v.description.trim()}`);
          }
          if (
            linkedDeal?.notes &&
            !descParts.some((d) => d.includes(linkedDeal.notes!.trim()))
          ) {
            descParts.push(`توضیحات معامله: ${linkedDeal.notes.trim()}`);
          }

          const categoryLabel =
            v.autoType === 'receive_from_person'
              ? 'دریافت از شخص (ثبت دریافت و پرداخت)'
              : v.autoType === 'pay_to_person'
              ? 'پرداخت به شخص (ثبت دریافت و پرداخت)'
              : v.autoType === 'fx_deal'
              ? 'معامله خرید و فروش ارز'
              : v.autoType === 'invoice'
              ? 'فاکتور خرید/فروش'
              : 'سند حسابداری اشخاص';

          const directionLabel: SystemReceiptSearchItem['directionLabel'] =
            v.autoType === 'receive_from_person' || pLn.creditIRR > 0
              ? 'دریافت / واریز'
              : v.autoType === 'pay_to_person' || pLn.debitIRR > 0
              ? 'پرداخت / برداشت'
              : 'معامله ارز';

          const key = `v-person-${v.id}-${pLn.id}`;
          seenKeys.add(key);

          items.push({
            id: key,
            trackingNumber: resolvedTracking,
            date: v.date,
            docNumberLabel: `سند #${v.voucherNumber}`,
            voucherNumber: v.voucherNumber,
            contactId: pLn.contactId,
            contactName: contactObj?.name || pLn.contactName || linkedDeal?.contactName || 'شخص',
            contactCode: contactObj?.code || '—',
            bankName:
              pLn.bankName ||
              matchingBank?.bankName ||
              (linkedDeal?.targetForeignBankId
                ? state.banks.find((b) => b.id === linkedDeal.targetForeignBankId)?.bankName || 'خزانه ارزی'
                : 'حساب دفتری / عمومی'),
            currency: pLn.currency,
            exchangeRate: pLn.exchangeRate || 1,
            debitIRR: pLn.debitIRR || 0,
            creditIRR: pLn.creditIRR || 0,
            debitForeign: pLn.currency !== 'IRR' ? pLn.debitForeign || 0 : 0,
            creditForeign: pLn.currency !== 'IRR' ? pLn.creditForeign || 0 : 0,
            description: descParts.join(' | '),
            categoryLabel,
            directionLabel,
          });
        });
      } else {
        // اسناد بدون شخص (مثل انتقال بین بانک‌ها، ثبت هزینه، شارژ حساب)
        bankLines.forEach((bLn) => {
          const resolvedTracking = (
            bLn.trackingNumber ||
            v.referenceNumber ||
            `سند-${v.voucherNumber}`
          ).trim();
          const desc =
            bLn.description && v.description && !bLn.description.includes(v.description)
              ? `${bLn.description} | ${v.description}`
              : bLn.description || v.description;

          items.push({
            id: `v-bank-${v.id}-${bLn.id}`,
            trackingNumber: resolvedTracking,
            date: v.date,
            docNumberLabel: `سند #${v.voucherNumber}`,
            voucherNumber: v.voucherNumber,
            contactId: undefined,
            contactName:
              v.autoType === 'bank_transfer'
                ? 'انتقال داخلی بین بانک/صندوق'
                : v.autoType === 'expense'
                ? 'هزینه صرافی / شخصی'
                : 'عملیات خزانه و بانک',
            contactCode: 'داخلی',
            bankName: bLn.bankName || 'بانک / صندوق',
            currency: bLn.currency,
            exchangeRate: bLn.exchangeRate || 1,
            debitIRR: bLn.debitIRR || 0,
            creditIRR: bLn.creditIRR || 0,
            debitForeign: bLn.currency !== 'IRR' ? bLn.debitForeign || 0 : 0,
            creditForeign: bLn.currency !== 'IRR' ? bLn.creditForeign || 0 : 0,
            description: desc,
            categoryLabel:
              v.autoType === 'bank_transfer'
                ? 'انتقال بین بانک‌ها و صندوق‌ها'
                : v.autoType === 'expense'
                ? 'ثبت هزینه'
                : v.autoType === 'income'
                ? 'درآمد / شارژ حساب'
                : 'سند مالی خزانه',
            directionLabel: bLn.debitIRR > 0 ? 'دریافت / واریز' : 'پرداخت / برداشت',
          });
        });
      }
    });

    // ۲. مراحل تحویل مرحله‌ای ارز (FXDeliverySplit)
    state.fxDeals.forEach((d) => {
      const cObj = contactMap.get(d.contactId);
      (d.deliverySplits || []).forEach((sp, idx) => {
        const trk = (sp.trackingNumber || `${d.dealNumber}-DLV${idx + 1}`).trim();
        items.push({
          id: `dlv-${d.id}-${sp.id}`,
          trackingNumber: trk,
          date: sp.date,
          docNumberLabel: `${d.dealNumber} (تحویل #${idx + 1})`,
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
            `رسید تحویل مرحله ${idx + 1} ارز بابت معامله ${d.dealNumber} (${formatNumber(
              sp.amountForeign
            )} ${d.currency})`,
          categoryLabel: 'رسید تحویل مرحله‌ای ارز',
          directionLabel: 'تحویل ارز',
        });
      });
    });

    return items;
  }, [state.vouchers, state.contacts, state.fxDeals, state.banks]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSystemReceipts.filter((item) => {
      if (typeFilter === 'VOUCHER_PAY_REC') {
        if (
          !item.categoryLabel.includes('دریافت') &&
          !item.categoryLabel.includes('پرداخت') &&
          !item.categoryLabel.includes('انتقال') &&
          !item.categoryLabel.includes('هزینه')
        ) {
          return false;
        }
      } else if (typeFilter === 'FX_DEAL') {
        if (!item.categoryLabel.includes('معامله')) return false;
      } else if (typeFilter === 'DELIVERY') {
        if (!item.categoryLabel.includes('تحویل')) return false;
      }

      if (!q) return true;
      return (
        item.trackingNumber.toLowerCase().includes(q) ||
        item.contactName.toLowerCase().includes(q) ||
        item.contactCode.toLowerCase().includes(q) ||
        item.bankName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.docNumberLabel.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        String(item.debitIRR).includes(q) ||
        String(item.creditIRR).includes(q) ||
        String(item.debitForeign).includes(q) ||
        String(item.creditForeign).includes(q)
      );
    });
  }, [allSystemReceipts, query, typeFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-teal-500 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-l from-teal-700 to-emerald-700 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-extrabold">
                جستجوی سراسری فیش‌ها، کدهای رهگیری و رسیدها در کل سیستم (آرکا)
              </h2>
              <p className="text-[11px] sm:text-xs text-teal-100 mt-0.5">
                شماره فیش، کد رهگیری، شماره رسید، نام مشتری، نام بانک، مبلغ یا توضیحات را وارد کنید تا فوری تمام اطلاعات و صورتحساب آن نمایش داده شود.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input & Quick Filters */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 text-teal-600 absolute right-4 top-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="شماره فیش / کد رهگیری / شماره رسید / نام مشتری / مبلغ / توضیحات را تایپ کنید..."
              className="w-full pr-12 pl-10 py-3 text-xs sm:text-sm bg-white border-2 border-teal-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-extrabold text-slate-900 shadow-xs"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer ${
                  typeFilter === 'ALL'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                همه فیش‌ها و اسناد ({formatNumber(allSystemReceipts.length)})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('VOUCHER_PAY_REC')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer ${
                  typeFilter === 'VOUCHER_PAY_REC'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                فیش‌های ثبت دریافت و پرداخت اشخاص
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('FX_DEAL')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer ${
                  typeFilter === 'FX_DEAL'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                فیش‌های خرید و فروش ارز
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('DELIVERY')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer ${
                  typeFilter === 'DELIVERY'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                رسیدهای تحویل مرحله‌ای ارز
              </button>
            </div>

            <span className="px-3 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 font-extrabold font-mono-num">
              نتایج یافت‌شده: {formatNumber(filteredItems.length)} مورد
            </span>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-white">
          {filteredItems.length === 0 ? (
            <div className="p-10 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
              <Hash className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-extrabold text-slate-700">
                هیچ فیش یا کد رهگیری با عبارت «{query}» پیدا نشد
              </div>
              <p className="text-xs text-slate-500">
                می‌توانید بخشی از شماره فیش، نام شخص، نام بانک یا مبلغ را جستجو کنید.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50/90 hover:bg-teal-50/30 border-2 border-slate-200 hover:border-teal-400 rounded-2xl p-3.5 sm:p-4 space-y-3 transition shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-teal-700 text-white font-mono-num text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-xs">
                      <Hash className="w-4 h-4" />
                      شماره فیش / رهگیری: {item.trackingNumber}
                    </span>

                    <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-extrabold flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      طرف حساب: {item.contactName}{' '}
                      {item.contactCode !== '—' ? `(${item.contactCode})` : ''}
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-extrabold">
                      {item.categoryLabel} ({item.docNumberLabel})
                    </span>

                    <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono-num text-xs text-slate-600 font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {item.date}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.contactId && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPersonStatement(item.contactId!);
                          onClose();
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        مشاهده صورتحساب کامل {item.contactName} ←
                      </button>
                    )}
                    {onNavigateToVouchers && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateToVouchers();
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        مشاهده در اسناد
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1 font-bold">
                      <Landmark className="w-3.5 h-3.5 text-teal-600" />
                      بانک / صندوق:
                    </span>
                    <strong className="text-slate-900 font-extrabold">{item.bankName}</strong>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between font-mono-num">
                    <span className="text-slate-500 font-sans font-bold">مبلغ ریالی فیش:</span>
                    <strong
                      className={`font-extrabold flex items-center gap-1 ${
                        item.debitIRR > 0 ? 'text-amber-800' : 'text-emerald-800'
                      }`}
                    >
                      {item.debitIRR > 0 ? (
                        <>
                          <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                          بدهکار (پرداختی): {formatNumber(item.debitIRR)} ریال
                        </>
                      ) : item.creditIRR > 0 ? (
                        <>
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                          بستانکار (دریافتی): {formatNumber(item.creditIRR)} ریال
                        </>
                      ) : (
                        'تحویل فیزیکی ارز'
                      )}
                    </strong>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between font-mono-num">
                    <span className="text-slate-500 font-sans font-bold">مبلغ ارزی و نرخ:</span>
                    <strong className="text-blue-900 font-extrabold">
                      {item.currency === 'IRR'
                        ? 'ریال ایران (IRR)'
                        : `${formatCurrencyAmount(
                            item.debitForeign || item.creditForeign,
                            item.currency
                          )} ${item.currency} (نرخ: ${formatNumber(item.exchangeRate)} ریال)`}
                    </strong>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-900 leading-relaxed flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-teal-900">توضیحات کامل ثبت‌شده: </strong>
                    <span className="font-semibold">{item.description}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
