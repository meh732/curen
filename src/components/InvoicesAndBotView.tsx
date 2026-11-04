import React, { useState } from 'react';
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
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-1404-${102 + invoices.length}`);
  const [date, setDate] = useState('1404/08/12');
  const [contactId, setContactId] = useState(contacts[0]?.id || '');
  const [notes, setNotes] = useState('');

  // تعریف سریع شخص جدید
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // اقلام فاکتور
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'item-1',
      productId: products[0]?.id || '',
      productSku: products[0]?.sku || 'ITEM-1',
      productName: products[0]?.name || '',
      unit: products[0]?.unit || 'عدد',
      quantity: 1,
      unitPriceForeign: products[0]?.defaultPriceIRR || 0,
      unitPriceIRR: products[0]?.defaultPriceIRR || 0,
      discountForeign: 0,
      discountIRR: 0,
      taxPercent: 0,
      totalForeign: products[0]?.defaultPriceIRR || 0,
      totalIRR: products[0]?.defaultPriceIRR || 0,
    },
  ]);

  // ردیف‌های دریافت یا پرداخت ترکیبی چند بانکی / چند صندوقی
  const [payments, setPayments] = useState<PaymentSplitLine[]>([]);

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
        updated.unit = 'عدد';
      } else {
        const prod = products.find((p) => p.id === patch.productId);
        if (prod) {
          updated.productSku = prod.sku;
          updated.productName = prod.name;
          updated.unit = prod.unit;
          updated.unitPriceIRR = prod.defaultPriceIRR;
        }
      }
    }

    next[index] = recalcRow(updated);
    setItems(next);
  };

  const addItem = () => {
    const firstProd = products[0];
    setItems([
      ...items,
      recalcRow({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        productId: firstProd?.id || '__custom__',
        productSku: firstProd?.sku || 'CUSTOM',
        productName: firstProd?.name || '',
        unit: firstProd?.unit || 'عدد',
        quantity: 1,
        unitPriceForeign: firstProd?.defaultPriceIRR || 0,
        unitPriceIRR: firstProd?.defaultPriceIRR || 0,
        discountForeign: 0,
        discountIRR: 0,
        taxPercent: 0,
        totalForeign: 0,
        totalIRR: 0,
      }),
    ]);
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
    const newC: Contact = {
      id: `cnt-${Date.now()}`,
      code: `P-${1006 + contacts.length}`,
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

    if (editingInvoiceId && onUpdateInvoice) {
      const existing = invoices.find((i) => i.id === editingInvoiceId);
      const updatedInvoice: SalesInvoice = {
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
      onUpdateInvoice(updatedInvoice);
      setEditingInvoiceId(null);
    } else {
      const newInvoice: SalesInvoice = {
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

      onIssueInvoice(newInvoice);
    }

    setInvoiceNumber(`INV-1404-${103 + invoices.length}`);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingInvoiceId(null);
    setInvoiceNumber(`INV-1404-${103 + invoices.length}`);
    setPayments([]);
    setNotes('');
  };

  const handlePrintInvoices = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* فرم صدور فاکتور خرید و فروش با تسویه ترکیبی */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {invoiceType === 'sales' ? (
                <ShoppingBag className="w-5 h-5 text-teal-400" />
              ) : (
                <ShoppingCart className="w-5 h-5 text-amber-400" />
              )}
              {editingInvoiceId ? 'ویرایش و اصلاح فاکتور معامله ارزی' : 'ثبت فاکتور معامله ارزی (خرید و فروش ارز به عنوان موضوع معامله)'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {editingInvoiceId
                ? 'در حال اصلاح اقلام ارزی، نرخ معامله یا نحوه تسویه بانکی این معامله هستید. پس از تغییرات دکمه ذخیره اصلاحات را بزنید.'
                : 'ارز مورد معامله (دلار، یورو، درهم، یوان و...) را انتخاب کنید و مشخص کنید پول آن از کدام بانک‌ها یا صندوق‌ها (ریالی یا ارزی به عنوان ابزار تسویه) دریافت یا پرداخت شده است.'}
            </p>
            {editingInvoiceId && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
                  در حال ویرایش فاکتور: {invoiceNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  انصراف از ویرایش
                </button>
              </div>
            )}
          </div>

          {/* سوییچ فروش یا خرید */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleInvoiceTypeChange('sales')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                invoiceType === 'sales'
                  ? 'bg-teal-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              فاکتور فروش (دریافت وجه / طلب)
            </button>
            <button
              type="button"
              onClick={() => handleInvoiceTypeChange('purchase')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                invoiceType === 'purchase'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              فاکتور خرید (پرداخت وجه / بدهی)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* مشخصات سربرگ فاکتور */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">شماره فاکتور</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">تاریخ فاکتور</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">
                  {invoiceType === 'sales' ? 'نام مشتری / خریدار' : 'نام فروشنده / تأمین‌کننده'}
                </label>
                {onAddContact && (
                  <button
                    type="button"
                    onClick={() => setShowQuickContact(!showQuickContact)}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    + تعریف سریع شخص جدید
                  </button>
                )}
              </div>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || 'بدون تلفن'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* فرم بازشوی تعریف سریع شخص */}
          {showQuickContact && (
            <div className="bg-slate-950 border border-teal-500/40 rounded-xl p-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] text-teal-300 mb-1">نام کامل شخص یا شرکت</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="مثلاً: علی رضایی"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div className="w-48">
                <label className="block text-[11px] text-slate-400 mb-1">شماره تماس (اختیاری)</label>
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="0912..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono-num"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickCreateContact}
                className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                ذخیره و انتخاب شخص
              </button>
            </div>
          )}

          {/* جدول اقلام کالا یا خدمات */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-teal-400" />
                اقلام معامله (ارزها، اسکناس و حواله‌ها)
              </span>
              <button
                type="button"
                onClick={addItem}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-teal-400 px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                افزودن ردیف ارز / معامله
              </button>
            </div>

            {/* Mobile Cards for Phone Screens */}
            <div className="sm:hidden space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3 relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-teal-400">
                      ردیف {idx + 1}: موضوع معامله
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1 flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      انتخاب ارز یا کالا
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemChange(idx, { productId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (موجودی: {p.stockQty} {p.unit})
                        </option>
                      ))}
                      <option value="__custom__">✏️ نام دلخواه ارز / خدمات...</option>
                    </select>
                    {item.productId === '__custom__' && (
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, { productName: e.target.value })}
                        placeholder="شرح معامله را بنویسید..."
                        className="w-full bg-slate-900 border border-teal-500/40 rounded-lg p-2 mt-1.5 text-xs text-white"
                        required
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">مقدار / تعداد</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity ? formatNumber(item.quantity) : ''}
                        onChange={(e) =>
                          handleItemChange(idx, {
                            quantity: Math.max(0, parseFormattedNumber(e.target.value)),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        نرخ / فی (ریال)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.unitPriceIRR ? formatNumber(item.unitPriceIRR) : ''}
                        onChange={(e) =>
                          handleItemChange(idx, {
                            unitPriceIRR: parseFormattedNumber(e.target.value),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono-num"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        تخفیف (ریال)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.discountIRR ? formatNumber(item.discountIRR) : ''}
                        onChange={(e) =>
                          handleItemChange(idx, {
                            discountIRR: parseFormattedNumber(e.target.value),
                          })
                        }
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        کارمزد/مالیات (%)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.taxPercent ? formatNumber(item.taxPercent) : '0'}
                        onChange={(e) =>
                          handleItemChange(idx, {
                            taxPercent: parseFormattedNumber(e.target.value),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono-num"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-teal-500/30 rounded-lg p-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">جمع این ردیف:</span>
                    <span className="font-bold text-teal-400 font-mono-num">
                      {formatNumber(item.totalIRR)} ریال
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 min-w-[220px]">انتخاب ارز یا موضوع معامله</th>
                    <th className="p-2.5 w-24">مقدار ارز</th>
                    <th className="p-2.5 w-40">نرخ / فی (ریال)</th>
                    <th className="p-2.5 w-36">تخفیف (ریال)</th>
                    <th className="p-2.5 w-24">کارمزد/مالیات (%)</th>
                    <th className="p-2.5 w-40">جمع کل ردیف (ریال)</th>
                    <th className="p-2.5 w-12 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="bg-slate-950/40">
                      <td className="p-2">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={item.productId}
                            onChange={(e) =>
                              handleItemChange(idx, { productId: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (موجودی: {p.stockQty} {p.unit})
                              </option>
                            ))}
                            <option value="__custom__">✏️ وارد کردن نام دلخواه کالا / خدمات...</option>
                          </select>
                          {item.productId === '__custom__' && (
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) =>
                                handleItemChange(idx, { productName: e.target.value })
                              }
                              placeholder="نام کالا یا شرح خدمات را بنویسید..."
                              className="w-full bg-slate-950 border border-teal-500/40 rounded px-2 py-1 text-white"
                              required
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.quantity ? formatNumber(item.quantity) : ''}
                          onChange={(e) =>
                            handleItemChange(idx, {
                              quantity: Math.max(0, parseFormattedNumber(e.target.value)),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono-num"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.unitPriceIRR ? formatNumber(item.unitPriceIRR) : ''}
                          onChange={(e) =>
                            handleItemChange(idx, {
                              unitPriceIRR: parseFormattedNumber(e.target.value),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono-num"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.discountIRR ? formatNumber(item.discountIRR) : ''}
                          onChange={(e) =>
                            handleItemChange(idx, {
                              discountIRR: parseFormattedNumber(e.target.value),
                            })
                          }
                          placeholder="0"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono-num"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.taxPercent ? formatNumber(item.taxPercent) : '0'}
                          onChange={(e) =>
                            handleItemChange(idx, {
                              taxPercent: parseFormattedNumber(e.target.value),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono-num"
                        />
                      </td>
                      <td className="p-2 font-mono-num font-bold text-teal-400">
                        {formatNumber(item.totalIRR)} ریال
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* بخش دریافت و پرداخت ترکیبی چند بانکی و چند صندوقی (با قابلیت پرداخت ارزی) */}
          <MultiPaymentSplitsEditor
            title={
              invoiceType === 'sales'
                ? 'ثبت دریافت وجه این فاکتور فروش (تک‌بانکی یا ترکیبی چند بانکی / چند صندوقی / ارزی)'
                : 'ثبت پرداخت وجه این فاکتور خرید (تک‌بانکی یا ترکیبی چند بانکی / چند صندوقی / ارزی)'
            }
            subtitle={
              invoiceType === 'sales'
                ? 'می‌توانید کل یا بخشی از مبلغ فاکتور را به یک یا چند بانک و صندوق واریز کنید. اگر مشتری ارز داده، نوع ارز و ارزش ریالی آن را مشخص کنید تا اتوماتیک سند بخورد.'
                : 'می‌توانید کل یا بخشی از مبلغ فاکتور خرید را از یک یا چند بانک و صندوق پرداخت کنید. اگر ارز پرداخت کرده‌اید، ارزش ریالی آن را تعیین کنید.'
            }
            totalTargetIRR={grandTotalIRR}
            splits={payments}
            onChange={setPayments}
            banks={banks}
            currencies={currencies}
            mode={invoiceType === 'sales' ? 'receipt' : 'payment'}
            contactName={selectedContact?.name}
          />

          {/* توضیحات و دکمه ثبت نهایی */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800">
            <div className="flex-1 min-w-[260px]">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیحات فاکتور (اختیاری)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-lg cursor-pointer ${
                invoiceType === 'sales'
                  ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {invoiceType === 'sales'
                ? 'ثبت نهایی فاکتور فروش + سند اتوماتیک بانک و شخص'
                : 'ثبت نهایی فاکتور خرید + سند اتوماتیک بانک و شخص'}
            </button>
          </div>
        </form>
      </div>

      {/* لیست فاکتورهای صادر شده به همراه جزئیات پرداخت‌های ترکیبی */}
      <div
        id="invoices-history-print"
        className="bg-slate-900/60 border border-slate-800 rounded-xl p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            فهرست فاکتورهای خرید و فروش ثبت‌شده ({formatNumber(invoices.length)})
          </h3>
          <button
            type="button"
            onClick={handlePrintInvoices}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-teal-400" />
            چاپ / PDF لیست فاکتورها
          </button>
        </div>

        <div className="space-y-3">
          {invoices.map((inv) => {
            const paid = inv.paidAmountIRR ?? (inv.status === 'paid' ? inv.grandTotalIRR : 0);
            const rem = inv.remainingAmountIRR ?? Math.max(0, inv.grandTotalIRR - paid);

            return (
              <div
                key={inv.id}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono-num font-bold text-teal-400 text-sm">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                        inv.type === 'sales'
                          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {inv.type === 'sales' ? 'فروش کالا/خدمات' : 'خرید کالا/خدمات'}
                    </span>
                    <span className="text-sm font-bold text-white">{inv.contactName}</span>
                    <span className="text-xs text-slate-400 font-mono-num">{inv.date}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        inv.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : inv.status === 'partial'
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {inv.status === 'paid'
                        ? 'تسویه کامل'
                        : inv.status === 'partial'
                        ? 'تسویه بخشی (ترکیبی)'
                        : 'نسیه (در حساب شخص)'}
                    </span>
                    {onUpdateInvoice && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(inv)}
                        className="text-teal-400 hover:text-teal-300 p-1 rounded hover:bg-teal-500/10 cursor-pointer text-xs flex items-center gap-1"
                        title="ویرایش و اصلاح این فاکتور"
                      >
                        ویرایش
                      </button>
                    )}
                    {onDeleteInvoice && (
                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(inv.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                        title="حذف فاکتور و سند مربوطه"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* خلاصه ارقام فاکتور */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">مبلغ کل فاکتور:</span>
                    <span className="font-bold text-white font-mono-num">
                      {formatNumber(inv.grandTotalIRR)} ریال
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {inv.type === 'sales'
                        ? 'دریافت‌شده (بانک/صندوق):'
                        : 'پرداخت‌شده (بانک/صندوق):'}
                    </span>
                    <span className="font-bold text-emerald-400 font-mono-num">
                      {formatNumber(paid)} ریال
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">مانده در حساب شخص:</span>
                    <span className="font-bold text-amber-400 font-mono-num">
                      {formatNumber(rem)} ریال
                    </span>
                  </div>
                </div>

                {/* نمایش ریز پرداخت‌های ترکیبی اگر وجود داشته باشد */}
                {inv.payments && inv.payments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-teal-400" />
                      ریز اسناد اتوماتیک بانک و صندوق:
                    </span>
                    {inv.payments.map((p) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200 font-mono-num"
                      >
                        {p.bankName}:{' '}
                        {p.currency === 'IRR'
                          ? `${formatNumber(p.amountIRR)} ریال`
                          : `${formatNumber(p.amountForeign)} ${p.currency} (به ارزش ${formatNumber(
                              p.exchangeRate
                            )} = ${formatNumber(p.amountIRR)} ریال)`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
