import React, { useState, useEffect } from 'react';
import {
  AccountingState,
  BotConfig,
  BotDeliveryLog,
  InventoryMovement,
} from '../types/accounting';
import {
  convertForeignToIRR,
  formatNumber,
} from '../utils/accountingEngine';
import {
  dispatchToMessengerBot,
  triggerBackupFileDownload,
} from '../utils/botAndBackupService';
import {
  downloadNativeWindowsAccountingExePackage,
} from '../utils/nativeWindowsExeBuilder';
import { invokeTauriCommand } from '../utils/offlineLicenseEngine';
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
  FolderOpen,
  RotateCcw,
  Clock,
  HardDrive,
} from 'lucide-react';

interface SavedBackupFileInfo {
  fileName: string;
  fullPath: string;
  sizeBytes: number;
  updatedAt: string;
}

interface BackupAndWarehouseViewProps {
  state: AccountingState;
  onUpdateBotConfig: (patch: Partial<BotConfig>) => void;
  onRecordBotLog: (log: BotDeliveryLog) => void;
  onRestoreFullBackup: (restoredState: AccountingState) => void;
  onRecordInventoryMovement: (movement: InventoryMovement) => void;
  onResetToBlankDatabase?: () => void;
  onTriggerImmediateAutoBackup?: (reason: string) => Promise<string | null>;
}

