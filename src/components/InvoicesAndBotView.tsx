import React, { useMemo, useState } from 'react';
import {
  AccountingState,
  BotDeliveryLog,
  CurrencyCode,
  InvoiceItem,
  SalesInvoice,
} from '../types/accounting';
import {
  convertForeignToIRR,
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import {
  dispatchToMessengerBot,
  formatInvoiceBotMessage,
} from '../utils/botAndBackupService';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  FileSpreadsheet,
  Plus,
  Send,
  Printer,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface InvoicesAndBotViewProps {
  state: AccountingState;
  onIssueInvoice: (invoice: SalesInvoice) => void;
  onRecordBotLog: (log: BotDeliveryLog) => void;
}

export const InvoicesAndBotView: React.FC<InvoicesAndBotViewProps> = ({
  state,
  onIssueInvoice,
  onRecordBotLog,
}) => {
  const [contactId, setContactId] = useState(state.contacts[0]?.id || '');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(685000);
  const [date, setDate] = useState('1404/08/12');
  const [dueDate, setDueDate] = useState('1404/09/12');
  const [projectCode, setProjectCode] = useState('PRJ-1404-EX');
  const [notes, setNotes] = useState(
    'تسویه به ارز فاکتور یا معادل ریالی به نرخ توافقی روز واریز.'
  );
  const [selectedProductId, setSelectedProductId] = useState(state.products[0]?.id || '');
  const [qty, setQty] = useState<number>(2);
  const [unitPriceForeign, setUnitPriceForeign] = useState<number>(1300);
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    const firstProd = state.products[0];
    if (!firstProd) return [];
    const totalF = 2 * firstProd.defaultPriceForeign;
    const totalR = convertForeignToIRR(totalF, 685000, 'USD');
    return [
      {
        id: 'inv-itm-1',
        productId: firstProd.id,
        productSku: firstProd.sku,
        productName: firstProd.name,
        unit: firstProd.unit,
        quantity: 2,
        unitPriceForeign: firstProd.defaultPriceForeign,
        unitPriceIRR: convertForeignToIRR(firstProd.defaultPriceForeign, 685000, 'USD'),
        discountForeign: 0,
        discountIRR: 0,
        taxPercent: 0,
        totalForeign: totalF,
        totalIRR: totalR,
      },
    ];
  });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCurrencyChange = (newCurr: CurrencyCode) => {
    setCurrency(newCurr);
    const currObj = state.currencies.find((c) => c.code === newCurr);
    const newRate = currObj ? currObj.defaultRateToIRR : 1;
    setExchangeRate(newRate);

    // Recalculate existing items with new rate
    setItems((prev) =>
      prev.map((it) => {
        const uIRR = convertForeignToIRR(it.unitPriceForeign, newRate, newCurr);
        const tIRR = convertForeignToIRR(it.totalForeign, newRate, newCurr);
        return {
          ...it,
          unitPriceIRR: uIRR,
          totalIRR: tIRR,
        };
      })
    );
  };

  const handleRateChange = (newRate: number) => {
    setExchangeRate(newRate);
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        unitPriceIRR: convertForeignToIRR(it.unitPriceForeign, newRate, currency),
        totalIRR: convertForeignToIRR(it.totalForeign, newRate, currency),
      }))
    );
  };

  const handleAddItem = () => {
    const prod = state.products.find((p) => p.id === selectedProductId);
    if (!prod || qty <= 0) return;

    const totalForeign = Number((qty * unitPriceForeign).toFixed(2));
    const unitIRR = convertForeignToIRR(unitPriceForeign, exchangeRate, currency);
    const totalIRR = convertForeignToIRR(totalForeign, exchangeRate, currency);

    const newItem: InvoiceItem = {
      id: `itm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      productId: prod.id,
      productSku: prod.sku,
      productName: prod.name,
      unit: prod.unit,
      quantity: qty,
      unitPriceForeign,
      unitPriceIRR: unitIRR,
      discountForeign: 0,
      discountIRR: 0,
      taxPercent: 0,
      totalForeign,
      totalIRR,
    };

    setItems((prev) => [...prev, newItem]);
  };

  const totals = useMemo(() => {
    const grandForeign = items.reduce((s, i) => s + i.totalForeign, 0);
    const grandIRR = items.reduce((s, i) => s + i.totalIRR, 0);
    return {
      grandForeign: Number(grandForeign.toFixed(2)),
      grandIRR: Math.round(grandIRR),
    };
  }, [items]);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const contact = state.contacts.find((c) => c.id === contactId);
    if (!contact || items.length === 0) return;

    const nextInvNum = `INV-1404-${101 + state.invoices.length}`;
    const newInvoice: SalesInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvNum,
      type: 'sales',
      date,
      dueDate,
      contactId: contact.id,
      contactName: contact.name,
      currency,
      exchangeRate,
      convertToIRRInPrint: true,
      warehouseName: 'انبار مرکزی تهران',
      projectCode,
      items,
      subtotalForeign: totals.grandForeign,
      subtotalIRR: totals.grandIRR,
      totalDiscountForeign: 0,
      totalDiscountIRR: 0,
      totalTaxForeign: 0,
      totalTaxIRR: 0,
      grandTotalForeign: totals.grandForeign,
      grandTotalIRR: totals.grandIRR,
      status: 'issued',
      notes,
    };

    onIssueInvoice(newInvoice);
    setStatusMessage(
      `فاکتور فروش شماره ${nextInvNum} به مبلغ ${formatNumber(
        totals.grandForeign,
        2
      )} ${currency} (معادل ${formatNumber(
        totals.grandIRR
      )} ریال) صادر شد، موجودی انبار کسر گردید و سند حسابداری دوارزی آن به صورت خودکار ثبت شد.`
    );
  };

  const handleSendInvoiceToCustomerBot = async (
    invoice: SalesInvoice,
    platform: 'bale' | 'telegram'
  ) => {
    const contact = state.contacts.find((c) => c.id === invoice.contactId);
    const chatId =
      platform === 'bale'
        ? contact?.baleChatId || state.botConfig.baleDefaultChatId
        : contact?.telegramChatId || state.botConfig.telegramDefaultChatId;
    const token =
      platform === 'bale'
        ? state.botConfig.baleBotToken
        : state.botConfig.telegramBotToken;

    const text = formatInvoiceBotMessage(invoice, state.companyName);
    const log = await dispatchToMessengerBot({
      platform,
      botToken: token,
      chatId,
      recipientName: invoice.contactName,
      messageType: 'invoice',
      text,
      summary: `ارسال فاکتور فروش ارزی/ریالی شماره ${invoice.invoiceNumber} به مبلغ ${formatNumber(
        invoice.grandTotalForeign,
        2
      )} ${invoice.currency} (${formatNumber(invoice.grandTotalIRR)} ریال) به مشتری`,
    });

    onRecordBotLog(log);
    setStatusMessage(
      `فاکتور شماره ${invoice.invoiceNumber} (همراه با جزئیات ارزی ${invoice.currency} و معادل ریالی) از طریق ربات ${
        platform === 'bale' ? 'بله (Bale)' : 'تلگرام (Telegram)'
      } برای مشتری «${invoice.contactName}» (شناسه: ${chatId}) ارسال شد.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            صدور فاکتور فروش رسمی (ریالی و ارزی) و ارسال آنی به مشتری از طریق بات بله و تلگرام
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            صدور همزمان فاکتور به ریال یا ارز خارجی (دلار، درهم، یوان، یورو) با ثبت خودکار سند حسابداری، حواله خروج انبار و ارسال به تلگرام/بله مشتری.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs underline"
          >
            بستن
          </button>
        </div>
      )}

      {/* Invoice Creation Form */}
      <form
        onSubmit={handleCreateInvoice}
        className="bg-white border border-slate-200 rounded-lg p-5 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              انتخاب مشتری (طرف حساب)
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              aria-label="انتخاب مشتری فاکتور"
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded"
            >
              {state.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (چت بله: {c.baleChatId || 'پیش‌فرض'} | تلگرام: {c.telegramChatId || 'پیش‌فرض'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ارز فاکتور (ریالی / ارزی)
            </label>
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              aria-label="ارز فاکتور"
              className="w-full px-3 py-2 text-xs font-mono-num font-bold bg-white border border-slate-300 rounded"
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
              نرخ تبدیل ارز به ریال
            </label>
            <FormattedNumberInput
              disabled={currency === 'IRR'}
              value={exchangeRate}
              allowDecimals={false}
              onChange={(val) => handleRateChange(val || 1)}
              ariaLabel="نرخ تبدیل ارز فاکتور"
              className="w-full px-3 py-2 text-xs font-bold bg-amber-50/60 border border-amber-300 rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              کد پروژه / مرکز هزینه
            </label>
            <input
              type="text"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              aria-label="کد پروژه"
              className="w-full px-3 py-2 text-xs font-mono-num bg-white border border-slate-300 rounded"
            />
          </div>
        </div>

        {/* Add Product Item Row */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              انتخاب کالا / قطعه از انبار (موجودی لحظه‌ای)
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                const pid = e.target.value;
                setSelectedProductId(pid);
                const prod = state.products.find((p) => p.id === pid);
                if (prod) {
                  setUnitPriceForeign(
                    currency === 'IRR' ? prod.defaultPriceIRR : prod.defaultPriceForeign
                  );
                }
              }}
              aria-label="انتخاب کالا از انبار"
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded"
            >
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name} (موجودی: {p.stockQty} {p.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              تعداد / مقدار
            </label>
            <FormattedNumberInput
              value={qty}
              allowDecimals={false}
              onChange={(val) => setQty(val || 1)}
              ariaLabel="تعداد کالا"
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              فی واحد ({currency}) — {currency === 'IRR' ? 'بدون اعشار' : 'با اعشار'}
            </label>
            <FormattedNumberInput
              value={unitPriceForeign}
              allowDecimals={currency !== 'IRR'}
              onChange={(val) => setUnitPriceForeign(val)}
              ariaLabel="فی واحد کالا"
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2 px-3 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              افزودن قلم کالا
            </button>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-2 px-3">کد کالا (SKU)</th>
                <th className="py-2 px-3">شرح کالا / قطعه</th>
                <th className="py-2 px-3 text-center">تعداد</th>
                <th className="py-2 px-3 text-left">فی واحد ({currency})</th>
                <th className="py-2 px-3 text-left">فی معادل (ریال)</th>
                <th className="py-2 px-3 text-left bg-emerald-50">جمع کل ({currency})</th>
                <th className="py-2 px-3 text-left bg-blue-50">جمع کل معادل (ریال)</th>
                <th className="py-2 px-3 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 px-3 font-mono-num text-slate-600">{item.productSku}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{item.productName}</td>
                  <td className="py-2 px-3 font-mono-num text-center font-bold">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2 px-3 font-mono-num text-left">
                    {formatNumber(item.unitPriceForeign, currency === 'IRR' ? 0 : 2)}
                  </td>
                  <td className="py-2 px-3 font-mono-num text-left">
                    {formatNumber(item.unitPriceIRR)}
                  </td>
                  <td className="py-2 px-3 font-mono-num text-left font-bold bg-emerald-50/40 text-emerald-950">
                    {formatNumber(item.totalForeign, currency === 'IRR' ? 0 : 2)} {currency}
                  </td>
                  <td className="py-2 px-3 font-mono-num text-left font-bold bg-blue-50/40 text-blue-950">
                    {formatNumber(item.totalIRR)} ریال
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => prev.filter((i) => i.id !== item.id))
                      }
                      aria-label={`حذف قلم ${item.productName}`}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500 ml-1">مبلغ کل ارزی فاکتور:</span>
              <strong className="font-mono-num text-sm text-emerald-800">
                {formatNumber(totals.grandForeign, currency === 'IRR' ? 0 : 2)} {currency}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 ml-1">مبلغ کل معادل ریالی:</span>
              <strong className="font-mono-num text-sm text-blue-900">
                {formatNumber(totals.grandIRR)} ریال
              </strong>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            صدور قطعی فاکتور، ثبت سند خودکار و کسر موجودی انبار
          </button>
        </div>
      </form>

      {/* Issued Invoices List with Direct Bot Dispatch */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          فاکتورهای فروش صادر شده (آماده ارسال مستقیم به بله و تلگرام مشتری)
        </h3>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-2.5 px-3">شماره فاکتور</th>
                <th className="py-2.5 px-3">تاریخ</th>
                <th className="py-2.5 px-3">نام مشتری</th>
                <th className="py-2.5 px-3">ارز و نرخ تبدیل</th>
                <th className="py-2.5 px-3 text-left">مبلغ ارزی فاکتور</th>
                <th className="py-2.5 px-3 text-left">معادل قطعی به ریال</th>
                <th className="py-2.5 px-3 text-center">ارسال فاکتور به مشتری با بات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {state.invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono-num font-bold text-blue-700">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num">{inv.date}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{inv.contactName}</td>
                  <td className="py-2.5 px-3 font-mono-num text-slate-600">
                    {inv.currency} (نرخ: {formatNumber(inv.exchangeRate)})
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-bold text-emerald-800">
                    {formatNumber(inv.grandTotalForeign, inv.currency === 'IRR' ? 0 : 2)}{' '}
                    {inv.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-left font-bold text-slate-900">
                    {formatNumber(inv.grandTotalIRR)} ریال
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendInvoiceToCustomerBot(inv, 'bale')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        ارسال به بله مشتری
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendInvoiceToCustomerBot(inv, 'telegram')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-sky-700 hover:bg-sky-800 text-white rounded flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        ارسال به تلگرام مشتری
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="p-1 text-slate-500 hover:text-slate-900"
                        aria-label={`چاپ فاکتور ${inv.invoiceNumber}`}
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
