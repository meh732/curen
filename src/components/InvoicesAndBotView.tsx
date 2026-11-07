import React, { useState, useEffect, useMemo } from 'react';
import {
  SalesInvoice,
  InvoiceItem,
  Contact,
  ProductItem,
  BankAccount,
  Currency,
  PaymentSplitLine,
} from '../types/accounting';
import { formatNumber, parseFormattedNumber } from '../utils/accountingEngine';
import { MultiPaymentSplitsEditor } from './MultiPaymentSplitsEditor';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Landmark,
  UserPlus,
  Printer,
  Package,
  Eye,
  Send,
  X,
  Sparkles,
  Search,
} from 'lucide-react';

interface InvoicesAndBotViewProps {
  invoices: SalesInvoice[];
  contacts: Contact[];
  products: ProductItem[];
  banks: BankAccount[];
  currencies: Currency[];
  onIssueInvoice: (invoice: SalesInvoice) => void;
  onUpdateInvoice?: (invoice: SalesInvoice) => void;
  onAddContact?: (contact: Contact) => void;
  onDeleteInvoice?: (id: string) => void;
}

export const InvoicesAndBotView: React.FC<InvoicesAndBotViewProps> = ({
  invoices,
  contacts,
  products,
  banks,
  currencies,
  onIssueInvoice,
  onUpdateInvoice,
  onAddContact,
  onDeleteInvoice,
}) => {
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceType, setInvoiceType] = useState<'sales' | 'purchase'>('sales');
  const getNextInvoiceNum = (list: SalesInvoice[]) => {
    const maxNum = Math.max(
      101,
      ...list.map((inv) => {
        const tail = inv.invoiceNumber.split('-').pop() || '101';
        return parseInt(tail.replace(/\D/g, ''), 10) || 101;
      })
    );
    return `INV-1404-${maxNum + 1}`;
  };
  const [invoiceNumber, setInvoiceNumber] = useState(() => getNextInvoiceNum(invoices));
  const [date, setDate] = useState('1404/08/12');
  const [contactId, setContactId] = useState(contacts[0]?.id || '');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (contacts.length > 0 && (!contactId || !contacts.some((c) => c.id === contactId))) {
      setContactId(contacts[0].id);
    }
  }, [contacts, contactId]);

  // Success Feedback Card State
  const [submittedInvoiceSuccess, setSubmittedInvoiceSuccess] = useState<SalesInvoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(null);

  // تعریف سریع شخص جدید
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // پیشنهاد فی بر اساس آخرین فاکتور صادر شده برای این کالا یا ارز
  const getSuggestedPriceForProduct = (prodId: string): number => {
    for (let i = invoices.length - 1; i >= 0; i--) {
      const match = invoices[i].items.find(
        (it) => it.productId === prodId && it.unitPriceIRR > 0
      );
      if (match) return match.unitPriceIRR;
    }
    const prod = products.find((p) => p.id === prodId);
    return prod?.defaultPriceIRR || 0;
  };

  const createBlankItem = (prodId?: string): InvoiceItem => {
    const selectedProd = products.find((p) => p.id === prodId) || products[0];
    const pid = selectedProd?.id || '__custom__';
    const suggestedPrice = getSuggestedPriceForProduct(pid);
    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      productId: pid,
      productSku: selectedProd?.sku || 'CUSTOM',
      productName: selectedProd?.name || 'معامله ارزی',
      unit: selectedProd?.unit || 'واحد',
      quantity: 0,
      unitPriceForeign: suggestedPrice,
      unitPriceIRR: suggestedPrice,
      discountForeign: 0,
      discountIRR: 0,
      taxPercent: 0,
      totalForeign: 0,
      totalIRR: 0,
    };
  };

  // اقلام فاکتور (به صورت پیش‌فرض خام)
  const [items, setItems] = useState<InvoiceItem[]>(() => [createBlankItem()]);

  // ردیف‌های دریافت یا پرداخت ترکیبی چند بانکی / چند صندوقی
  const [payments, setPayments] = useState<PaymentSplitLine[]>([]);

  // جستجوی شماره فاکتور، نام مشتری، تاریخ یا عنوان کالا/ارز
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearchQuery.trim()) return invoices;
    const q = invoiceSearchQuery.trim().toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.contactName.toLowerCase().includes(q) ||
        inv.date.includes(q) ||
        inv.items.some((it) => it.productName.toLowerCase().includes(q))
    );
  }, [invoices, invoiceSearchQuery]);

  const selectedContact = contacts.find((c) => c.id === contactId);

  const recalcRow = (row: InvoiceItem): InvoiceItem => {
    const gross = row.quantity * row.unitPriceIRR;
    const beforeTax = Math.max(0, gross - (row.discountIRR || 0));
    const taxAmt = Math.round(beforeTax * ((row.taxPercent || 0) / 100));
    const finalIRR = beforeTax + taxAmt;
    return {
      ...row,
      unitPriceForeign: row.unitPriceIRR,
      discountForeign: row.discountIRR,
      totalForeign: finalIRR,
      totalIRR: finalIRR,
    };
  };

  const handleInvoiceTypeChange = (newType: 'sales' | 'purchase') => {
    setInvoiceType(newType);
  };

  const handleItemChange = (index: number, patch: Partial<InvoiceItem>) => {
    const next = [...items];
    let updated = { ...next[index], ...patch };

    if (patch.productId !== undefined) {
      if (patch.productId === '__custom__') {
        updated.productId = '__custom__';
        updated.productSku = 'CUSTOM';
        updated.productName = '';
        updated.unit = 'واحد';
      } else {
        const prod = products.find((p) => p.id === patch.productId);
        if (prod) {
          updated.productSku = prod.sku;
          updated.productName = prod.name;
          updated.unit = prod.unit;
          updated.unitPriceIRR = getSuggestedPriceForProduct(prod.id);
        }
      }
    }

    next[index] = recalcRow(updated);
    setItems(next);
  };

  const addItem = () => {
    setItems([...items, createBlankItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const subtotalIRR = items.reduce((s, i) => s + i.quantity * i.unitPriceIRR, 0);
  const totalDiscountIRR = items.reduce((s, i) => s + (i.discountIRR || 0), 0);
  const totalTaxIRR = items.reduce((s, i) => {
    const beforeTax = Math.max(0, i.quantity * i.unitPriceIRR - (i.discountIRR || 0));
    return s + Math.round(beforeTax * ((i.taxPercent || 0) / 100));
  }, 0);
  const grandTotalIRR = items.reduce((s, i) => s + i.totalIRR, 0);

  const handleQuickCreateContact = () => {
    if (!newContactName.trim() || !onAddContact) return;
    const nextContactCodeNum =
      Math.max(1000, ...contacts.map((c) => parseInt(c.code.replace(/\D/g, ''), 10) || 1000)) + 1;
    const newC: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${nextContactCodeNum}`,
      name: newContactName.trim(),
      type: invoiceType === 'sales' ? 'customer' : 'supplier',
      phone: newContactPhone.trim(),
      defaultCurrency: 'IRR',
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
    if (!contactId || grandTotalIRR <= 0) return;

    const validPayments = payments.filter((p) => p.bankId && p.amountIRR > 0);
    const paidSum = validPayments.reduce((s, p) => s + p.amountIRR, 0);
    const remSum = Math.max(0, grandTotalIRR - paidSum);

    let status: SalesInvoice['status'] = 'issued';
    if (paidSum >= grandTotalIRR) status = 'paid';
    else if (paidSum > 0) status = 'partial';

    let targetInvoice: SalesInvoice;

    if (editingInvoiceId && onUpdateInvoice) {
      const existing = invoices.find((i) => i.id === editingInvoiceId);
      targetInvoice = {
        id: editingInvoiceId,
        invoiceNumber: invoiceNumber.trim() || existing?.invoiceNumber || `INV-1404-${102 + invoices.length}`,
        type: invoiceType,
        date,
        dueDate: date,
        contactId,
        contactName: selectedContact?.name || existing?.contactName || 'مشتری / طرف حساب',
        currency: 'IRR',
        exchangeRate: 1,
        convertToIRRInPrint: true,
        warehouseName: 'انبار مرکزی',
        projectCode: 'GENERAL',
        items,
        subtotalForeign: subtotalIRR,
        subtotalIRR,
        totalDiscountForeign: totalDiscountIRR,
        totalDiscountIRR,
        totalTaxForeign: totalTaxIRR,
        totalTaxIRR,
        grandTotalForeign: grandTotalIRR,
        grandTotalIRR,
        payments: validPayments,
        paidAmountIRR: paidSum,
        remainingAmountIRR: remSum,
        status,
        linkedVoucherId: existing?.linkedVoucherId || `vch-inv-${Date.now()}`,
        notes: notes.trim(),
      };
      onUpdateInvoice(targetInvoice);
      setEditingInvoiceId(null);
    } else {
      targetInvoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: invoiceNumber.trim() || `INV-1404-${102 + invoices.length}`,
        type: invoiceType,
        date,
        dueDate: date,
        contactId,
        contactName: selectedContact?.name || 'مشتری / طرف حساب',
        currency: 'IRR',
        exchangeRate: 1,
        convertToIRRInPrint: true,
        warehouseName: 'انبار مرکزی',
        projectCode: 'GENERAL',
        items,
        subtotalForeign: subtotalIRR,
        subtotalIRR,
        totalDiscountForeign: totalDiscountIRR,
        totalDiscountIRR,
        totalTaxForeign: totalTaxIRR,
        totalTaxIRR,
        grandTotalForeign: grandTotalIRR,
        grandTotalIRR,
        payments: validPayments,
        paidAmountIRR: paidSum,
        remainingAmountIRR: remSum,
        status,
        linkedVoucherId: `vch-inv-${Date.now()}`,
        notes:
          notes.trim() ||
          `${invoiceType === 'sales' ? 'فاکتور فروش' : 'فاکتور خرید'} - ${
            selectedContact?.name || ''
          }`,
      };

      onIssueInvoice(targetInvoice);
    }

      setSubmittedInvoiceSuccess(targetInvoice);
      setInvoiceNumber(getNextInvoiceNum([targetInvoice, ...invoices]));
      setItems([createBlankItem()]);
      setPayments([]);
      setNotes('');
    };

    const handleStartEdit = (inv: SalesInvoice) => {
      setEditingInvoiceId(inv.id);
      setInvoiceType(inv.type);
      setInvoiceNumber(inv.invoiceNumber);
      setDate(inv.date);
      setContactId(inv.contactId);
      setItems(inv.items);
      setPayments(inv.payments || []);
      setNotes(inv.notes || '');
      setSubmittedInvoiceSuccess(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
      <div className="space-y-6 max-w-full overflow-hidden">
        {/* Invoice Preview Modal */}
        <InvoicePreviewModal
          invoice={previewInvoice}
          companyName="آرکا (ARKA) — صرافی و حسابداری ارزی"
          onClose={() => setPreviewInvoice(null)}
        />

      {/* SUCCESS CONFIRMATION CARD ON SUBMIT */}
      {submittedInvoiceSuccess && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-emerald-950 text-sm sm:text-base">
                  فاکتور با موفقیت در سیستم ثبت و سند آن صادر شد!
                </h3>
                <p className="text-xs text-emerald-800">
                  اطلاعات فاکتور، سند حسابداری و موجودی بانک/صندوق به‌روز گردید.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSubmittedInvoiceSuccess(null)}
              className="p-1 rounded-xl text-emerald-700 hover:bg-emerald-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-emerald-200 text-xs font-mono-num">
            <div>
              <span className="text-slate-500 font-sans block text-[11px]">شماره فاکتور:</span>
              <span className="font-extrabold text-teal-800 text-sm">{submittedInvoiceSuccess.invoiceNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans block text-[11px]">طرف حساب:</span>
              <span className="font-extrabold text-slate-900 text-sm">{submittedInvoiceSuccess.contactName}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans block text-[11px]">مبلغ کل معامله:</span>
              <span className="font-extrabold text-emerald-900 text-sm">
                {formatNumber(submittedInvoiceSuccess.grandTotalIRR)} ریال
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setPreviewInvoice(submittedInvoiceSuccess)}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/20 cursor-pointer transition"
            >
              <Eye className="w-4 h-4" />
              مشاهده و پیش‌نمایش فاکتور
            </button>
            <button
              onClick={() => setSubmittedInvoiceSuccess(null)}
              className="px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 font-bold text-xs hover:bg-emerald-100 cursor-pointer transition"
            >
              + ثبت فاکتور جدید
            </button>
          </div>
        </div>
      )}

      {/* FORM: Issue Invoice (Clean Light Theme) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              {invoiceType === 'sales' ? (
                <ShoppingBag className="w-5 h-5 text-teal-600 shrink-0" />
              ) : (
                <ShoppingCart className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              {editingInvoiceId ? 'ویرایش فاکتور معامله ارزی' : 'ثبت فاکتور خرید و فروش ارز'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ثبت فاکتور معاملات ارزی و تسویه ترکیبی از چند بانک و صندوق
            </p>
          </div>

          {/* Type Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => handleInvoiceTypeChange('sales')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                invoiceType === 'sales'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              فاکتور فروش
            </button>
            <button
              type="button"
              onClick={() => handleInvoiceTypeChange('purchase')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer ${
                invoiceType === 'purchase'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              فاکتور خرید
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Header Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">شماره فاکتور:</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono-num font-extrabold focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">تاریخ فاکتور:</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono-num font-bold focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  {invoiceType === 'sales' ? 'طرف حساب (خریدار / مشتری):' : 'طرف حساب (فروشنده):'}
                </label>
                {onAddContact && (
                  <button
                    type="button"
                    onClick={() => setShowQuickContact(!showQuickContact)}
                    className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + سریع شخص جدید
                  </button>
                )}
              </div>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || 'بدون تلفن'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Add Contact Form */}
          {showQuickContact && (
            <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <label className="block font-bold text-teal-950 mb-1">نام کامل شخص:</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="مثال: علی رضایی"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block font-bold text-slate-700 mb-1">شماره تماس:</label>
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="0912..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono-num"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickCreateContact}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-teal-600 text-white font-extrabold transition cursor-pointer"
              >
                ذخیره شخص
              </button>
            </div>
          )}

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                <Package className="w-4 h-4 text-teal-600" />
                اقلام معامله (ارزها یا خدمات)
              </span>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-teal-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                + ردیف معامله
              </button>
            </div>

            {/* Mobile Cards for Items */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-extrabold text-teal-800">
                      ردیف {idx + 1}: موضوع معامله
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">انتخاب ارز / کالا:</label>
                      <select
                        value={item.productId}
                        onChange={(e) => handleItemChange(idx, { productId: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                        <option value="__custom__">✏️ نام دلخواه ارز / معامله...</option>
                      </select>
                      {item.productId === '__custom__' && (
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleItemChange(idx, { productName: e.target.value })}
                          placeholder="شرح معامله را وارد کنید..."
                          className="w-full bg-white border border-teal-400 rounded-xl px-3 py-2 mt-1.5 text-xs font-semibold"
                          required
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">مقدار / تعداد:</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.quantity ? formatNumber(item.quantity) : ''}
                          onChange={(e) =>
                            handleItemChange(idx, {
                              quantity: Math.max(0, parseFormattedNumber(e.target.value)),
                            })
                          }
                          placeholder="مثلاً ۱"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono-num font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">نرخ / فی (ریال):</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.unitPriceIRR ? formatNumber(item.unitPriceIRR) : ''}
                          onChange={(e) =>
                            handleItemChange(idx, {
                              unitPriceIRR: parseFormattedNumber(e.target.value),
                            })
                          }
                          placeholder="مبلغ فی واحد (ریال)"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono-num font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 flex items-center justify-between font-mono-num font-extrabold text-xs">
                    <span className="font-sans text-teal-900">جمع کل این ردیف:</span>
                    <span className="text-teal-950 text-sm">{formatNumber(item.totalIRR)} ریال</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Payment Splits */}
          <MultiPaymentSplitsEditor
            title={
              invoiceType === 'sales'
                ? 'ثبت دریافت وجه فاکتور فروش (تک‌بانکی یا چند بانکی ترکیبی)'
                : 'ثبت پرداخت وجه فاکتور خرید (تک‌بانکی یا چند بانکی ترکیبی)'
            }
            subtitle="انتخاب بانک‌ها و صندوق‌هایی که تسویه از طریق آن‌ها انجام گرفته است."
            totalTargetIRR={grandTotalIRR}
            splits={payments}
            onChange={setPayments}
            banks={banks}
            currencies={currencies}
            mode={invoiceType === 'sales' ? 'receipt' : 'payment'}
            contactName={selectedContact?.name}
          />

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="توضیحات فاکتور (اختیاری)..."
              className="w-full sm:flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold"
            />

            <button
              type="submit"
              className={`w-full sm:w-auto px-7 py-3 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition ${
                invoiceType === 'sales'
                  ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {invoiceType === 'sales'
                ? 'ثبت نهایی فاکتور فروش + صدور سند'
                : 'ثبت نهایی فاکتور خرید + صدور سند'}
            </button>
          </div>
        </form>
      </div>

      {/* History List of Issued Invoices */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-xs sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            فهرست فاکتورهای صادرشده ({formatNumber(invoices.length)})
          </h3>
        </div>

        {/* نوار جستجوی فاکتورها */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={invoiceSearchQuery}
            onChange={(e) => setInvoiceSearchQuery(e.target.value)}
            placeholder="🔍 جستجوی شماره فاکتور، نام مشتری، تاریخ یا عنوان کالا/ارز..."
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition"
          />
          {invoiceSearchQuery && (
            <button
              type="button"
              onClick={() => setInvoiceSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
              {invoiceSearchQuery.trim()
                ? `فاکتوری منطبق با عبارت «${invoiceSearchQuery}» پیدا نشد.`
                : 'هنوز هیچ فاکتوری صادر نشده است.'}
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const paid = inv.paidAmountIRR ?? (inv.status === 'paid' ? inv.grandTotalIRR : 0);
              const rem = inv.remainingAmountIRR ?? Math.max(0, inv.grandTotalIRR - paid);

              return (
                <div
                  key={inv.id}
                  className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl p-4 space-y-3 transition shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num font-extrabold text-teal-800 text-sm">
                        {inv.invoiceNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold ${
                          inv.type === 'sales'
                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {inv.type === 'sales' ? 'فروش' : 'خرید'}
                      </span>
                      <span className="text-xs font-extrabold text-slate-900">{inv.contactName}</span>
                      <span className="text-xs text-slate-500 font-mono-num">{inv.date}</span>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        مشاهده فاکتور
                      </button>
                      {onUpdateInvoice && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(inv)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
                        >
                          ویرایش
                        </button>
                      )}
                      {onDeleteInvoice && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `آیا از حذف فاکتور ${inv.invoiceNumber} (طرف حساب: ${inv.contactName}) مطمئن هستید؟`
                              )
                            ) {
                              onDeleteInvoice(inv.id);
                            }
                          }}
                          className="p-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          title="حذف فاکتور"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200 font-mono-num font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">مبلغ کل فاکتور:</span>
                      <span className="text-slate-900">{formatNumber(inv.grandTotalIRR)} ریال</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">تسویه شده:</span>
                      <span className="text-emerald-700">{formatNumber(paid)} ریال</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">مانده حساب:</span>
                      <span className="text-amber-800">{formatNumber(rem)} ریال</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