export const BackupAndWarehouseView: React.FC<BackupAndWarehouseViewProps> = ({
  state,
  onUpdateBotConfig,
  onRecordBotLog,
  onRestoreFullBackup,
  onRecordInventoryMovement,
  onResetToBlankDatabase,
  onTriggerImmediateAutoBackup,
}) => {
  const [section, setSection] = useState<'backup_bot' | 'network_server' | 'warehouse' | 'windows_launcher'>('backup_bot');
  const [notice, setNotice] = useState<string | null>(null);
  const [backupDirectoryPath, setBackupDirectoryPath] = useState<string>('C:\\TarazBan_Backups');
  const [latestBackupFilePath, setLatestBackupFilePath] = useState<string>('C:\\TarazBan_Backups\\TarazBan_Latest_AutoBackup.json');
  const [savedBackupsList, setSavedBackupsList] = useState<SavedBackupFileInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);

  // Warehouse movement form state
  const [movType, setMovType] = useState<'inbound' | 'outbound'>('inbound');
  const [movProductId, setMovProductId] = useState(state.products[0]?.id || '');
  const [movQty, setMovQty] = useState<number>(5);
  const [movProject, setMovProject] = useState('PRJ-1404-WH');
  const [movRef, setMovRef] = useState('WH-DOC-809');
  const [movNotes, setMovNotes] = useState('');

  const fetchSavedBackupsList = async () => {
    setIsLoadingBackups(true);
    try {
      // Check if Tauri native command is available (Tauri v2 & v1 compatible)
      const nativeDir = await invokeTauriCommand<string>('get_backup_folder_path');
      if (nativeDir) {
        setBackupDirectoryPath(nativeDir);
        setLatestBackupFilePath(`${nativeDir}\\TarazBan_Latest_AutoBackup.json`);
      }

      const res = await fetch('/api/backups-list');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.backupDirectory) setBackupDirectoryPath(data.backupDirectory);
          if (data.latestBackupPath) setLatestBackupFilePath(data.latestBackupPath);
          setSavedBackupsList(data.files || []);
        }
      }
    } catch {
      // Offline / Tauri standalone
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchSavedBackupsList();
  }, []);

  const handleSaveImmediateAutoBackup = async () => {
    try {
      let savedPath: string | null = null;
      if (onTriggerImmediateAutoBackup) {
        savedPath = await onTriggerImmediateAutoBackup('manual_instant');
      } else {
        const res = await fetch('/api/auto-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, reason: 'manual_instant' }),
        });
        if (res.ok) {
          const data = await res.json();
          savedPath = data.latestPath || data.backupPath;
        }
      }
      await fetchSavedBackupsList();
      const nowStr = `1404/08/12 - ${new Date().toTimeString().slice(0, 8)}`;
      onUpdateBotConfig({ lastBackupTime: nowStr });
      setNotice(
        `✅ بکاپ کامل با موفقیت در پوشه بکاپ‌های سیستم ذخیره شد: ${
          savedPath || latestBackupFilePath
        }`
      );
    } catch {
      triggerBackupFileDownload(state, 'TarazBan_AutoBackup_Manual');
      setNotice('فایل بکاپ کامل در پوشه دانلودهای سیستم شما ذخیره گردید.');
    }
  };

  const handleRestoreFromSavedBackupFile = async (fileName?: string) => {
    try {
      // First check Tauri native restore if no specific server file
      if (!fileName) {
        const rawJson = await invokeTauriCommand<string>('read_latest_auto_backup');
        if (rawJson) {
          try {
            const parsed = JSON.parse(rawJson);
            const candidate: AccountingState = parsed.data || parsed.state || parsed;
            if (
              candidate &&
              (Array.isArray(candidate.vouchers) ||
                Array.isArray(candidate.contacts) ||
                Array.isArray(candidate.fxDeals))
            ) {
              onRestoreFullBackup(candidate);
              setNotice(
                `✅ بازگردانی بکاپ از مسیر ${latestBackupFilePath} با موفقیت انجام شد (${
                  candidate.contacts?.length || 0
                } طرف حساب، ${candidate.fxDeals?.length || 0} معامله ارز، ${
                  candidate.vouchers?.length || 0
                } سند).`
              );
              return;
            }
          } catch {
            // continue to server restore
          }
        }
      }

      const res = await fetch('/api/restore-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      if (!res.ok) {
        setNotice('فایل بکاپ در پوشه یافت نشد. لطفاً ابتدا یک بکاپ ذخیره کنید یا فایل JSON را از سیستم انتخاب نمایید.');
        return;
      }
      const data = await res.json();
      if (data.success && data.state) {
        onRestoreFullBackup(data.state);
        setNotice(
          `✅ اطلاعات سیستم با موفقیت از فایل بکاپ (${data.restoredFrom}) بازگردانی شد! (${
            data.state.contacts?.length || 0
          } طرف حساب، ${data.state.fxDeals?.length || 0} معامله ارز، ${
            data.state.vouchers?.length || 0
          } سند حسابداری)`
        );
      }
    } catch {
      setNotice('خطا در بازگردانی خودکار؛ لطفاً فایل JSON بکاپ را از کادر پایین انتخاب و بازیابی کنید.');
    }
  };

  const handleFullBackupAndBotSend = async (platform: 'bale' | 'telegram' | 'both') => {
    const summaryText =
      `📦 *بکاپ کامل خودکار سیستم جامع حسابداری دوارزی آرکا (ARKA)*\n` +
      `🏢 شرکت: ${state.companyName} (${state.fiscalYear})\n` +
      `📊 محتویات بکاپ کامل:\n` +
      `• تعداد معاملات خرید و فروش ارز: ${state.fxDeals.length} معامله\n` +
      `• تعداد اسناد حسابداری دوارزی: ${state.vouchers.length} سند\n` +
      `• تعداد فاکتورهای فروش ارزی/ریالی: ${state.invoices.length} فاکتور\n` +
      `• تعداد طرف حساب‌ها (اشخاص): ${state.contacts.length} شخص\n` +
      `• تعداد بانک‌ها و صرافی‌ها: ${state.banks.length} حساب\n` +
      `✅ مسیر ذخیره خودکار ویندوز: ${latestBackupFilePath}`;

    await handleSaveImmediateAutoBackup();
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
        summary: `ارسال بکاپ کامل کل سیستم (${state.fxDeals.length} معامله، ${state.vouchers.length} سند، ${state.contacts.length} شخص) به ربات ${
          p === 'bale' ? 'بله' : 'تلگرام'
        }`,
      });
      onRecordBotLog(log);
    }

    onUpdateBotConfig({
      lastBackupTime: `1404/08/12 - ${new Date().toTimeString().slice(0, 8)}`,
    });

    setNotice(
      `فایل بکاپ کامل دانلود شد، در پوشه ${backupDirectoryPath} ذخیره گردید و همزمان به ربات ${
        platform === 'both' ? 'بله و تلگرام' : platform === 'bale' ? 'بله' : 'تلگرام'
      } ارسال شد.`
    );
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const rawText = String(evt.target?.result || '').trim();
        const parsed = JSON.parse(rawText);
        const candidate: AccountingState = parsed.data || parsed.state || parsed;
        if (
          candidate &&
          (Array.isArray(candidate.vouchers) ||
            Array.isArray(candidate.accounts) ||
            Array.isArray(candidate.contacts) ||
            Array.isArray(candidate.fxDeals))
        ) {
          onRestoreFullBackup(candidate);
          setNotice(
            `✅ بکاپ کامل از فایل «${file.name}» با موفقیت بازگردانی (Restore) شد! (${
              candidate.contacts?.length || 0
            } شخص، ${candidate.fxDeals?.length || 0} معامله ارز، ${
              candidate.vouchers?.length || 0
            } سند حسابداری و ${candidate.banks?.length || 0} بانک/صندوق بازیابی گردید).`
          );
        } else {
          setNotice('❌ ساختار داخل فایل JSON معتبر نیست یا متعلق به بکاپ ترازبان نمی‌باشد.');
        }
      } catch {
        setNotice('❌ فرمت فایل بکاپ انتخابی معتبر نیست. لطفاً فایل JSON بکاپ ترازبان را انتخاب کنید.');
      }
      e.target.value = '';
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
            onClick={() => setSection('network_server')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              section === 'network_server'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            شبکه لینوکس و دیتابیس خام
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
          {/* بکاپ اتوماتیک ۲ ساعته + بکاپ هنگام بستن نرم‌افزار ویندوز تائوری و سرور */}
          <div className="bg-gradient-to-r from-indigo-50 via-white to-teal-50 border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-200 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      بکاپ اتوماتیک هر ۲ ساعت + بکاپ اتوماتیک موقع بستن برنامه (ویندوز تائوری و سرور)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      فعال و خودکار
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    نرم‌افزار به صورت کاملاً خودکار هر <strong>{state.botConfig.autoBackupIntervalHours || 2} ساعت یکبار</strong> و همچنین <strong>در لحظه بستن پنجره نرم‌افزار</strong> یک نسخه کامل از دیتابیس را در مسیر مشخص زیر ذخیره می‌کند.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveImmediateAutoBackup}
                  className="px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <DatabaseBackup className="w-4 h-4" />
                  ذخیره فوری بکاپ در پوشه سیستم
                </button>
                <button
                  type="button"
                  onClick={() => handleRestoreFromSavedBackupFile()}
                  className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  بازگردانی فوری آخرین بکاپ اتوماتیک
                </button>
              </div>
            </div>

            {/* نمایش دقیق مسیر ذخیره بکاپ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-indigo-200 space-y-1">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-indigo-700" />
                  مسیر ذخیره بکاپ اتوماتیک در ویندوز (نسخه Tauri / دسکتاپ):
                </div>
                <div
                  dir="ltr"
                  className="font-mono text-[11px] sm:text-xs font-extrabold text-indigo-900 bg-indigo-50/80 px-2.5 py-1.5 rounded border border-indigo-200 select-all break-all"
                >
                  C:\TarazBan_Backups\TarazBan_Latest_AutoBackup.json
                </div>
                <div className="text-[11px] text-slate-500">
                  در درایو C ویندوز داخل پوشه <strong>TarazBan_Backups</strong> به همراه آرشیو تاریخ‌دار ذخیره می‌شود.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-teal-200 space-y-1">
                <div className="font-bold text-teal-950 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-700" />
                  مسیر فعلی بکاپ اتوماتیک روی این سیستم / سرور:
                </div>
                <div
                  dir="ltr"
                  className="font-mono text-[11px] sm:text-xs font-extrabold text-teal-900 bg-teal-50/80 px-2.5 py-1.5 rounded border border-teal-200 select-all break-all"
                >
                  {latestBackupFilePath}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>زمان آخرین بکاپ ثبت‌شده: <strong>{state.botConfig.lastBackupTime || 'هم‌اکنون'}</strong></span>
                  <button
                    type="button"
                    onClick={fetchSavedBackupsList}
                    className="text-teal-700 font-bold underline cursor-pointer"
                  >
                    بروزرسانی لیست
                  </button>
                </div>
              </div>
            </div>

            {/* فهرست فایل‌های بکاپ اتوماتیک ذخیره‌شده با دکمه بازگردانی تکی */}
            {savedBackupsList.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-extrabold text-slate-800 flex items-center justify-between">
                  <span>فایل‌های بکاپ اتوماتیک موجود در پوشه ({savedBackupsList.length} فایل):</span>
                  <span className="text-[11px] text-slate-500 font-normal">برای بازگردانی هر نسخه روی دکمه بازگردانی کلیک کنید</span>
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {savedBackupsList.slice(0, 10).map((bf) => (
                    <div
                      key={bf.fileName}
                      className="p-2 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-slate-900 truncate" dir="ltr">
                          {bf.fileName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          مسیر: <span dir="ltr">{bf.fullPath}</span> | زمان: {new Date(bf.updatedAt).toLocaleTimeString('fa-IR')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreFromSavedBackupFile(bf.fileName)}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer self-end sm:self-center"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        بازگردانی این بکاپ
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isLoadingBackups && (
              <div className="text-[11px] text-slate-500">در حال بررسی پوشه بکاپ‌ها...</div>
            )}
          </div>

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

                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
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
                    <span>بکاپ اتوماتیک لحظه‌ای پس از ثبت هر سند و موقع بستن برنامه</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-700 font-semibold">
                      بازه بکاپ اتوماتیک ویندوز/سرور:
                    </label>
                    <select
                      value={state.botConfig.autoBackupIntervalHours || 2}
                      onChange={(e) =>
                        onUpdateBotConfig({
                          autoBackupIntervalHours: Number(e.target.value),
                        })
                      }
                      className="px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono-num font-bold"
                    >
                      <option value={1}>هر ۱ ساعت یکبار</option>
                      <option value={2}>هر ۲ ساعت یکبار (پیش‌فرض اتوماتیک)</option>
                      <option value={4}>هر ۴ ساعت یکبار</option>
                      <option value={6}>هر ۶ ساعت یکبار</option>
                      <option value={12}>هر ۱۲ ساعت یکبار</option>
                      <option value={24}>هر ۲۴ ساعت (روزانه)</option>
                    </select>
                  </div>

                  <span className="font-mono-num text-xs text-slate-500">
                    آخرین بکاپ: {state.botConfig.lastBackupTime || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Instant Full Backup & Restore Actions */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                عملیات پشتیبان‌گیری کامل (Full Backup) و بازگردانی (Restore)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                بکاپ کامل شامل ۱۰۰٪ اطلاعات سیستم (تمامی معاملات خرید و فروش ارز، تحویل‌های مرحله‌ای ارز، اسناد حسابداری، اشخاص، بانک‌ها و فاکتورها) در قالب یک فایل JSON استاندارد است.
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

              <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  بازیابی اطلاعات از فایل بکاپ انتخابی (Full Restore از کامپیوتر یا موبایل):
                </label>
                <label className="flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-blue-400 hover:border-blue-700 rounded-xl text-xs font-extrabold text-blue-900 cursor-pointer bg-blue-50/60 transition">
                  <Upload className="w-4 h-4 text-blue-700" />
                  <span>انتخاب فایل JSON بکاپ (از C:\TarazBan_Backups یا پوشه دانلودها) جهت بازگردانی کامل</span>
                  <input
                    type="file"
                    accept=".json,application/json"
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

      {/* Network Server & Blank Database Options */}
      {section === 'network_server' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* کارت اتصال شبکه و دیتابیس مشترک مرکزی */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Monitor className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  وضعیت اتصال شبکه، سینک کلاینت‌ها و دیتابیس مشترک سرور
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                هنگامی که ترازبان روی لینوکس یا سرور شبکه نصب است، کلیه دستگاه‌ها (کامپیوترها، لپ‌تاپ‌ها و گوشی‌های همراه) با وارد کردن آی‌پی سرور مستقیماً به همین دیتابیس مشترک متصل می‌شوند. هر سندی که در گوشی یا کامپیوتر ثبت یا ویرایش شود بلافاصله روی سرور ذخیره شده و برای تمام کاربران همگام است.
              </p>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1.5 font-mono-num">
                <div className="flex justify-between">
                  <span className="text-slate-600">پورت سرور شبکه:</span>
                  <span className="font-bold text-blue-900">3000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">آدرس دسترسی از گوشی / کلاینت:</span>
                  <span className="font-bold text-blue-900" dir="ltr">http://&lt;SERVER_IP&gt;:3000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">وضعیت ذخیره‌سازی مرکزی:</span>
                  <span className="font-bold text-emerald-700">سرور لینوکس / فول‌استک Express + Vite</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-slate-500">
                  💡 نیازی به پیکربندی دستی کلاینت‌ها نیست؛ تمامی کلاینت‌ها به محض باز کردن صفحه به صورت اتوماتیک دیتابیس سرور را دریافت و ذخیره می‌کنند.
                </p>
              </div>
            </div>

            {/* کارت دیتابیس کاملاً خام و پاک‌سازی داده‌های نمونه */}
            <div className="bg-white border border-rose-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 text-rose-600">
                <DatabaseBackup className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  شروع فعالیت واقعی: ایجاد دیتابیس کاملاً خام (صفر)
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                اگر می‌خواهید اطلاعات تستی و دمو را پاک کنید تا دفتر حسابداری کاملاً خام و آماده ثبت اسناد و معاملات واقعی شما باشد، از این گزینه استفاده کنید. این کار حساب‌های استاندارد، ارزها و بانک‌ها را نگه می‌دارد اما تمام اسناد، معاملات و اشخاص تستی را صفر می‌کند.
              </p>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                <p className="font-bold">⚠️ هشدار پاک‌سازی:</p>
                <p className="text-[11px] text-rose-800">
                  قبل از کلیک، در صورت تمایل از تب «بکاپ اتوماتیک» یک بکاپ ذخیره نمایید. پس از تأیید، دیتابیس روی سرور و تمام دستگاه‌ها کاملاً سفید می‌شود.
                </p>
              </div>

              {onResetToBlankDatabase && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('آیا از صفر کردن دیتابیس و شروع فعالیت کاملاً خام و واقعی اطمینان دارید؟ تمامی اسناد، معاملات و فاکتورهای آزمایشی پاک خواهند شد.')) {
                      onResetToBlankDatabase();
                      setNotice('دیتابیس سیستم با موفقیت به حالت کاملاً خام (بدون سند تستی) تغییر یافت.');
                    }
                  }}
                  className="w-full py-2.5 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-xs transition"
                >
                  <DatabaseBackup className="w-4 h-4" />
                  صفر کردن دیتابیس و شروع واقعی (خام)
                </button>
              )}
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
              {/* Mobile Inventory Cards (sm:hidden) */}
              <div className="sm:hidden space-y-3">
                {state.products.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-num font-bold text-blue-800">
                        {p.sku}
                      </span>
                      <span className="font-mono-num font-extrabold text-slate-900 bg-slate-200 px-2 py-0.5 rounded">
                        موجودی: {p.stockQty} {p.unit}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-[11px] text-slate-600">موقعیت: {p.warehouseLocation}</div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono-num">
                      <span className="text-slate-600">ارزش واحد ارزی:</span>
                      <span className="font-bold text-slate-800">
                        {formatNumber(p.defaultPriceForeign, 2)} {p.defaultCurrency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono-num">
                      <span className="text-slate-600">ارزش کل موجودی:</span>
                      <span className="font-extrabold text-slate-900">
                        {formatNumber(p.stockQty * p.defaultPriceIRR)} ریال
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-lg">
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
