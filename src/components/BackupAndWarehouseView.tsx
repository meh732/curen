import React, { useState } from 'react';
import {
  AccountingState,
  BotConfig,
  BotDeliveryLog,
  InventoryMovement,
} from '../types/accounting';
import {
  convertForeignToIRR,
  formatCurrencyAmount,
  formatNumber,
} from '../utils/accountingEngine';
import {
  dispatchToMessengerBot,
  triggerBackupFileDownload,
} from '../utils/botAndBackupService';
import {
  downloadNativeWindowsAccountingExePackage,
} from '../utils/nativeWindowsExeBuilder';
import { FormattedNumberInput } from './FormattedNumberInput';
import {
  DatabaseBackup,
  Send,
  Download,
  Upload,
  Package,
  Monitor,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  FileDown,
} from 'lucide-react';

interface BackupAndWarehouseViewProps {
  state: AccountingState;
  onUpdateBotConfig: (patch: Partial<BotConfig>) => void;
  onRecordBotLog: (log: BotDeliveryLog) => void;
  onRestoreFullBackup: (restoredState: AccountingState) => void;
  onRecordInventoryMovement: (movement: InventoryMovement) => void;
}

export const BackupAndWarehouseView: React.FC<BackupAndWarehouseViewProps> = ({
  state,
  onUpdateBotConfig,
  onRecordBotLog,
  onRestoreFullBackup,
  onRecordInventoryMovement,
}) => {
  const [section, setSection] = useState<'backup_bot' | 'warehouse' | 'windows_launcher'>('backup_bot');
  const [notice, setNotice] = useState<string | null>(null);

  // Warehouse movement form state
  const [movType, setMovType] = useState<'inbound' | 'outbound'>('inbound');
  const [movProductId, setMovProductId] = useState(state.products[0]?.id || '');
  const [movQty, setMovQty] = useState<number>(5);
  const [movProject, setMovProject] = useState('PRJ-1404-WH');
  const [movRef, setMovRef] = useState('WH-DOC-809');
  const [movNotes, setMovNotes] = useState('');

  const handleFullBackupAndBotSend = async (platform: 'bale' | 'telegram' | 'both') => {
    const summaryText =
      `📦 *بکاپ کامل خودکار سیستم جامع حسابداری دوارزی ترازبان*\n` +
      `🏢 شرکت: ${state.companyName} (${state.fiscalYear})\n` +
      `📊 محتویات بکاپ کامل:\n` +
      `• تعداد اسناد حسابداری دوارزی: ${state.vouchers.length} سند\n` +
      `• تعداد فاکتورهای فروش ارزی/ریالی: ${state.invoices.length} فاکتور\n` +
      `• تعداد طرف حساب‌ها (اشخاص): ${state.contacts.length} شخص\n` +
      `• تعداد بانک‌ها و صرافی‌ها: ${state.banks.length} حساب\n` +
      `• تعداد کالاها و قطعات انبار: ${state.products.length} قلم کالا\n` +
      `• تعداد سرفصل‌های استاندارد: ${state.accounts.length} حساب\n` +
      `✅ فایل JSON کامل دیتابیس نیز بر روی سیستم ویندوز ذخیره گردید.`;

    triggerBackupFileDownload(state, 'TarazBan_Full_System_Backup');

    const platforms: ('bale' | 'telegram')[] =
      platform === 'both' ? ['bale', 'telegram'] : [platform];

    for (const p of platforms) {
      const log = await dispatchToMessengerBot({
        platform: p,
        botToken:
          p === 'bale' ? state.botConfig.baleBotToken : state.botConfig.telegramBotToken,
        chatId:
          p === 'bale'
            ? state.botConfig.baleDefaultChatId
            : state.botConfig.telegramDefaultChatId,
        recipientName:
          p === 'bale' ? 'بازوی پشتیبان‌گیر بله (Bale Bot)' : 'ربات پشتیبان‌گیر تلگرام (Telegram Bot)',
        messageType: 'backup',
        text: summaryText,
        summary: `ارسال بکاپ کامل کل سیستم (${state.vouchers.length} سند، ${state.invoices.length} فاکتور، ${state.contacts.length} شخص، بانک‌ها و انبار) به ربات ${
          p === 'bale' ? 'بله' : 'تلگرام'
        }`,
      });
      onRecordBotLog(log);
    }

    onUpdateBotConfig({
      lastBackupTime: `1404/08/12 - ${new Date().toTimeString().slice(0, 8)}`,
    });

    setNotice(
      `فایل بکاپ کامل از تمام بخش‌های نرم‌افزار (اسناد، اشخاص، بانک‌ها، نرخ ارزها، فاکتورها و انبار) دانلود شد و همزمان به ربات ${
        platform === 'both' ? 'بله و تلگرام' : platform === 'bale' ? 'بله' : 'تلگرام'
      } ارسال گردید.`
    );
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.target?.result));
        const candidate: AccountingState = parsed.data || parsed;
        if (candidate && Array.isArray(candidate.vouchers) && Array.isArray(candidate.accounts)) {
          onRestoreFullBackup(candidate);
          setNotice('بکاپ کامل با موفقیت بازیابی (Restore) شد و تمامی اطلاعات بروزرسانی گردید.');
        }
      } catch {
        setNotice('فرمت فایل بکاپ انتخابی معتبر نیست.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadWindowsLauncher = () => {
    const batScript = `@echo off
chcp 65001 > nul
title TarazBan Enterprise Multi-Currency Accounting (Windows Desktop Edition)
echo ============================================================================
echo   نرم افزار جامع حسابداری دوارزی و بازرگانی ترازبان - نسخه دسکتاپ ویندوز
echo ============================================================================
echo Starting local Windows Accounting App Window...
start msedge --app="%~dp0index.html" --window-size=1440,900
exit
`;
    const blob = new Blob([batScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Run_TarazBan_Windows_Desktop.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice('اسکریپت اجرای مستقیم ویندوز (Run_TarazBan_Windows_Desktop.bat) دانلود شد.');
  };

  const handleSubmitWarehouseMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = state.products.find((p) => p.id === movProductId);
    if (!prod || movQty <= 0) return;

    const currObj = state.currencies.find((c) => c.code === prod.defaultCurrency);
    const rate = currObj ? currObj.defaultRateToIRR : 1;

    const mov: InventoryMovement = {
      id: `mov-${Date.now()}`,
      date: '1404/08/12',
      productId: prod.id,
      productSku: prod.sku,
      productName: prod.name,
      type: movType,
      quantity: movQty,
      unitPriceForeign: prod.defaultPriceForeign,
      currency: prod.defaultCurrency,
      exchangeRate: rate,
      unitPriceIRR: convertForeignToIRR(prod.defaultPriceForeign, rate, prod.defaultCurrency),
      referenceDoc: movRef.trim() || 'WH-1404',
      projectCode: movProject.trim() || 'PRJ-MAIN',
      warehouseName: prod.warehouseLocation,
      notes: movNotes.trim() || (movType === 'inbound' ? 'رسید ورود مستقیم به انبار' : 'حواله خروج قطعه از انبار'),
    };

    onRecordInventoryMovement(mov);
    setMovNotes('');
    setNotice(
      `${movType === 'inbound' ? 'رسید ورود به انبار' : 'حواله خروج از انبار'} برای کالای «${
        prod.name
      }» به تعداد ${movQty} ${prod.unit} ثبت شد و موجودی لحظه‌ای انبار بروزرسانی گردید.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            بکاپ کامل خودکار، اتصال به ربات بله و تلگرام، انبار لحظه‌ای و لانچر ویندوز
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            پشتیبان‌گیری اتوماتیک از تمامی جداول حسابداری و ارسال مستقیم به بازوی بله (Bale) و ربات تلگرام (Telegram) به همراه ردیابی دقیق موجودی قطعات انبار.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setSection('backup_bot')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              section === 'backup_bot'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            بکاپ اتوماتیک و ربات بله / تلگرام
          </button>
          <button
            type="button"
            onClick={() => setSection('warehouse')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              section === 'warehouse'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            کاردکس موجودی لحظه‌ای انبار و پروژه
          </button>
          <button
            type="button"
            onClick={() => setSection('windows_launcher')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              section === 'windows_launcher'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تنظیمات اجرایی نسخه دسکتاپ ویندوز
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs underline"
          >
            بستن
          </button>
        </div>
      )}

      {/* 1. Automatic Full Backup & Bale/Telegram Bot Integration */}
      {section === 'backup_bot' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Bot Credentials & Auto-Backup Settings */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DatabaseBackup className="w-4 h-4 text-blue-700" />
                پیکربندی بکاپ اتوماتیک و اتصال به ربات بله (Bale) و تلگرام (Telegram)
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950">
                      ۱. تنظیمات بازوی پیام‌رسان بله (Bale Bot API)
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.botConfig.baleEnabled}
                        onChange={(e) =>
                          onUpdateBotConfig({ baleEnabled: e.target.checked })
                        }
                      />
                      <span>فعال</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      توکن بازوی بله (Bale Bot Token)
                    </label>
                    <input
                      type="text"
                      value={state.botConfig.baleBotToken}
                      onChange={(e) =>
                        onUpdateBotConfig({ baleBotToken: e.target.value })
                      }
                      aria-label="توکن بازوی بله"
                      className="w-full px-2.5 py-1.5 font-mono-num bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      شناسه چت مدیر مالی در بله (جهت دریافت بکاپ خودکار)
                    </label>
                    <input
                      type="text"
                      value={state.botConfig.baleDefaultChatId}
                      onChange={(e) =>
                        onUpdateBotConfig({ baleDefaultChatId: e.target.value })
                      }
                      aria-label="شناسه چت بله"
                      className="w-full px-2.5 py-1.5 font-mono-num bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-950">
                      ۲. تنظیمات ربات تلگرام (Telegram Bot API)
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.botConfig.telegramEnabled}
                        onChange={(e) =>
                          onUpdateBotConfig({ telegramEnabled: e.target.checked })
                        }
                      />
                      <span>فعال</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      توکن ربات تلگرام (Telegram Bot Token)
                    </label>
                    <input
                      type="text"
                      value={state.botConfig.telegramBotToken}
                      onChange={(e) =>
                        onUpdateBotConfig({ telegramBotToken: e.target.value })
                      }
                      aria-label="توکن ربات تلگرام"
                      className="w-full px-2.5 py-1.5 font-mono-num bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      شناسه چت مدیر مالی در تلگرام (Chat ID)
                    </label>
                    <input
                      type="text"
                      value={state.botConfig.telegramDefaultChatId}
                      onChange={(e) =>
                        onUpdateBotConfig({ telegramDefaultChatId: e.target.value })
                      }
                      aria-label="شناسه چت تلگرام"
                      className="w-full px-2.5 py-1.5 font-mono-num bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.botConfig.autoBackupOnVoucherSave}
                      onChange={(e) =>
                        onUpdateBotConfig({
                          autoBackupOnVoucherSave: e.target.checked,
                        })
                      }
                    />
                    <span>بکاپ اتوماتیک لحظه‌ای پس از ثبت هر سند یا فاکتور</span>
                  </label>
                  <span className="font-mono-num text-slate-500">
                    آخرین بکاپ: {state.botConfig.lastBackupTime || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Instant Full Backup & Restore Actions */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                عملیات پشتیبان‌گیری کامل (Full Backup) از کل سیستم و ارسال به بات
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                بکاپ کامل شامل ۱۰۰٪ اطلاعات سیستم (تمامی اسناد حسابداری ریالی و ارزی، نرخ ارزها، سرفصل‌ها، اشخاص، بانک‌ها، ردیف‌های مغایرت بانکی، فاکتورهای فروش و کاردکس موجودی انبار) در قالب یک فایل یکپارچه است.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleFullBackupAndBotSend('both')}
                  className="p-3 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  تهیه بکاپ کامل + ارسال به بله و تلگرام
                </button>

                <button
                  type="button"
                  onClick={() => triggerBackupFileDownload(state)}
                  className="p-3 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  دانلود مستقیم فایل بکاپ کامل (JSON)
                </button>

                <button
                  type="button"
                  onClick={() => handleFullBackupAndBotSend('bale')}
                  className="p-3 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  ارسال فوری بکاپ کامل به بازوی بله
                </button>

                <button
                  type="button"
                  onClick={() => handleFullBackupAndBotSend('telegram')}
                  className="p-3 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  ارسال فوری بکاپ کامل به ربات تلگرام
                </button>
              </div>

              <div className="border-t border-slate-200 pt-4 mt-4">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  بازیابی اطلاعات از فایل بکاپ (Full Restore):
                </label>
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50">
                  <Upload className="w-4 h-4 text-blue-700" />
                  <span>انتخاب فایل JSON بکاپ جهت بازگردانی کامل اطلاعات</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileRestore}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Bot Delivery Logs Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              تاریخچه ارسال بکاپ‌ها، فاکتورها و صورتحساب‌ها به ربات بله و تلگرام
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-2 px-3">زمان ارسال</th>
                    <th className="py-2 px-3">پیام‌رسان</th>
                    <th className="py-2 px-3">گیرنده / شناسه چت</th>
                    <th className="py-2 px-3">نوع داده ارسالی</th>
                    <th className="py-2 px-3">شرح عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.botLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono-num text-slate-600">
                        {log.timestamp}
                      </td>
                      <td className="py-2 px-3 font-bold">
                        {log.platform === 'bale' ? (
                          <span className="text-emerald-800">بله (Bale Bot)</span>
                        ) : (
                          <span className="text-sky-800">تلگرام (Telegram Bot)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-medium">
                        {log.recipientName} ({log.recipientChatId})
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {log.messageType === 'backup'
                          ? 'بکاپ کامل سیستم'
                          : log.messageType === 'invoice'
                          ? 'فاکتور فروش ارزی/ریالی'
                          : log.messageType === 'statement_rial'
                          ? 'صورتحساب ریالی شخص'
                          : 'صورتحساب ارزی شخص'}
                      </td>
                      <td className="py-2 px-3 text-slate-800">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Real-Time Warehouse & Inventory Tracking */}
      {section === 'warehouse' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-700" />
                موجودی لحظه‌ای کالاها و قطعات انبار (ارزیابی ارزی و ریالی)
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                      <th className="py-2.5 px-3">کد قطعه (SKU)</th>
                      <th className="py-2.5 px-3">شرح کالا / قطعه</th>
                      <th className="py-2.5 px-3">موقعیت انبار</th>
                      <th className="py-2.5 px-3 text-center">موجودی دقیق</th>
                      <th className="py-2.5 px-3 text-left">ارزش واحد ارزی</th>
                      <th className="py-2.5 px-3 text-left">ارزش کل موجودی (ریال)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {state.products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono-num font-bold text-blue-800">
                          {p.sku}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.warehouseLocation}</td>
                        <td className="py-2.5 px-3 font-mono-num text-center font-extrabold text-slate-900">
                          {p.stockQty} {p.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left">
                          {formatNumber(p.defaultPriceForeign, 2)} {p.defaultCurrency}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-left font-bold text-slate-900">
                          {formatNumber(p.stockQty * p.defaultPriceIRR)} ریال
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <form
              onSubmit={handleSubmitWarehouseMovement}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-4 h-fit"
            >
              <h3 className="text-base font-bold text-slate-900">
                ثبت رسید ورود / حواله خروج قطعه از انبار
              </h3>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovType('inbound')}
                    className={`py-2 px-3 rounded font-bold flex items-center justify-center gap-1.5 border ${
                      movType === 'inbound'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    رسید ورود (Inbound)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovType('outbound')}
                    className={`py-2 px-3 rounded font-bold flex items-center justify-center gap-1.5 border ${
                      movType === 'outbound'
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    حواله خروج (Outbound)
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    انتخاب قطعه / کالا
                  </label>
                  <select
                    value={movProductId}
                    onChange={(e) => setMovProductId(e.target.value)}
                    aria-label="انتخاب قطعه انبار"
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                  >
                    {state.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} (موجودی: {p.stockQty})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      تعداد دقیق
                    </label>
                    <FormattedNumberInput
                      value={movQty}
                      allowDecimals={false}
                      onChange={(val) => setMovQty(val || 1)}
                      ariaLabel="تعداد گردش انبار"
                      className="w-full px-3 py-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      کد پروژه
                    </label>
                    <input
                      type="text"
                      value={movProject}
                      onChange={(e) => setMovProject(e.target.value)}
                      aria-label="کد پروژه انبار"
                      className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    شماره مدرک / بارنامه
                  </label>
                  <input
                    type="text"
                    value={movRef}
                    onChange={(e) => setMovRef(e.target.value)}
                    aria-label="شماره مدرک انبار"
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 font-bold bg-blue-700 hover:bg-blue-800 text-white rounded cursor-pointer"
                >
                  ثبت قطعی گردش و بروزرسانی موجودی انبار
                </button>
              </div>
            </form>
          </div>

          {/* Inventory Movements Log */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              کاردکس گردش ورود و خروج قطعات انبار به تفکیک پروژه
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-2 px-3">تاریخ</th>
                    <th className="py-2 px-3">نوع عملیات</th>
                    <th className="py-2 px-3">کد و نام قطعه</th>
                    <th className="py-2 px-3 text-center">مقدار</th>
                    <th className="py-2 px-3">کد پروژه / مدرک</th>
                    <th className="py-2 px-3">توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.inventoryMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono-num">{m.date}</td>
                      <td className="py-2 px-3 font-bold">
                        {m.type === 'inbound' ? (
                          <span className="text-emerald-700">ورود به انبار (+)</span>
                        ) : (
                          <span className="text-amber-700">خروج از انبار (-)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {m.productSku} — {m.productName}
                      </td>
                      <td className="py-2 px-3 font-mono-num text-center font-bold">
                        {formatNumber(m.quantity)}
                      </td>
                      <td className="py-2 px-3 font-mono-num text-slate-600">
                        {m.projectCode} · {m.referenceDoc}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{m.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Windows Native .EXE (Zero WebView) Package */}
      {section === 'windows_launcher' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-700" />
                دریافت نسخه اجرایی بومی ویندوز (TarazBan_Accounting.exe — بدون WebView)
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                خروجی اجرایی ویندوز بر پایه فرم‌های استاندارد <strong>Windows Forms (.NET C#)</strong> و کاملاً بدون مرورگر یا WebView، مجهز به قفل سخت‌افزاری وابسته به هر سیستم ویندوز.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                downloadNativeWindowsAccountingExePackage();
                setNotice(
                  'فایل سازنده اجرایی ویندوز (Build_TarazBan_Native_Windows_EXE.bat) دانلود شد. با دابل‌کلیک روی آن در ویندوز، فایل TarazBan_Accounting.exe ساخته و اجرا می‌شود.'
                );
              }}
              className="px-4 py-2.5 text-xs font-extrabold bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              دانلود فایل اجرایی ویندوز (.EXE)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2.5">
              <div className="text-sm font-extrabold text-blue-950 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-blue-700" />
                مشخصات اجرایی نسخه ویندوز (.EXE)
              </div>
              <div className="space-y-2 text-slate-700 leading-relaxed">
                <p>
                  <strong>۱. کامپایل مستقیم به .EXE بومی ویندوز:</strong> استفاده از کامپایلر پیش‌فرض مایکروسافت (<code>csc.exe</code> در <code>.NET Framework</code>) جهت تولید فایل <strong><code>TarazBan_Accounting.exe</code></strong>.
                </p>
                <p>
                  <strong>۲. بدون هیچ‌گونه WebView یا مرورگر:</strong> تمام جداول، دکمه‌ها، تب‌ها و فرم‌ها از کنترل‌های اصیل ویندوز (<code>System.Windows.Forms.Form</code> و <code>DataGridView</code>) هستند.
                </p>
                <p>
                  <strong>۳. قفل سخت‌افزاری وابسته به هر کامپیوتر:</strong> برنامه سریال سخت‌افزاری مادربرد، پردازنده و هارد ویندوز را بررسی کرده و تا زمان وارد کردن رمز فعال‌سازی ۱۶ رقمی مختص همان سیستم کار نمی‌کند.
                </p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2.5">
              <div className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                <FileDown className="w-4 h-4 text-emerald-700" />
                امکانات داخل فایل TarazBan_Accounting.exe ویندوز
              </div>
              <div className="space-y-2 text-slate-700 leading-relaxed">
                <p>
                  <strong>۱. میز خرید و فروش ارز و صرافی:</strong> ثبت خرید و فروش دلار، یورو، درهم و یوان با جداکننده ۳ رقم ۳ رقم و ۲ رقم اعشار ارزی (<code>.00</code>) + محاسبه خودکار معادل ریالی.
                </p>
                <p>
                  <strong>۲. گزارشات استاندارد بدهکار / بستانکار / مانده از بالا به پایین:</strong> کاردکس اشخاص، بانک‌ها و هزینه‌ها به صورت ریالی و ارزی همراه با چاپ مستقیم A4 و خروجی PDF ویندوز (<code>PrintDocument</code>).
                </p>
                <p>
                  <strong>۳. بکاپ کامل اتوماتیک و ارسال به ربات بله و تلگرام:</strong> ذخیره دیتابیس محلی ویندوز و ارسال مستقیم خلاصه بکاپ و صورتحساب به بازوی بله و تلگرام.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
