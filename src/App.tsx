import React, { useEffect, useState } from 'react';
import {
  Account,
  AccountingState,
  BankAccount,
  BankStatementEntry,
  BotConfig,
  BotDeliveryLog,
  Contact,
  CurrencyCode,
  FXDeal,
  InventoryMovement,
  JournalVoucher,
  SalesInvoice,
} from './types/accounting';
import { INITIAL_ACCOUNTING_STATE } from './data/initialAccountingData';
import { DashboardOverview } from './components/DashboardOverview';
import { FXTradingDeskView } from './components/FXTradingDeskView';
import { StandardAccountingReportsView } from './components/StandardAccountingReportsView';
import { VoucherEntryView } from './components/VoucherEntryView';
import { PersonStatementsView } from './components/PersonStatementsView';
import { InvoicesAndBotView } from './components/InvoicesAndBotView';
import { BanksAndReconciliationView } from './components/BanksAndReconciliationView';
import { BackupAndWarehouseView } from './components/BackupAndWarehouseView';
import { OfflineActivationModal } from './components/OfflineActivationModal';
import {
  LicenseStatus,
  loadLicenseStatus,
  lockApplicationLicense,
  fetchServerLicenseStatus,
} from './utils/offlineLicenseEngine';
import {
  dispatchToMessengerBot,
  triggerBackupFileDownload,
} from './utils/botAndBackupService';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Printer,
  FilePlus2,
  Users,
  FileSpreadsheet,
  Landmark,
  DatabaseBackup,
  CheckCircle2,
  Lock,
} from 'lucide-react';

const STORAGE_KEY = 'TARAZBAN_WINDOWS_ACCOUNTING_STATE_V6';

type ActiveModule =
  | 'dashboard'
  | 'fx_desk'
  | 'reports'
  | 'vouchers'
  | 'statements'
  | 'invoices'
  | 'banks'
  | 'backup';

export default function App() {
  const [state, setState] = useState<AccountingState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          Array.isArray(parsed.vouchers) &&
          Array.isArray(parsed.currencies) &&
          Array.isArray(parsed.fxDeals)
        ) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial seed data
    }
    return INITIAL_ACCOUNTING_STATE;
  });

  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [globalBanner, setGlobalBanner] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(() =>
    loadLicenseStatus()
  );
  const [isVerifyingServerLicense, setIsVerifyingServerLicense] = useState<boolean>(
    () => !loadLicenseStatus().isActivated
  );

  // Automatically check if running on a Linux Server with active server license
  useEffect(() => {
    let isMounted = true;
    fetchServerLicenseStatus()
      .then((serverLic) => {
        if (isMounted && serverLic && serverLic.isActivated) {
          setLicenseStatus(serverLic);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsVerifyingServerLicense(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Persist to localStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  // Windows Desktop Function Key Shortcuts (F1, F2, F3, F4, F6, F8, F9) — only active when license is unlocked
  useEffect(() => {
    if (!licenseStatus.isActivated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveModule('fx_desk');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveModule('vouchers');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveModule('reports');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveModule('statements');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setActiveModule('invoices');
      } else if (e.key === 'F8') {
        e.preventDefault();
        setActiveModule('banks');
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleInstantFullBackupAndBot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleRecordBotLog = (log: BotDeliveryLog) => {
    setState((prev) => ({
      ...prev,
      botLogs: [log, ...prev.botLogs],
    }));
  };

  const handleInstantFullBackupAndBot = async () => {
    triggerBackupFileDownload(state, 'TarazBan_Windows_AutoBackup');
    const nowTime = `1404/08/12 - ${new Date().toTimeString().slice(0, 8)}`;

    const logBale = await dispatchToMessengerBot({
      platform: 'bale',
      botToken: state.botConfig.baleBotToken,
      chatId: state.botConfig.baleDefaultChatId,
      recipientName: 'کانال بکاپ خودکار بله (Bale)',
      messageType: 'backup',
      text: `📦 بکاپ کامل خودکار سیستم خرید و فروش ارز و حسابداری ویندوز ترازبان (${state.fxDeals.length} معامله ارز، ${state.vouchers.length} سند، ${state.contacts.length} شخص)`,
      summary: `ارسال بکاپ کامل کل اطلاعات سیستم به بازوی بله و تلگرام (${nowTime})`,
    });

    setState((prev) => ({
      ...prev,
      botConfig: {
        ...prev.botConfig,
        lastBackupTime: nowTime,
      },
      botLogs: [logBale, ...prev.botLogs],
    }));

    setGlobalBanner(
      `بکاپ کامل از تمام بخش‌ها (معاملات خرید و فروش ارز، اسناد، اشخاص، بانک‌ها، فاکتورها و انبار) روی سیستم ویندوز ذخیره و به ربات بله و تلگرام ارسال شد.`
    );
  };

  const handleExecuteFXDeal = (deal: FXDeal) => {
    setState((prev) => {
      const nextVoucherNumber =
        prev.vouchers.reduce((m, v) => Math.max(m, v.voucherNumber), 1000) + 1;

      const fxBank = prev.banks.find((b) => b.id === deal.targetForeignBankId);
      const isBuy = deal.type === 'buy';

      const autoVoucher: JournalVoucher = {
        id: `vch-fx-${Date.now()}`,
        voucherNumber: nextVoucherNumber,
        date: deal.date,
        description: `${
          isBuy ? 'خرید ارز' : 'فروش ارز'
        } (${deal.dealNumber}): ${deal.foreignAmount.toFixed(2)} ${deal.currency} به نرخ ${
          deal.exchangeRate
        } ریال — طرف حساب: ${deal.contactName}`,
        referenceNumber: deal.dealNumber,
        status: 'permanent',
        createdAt: deal.date,
        lines: isBuy
          ? [
              {
                id: `vl-fx-d-${Date.now()}`,
                accountCode: fxBank?.moeinCode || '1103',
                accountName: 'موجودی بانک‌ها و صرافی‌های ارزی',
                bankId: deal.targetForeignBankId,
                bankName: fxBank?.bankName || 'خزانه ارزی',
                description: `ورود ارز بابت خرید ${deal.dealNumber} (${deal.contactName})`,
                currency: deal.currency,
                exchangeRate: deal.exchangeRate,
                debitForeign: deal.foreignAmount,
                creditForeign: 0,
                debitIRR: deal.totalIRR,
                creditIRR: 0,
                trackingNumber: deal.trackingNumber,
              },
              {
                id: `vl-fx-c-${Date.now()}`,
                accountCode: '2101',
                accountName: 'حساب‌های پرداختنی تجاری (تأمین‌کنندگان / بستانکاران)',
                contactId: deal.contactId,
                contactName: deal.contactName,
                description: `بستانکاری طرف حساب بابت خرید ارز ${deal.dealNumber}`,
                currency: deal.currency,
                exchangeRate: deal.exchangeRate,
                debitForeign: 0,
                creditForeign: deal.foreignAmount,
                debitIRR: 0,
                creditIRR: deal.totalIRR,
                trackingNumber: deal.trackingNumber,
              },
            ]
          : [
              {
                id: `vl-fx-d-${Date.now()}`,
                accountCode: '1104',
                accountName: 'حساب‌های دریافتنی تجاری (مشتریان / بدهکاران)',
                contactId: deal.contactId,
                contactName: deal.contactName,
                description: `بدهکاری مشتری بابت فروش ارز ${deal.dealNumber}`,
                currency: deal.currency,
                exchangeRate: deal.exchangeRate,
                debitForeign: deal.foreignAmount,
                creditForeign: 0,
                debitIRR: deal.totalIRR,
                creditIRR: 0,
                trackingNumber: deal.trackingNumber,
              },
              {
                id: `vl-fx-c-${Date.now()}`,
                accountCode: fxBank?.moeinCode || '1103',
                accountName: 'موجودی بانک‌ها و صرافی‌های ارزی',
                bankId: deal.targetForeignBankId,
                bankName: fxBank?.bankName || 'خزانه ارزی',
                description: `خروج ارز از خزانه بابت فروش ${deal.dealNumber} (${deal.contactName})`,
                currency: deal.currency,
                exchangeRate: deal.exchangeRate,
                debitForeign: 0,
                creditForeign: deal.foreignAmount,
                debitIRR: 0,
                creditIRR: deal.totalIRR,
                trackingNumber: deal.trackingNumber,
              },
            ],
      };

      return {
        ...prev,
        fxDeals: [deal, ...(prev.fxDeals || [])],
        vouchers: [autoVoucher, ...prev.vouchers],
      };
    });
  };

  const handleSaveVoucher = async (voucher: JournalVoucher) => {
    const nowTime = `1404/08/12 - ${new Date().toTimeString().slice(0, 8)}`;
    setState((prev) => {
      const nextVouchers = [voucher, ...prev.vouchers];
      const autoLog: BotDeliveryLog | null = prev.botConfig.autoBackupOnVoucherSave
        ? {
            id: `log-auto-${Date.now()}`,
            timestamp: nowTime,
            platform: 'bale',
            recipientChatId: prev.botConfig.baleDefaultChatId,
            recipientName: 'بکاپ خودکار بله و تلگرام',
            messageType: 'backup',
            status: 'simulated_local',
            summary: `بکاپ خودکار لحظه‌ای پس از ثبت سند حسابداری شماره #${voucher.voucherNumber}`,
          }
        : null;

      return {
        ...prev,
        vouchers: nextVouchers,
        botConfig: {
          ...prev.botConfig,
          lastBackupTime: nowTime,
        },
        botLogs: autoLog ? [autoLog, ...prev.botLogs] : prev.botLogs,
      };
    });
  };

  const handleDeleteVoucher = (voucherId: string) => {
    setState((prev) => ({
      ...prev,
      vouchers: prev.vouchers.filter((v) => v.id !== voucherId),
    }));
  };

  const handleAddContact = (contact: Contact) => {
    setState((prev) => ({
      ...prev,
      contacts: [...prev.contacts, contact],
    }));
  };

  const handleIssueInvoice = (invoice: SalesInvoice) => {
    setState((prev) => {
      const nextVoucherNumber =
        prev.vouchers.reduce((m, v) => Math.max(m, v.voucherNumber), 1000) + 1;

      const salesMoeinCode = invoice.currency === 'IRR' ? '4101' : '4102';
      const salesMoeinName =
        invoice.currency === 'IRR'
          ? 'درآمد فروش داخلی (ریالی)'
          : 'درآمد فروش صادراتی و ارزی';

      const autoVoucher: JournalVoucher = {
        id: `vch-inv-${Date.now()}`,
        voucherNumber: nextVoucherNumber,
        date: invoice.date,
        description: `سند خودکار فاکتور فروش شماره ${invoice.invoiceNumber} — ${invoice.contactName}`,
        referenceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id,
        status: 'permanent',
        createdAt: invoice.date,
        lines: [
          {
            id: `vl-inv-d-${Date.now()}`,
            accountCode: '1104',
            accountName: 'حساب‌های دریافتنی تجاری (مشتریان / بدهکاران)',
            contactId: invoice.contactId,
            contactName: invoice.contactName,
            description: `بدهکاری مشتری بابت فاکتور ${invoice.invoiceNumber}`,
            currency: invoice.currency,
            exchangeRate: invoice.exchangeRate,
            debitForeign: invoice.grandTotalForeign,
            creditForeign: 0,
            debitIRR: invoice.grandTotalIRR,
            creditIRR: 0,
            trackingNumber: invoice.invoiceNumber,
          },
          {
            id: `vl-inv-c-${Date.now()}`,
            accountCode: salesMoeinCode,
            accountName: salesMoeinName,
            description: `درآمد فروش طبق فاکتور ${invoice.invoiceNumber}`,
            currency: invoice.currency,
            exchangeRate: invoice.exchangeRate,
            debitForeign: 0,
            creditForeign: invoice.grandTotalForeign,
            debitIRR: 0,
            creditIRR: invoice.grandTotalIRR,
            trackingNumber: invoice.invoiceNumber,
          },
        ],
      };

      const updatedProducts = prev.products.map((prod) => {
        const soldItem = invoice.items.find((i) => i.productId === prod.id);
        if (!soldItem) return prod;
        return {
          ...prod,
          stockQty: Math.max(0, prod.stockQty - soldItem.quantity),
        };
      });

      const newMovements: InventoryMovement[] = invoice.items.map((item) => ({
        id: `mov-inv-${Date.now()}-${item.id}`,
        date: invoice.date,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        type: 'outbound',
        quantity: item.quantity,
        unitPriceForeign: item.unitPriceForeign,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        unitPriceIRR: item.unitPriceIRR,
        referenceDoc: invoice.invoiceNumber,
        projectCode: invoice.projectCode || 'PRJ-SALES',
        warehouseName: invoice.warehouseName,
        notes: `خروج خودکار بابت فاکتور فروش ${invoice.invoiceNumber} (${invoice.contactName})`,
      }));

      return {
        ...prev,
        invoices: [invoice, ...prev.invoices],
        vouchers: [autoVoucher, ...prev.vouchers],
        products: updatedProducts,
        inventoryMovements: [...newMovements, ...prev.inventoryMovements],
      };
    });
  };

  const handleAddBank = (bank: BankAccount) => {
    setState((prev) => ({
      ...prev,
      banks: [...prev.banks, bank],
    }));
  };

  const handleAddBankStatementEntry = (entry: BankStatementEntry) => {
    setState((prev) => ({
      ...prev,
      bankStatementEntries: [...prev.bankStatementEntries, entry],
    }));
  };

  const handleRecordBankDiscrepancyVoucher = (
    entry: BankStatementEntry,
    bank: BankAccount
  ) => {
    setState((prev) => {
      const nextNum =
        prev.vouchers.reduce((m, v) => Math.max(m, v.voucherNumber), 1000) + 1;
      const rate =
        prev.currencies.find((c) => c.code === entry.currency)?.defaultRateToIRR || 1;
      const isDeposit = entry.depositForeign > 0;
      const amountF = isDeposit ? entry.depositForeign : entry.withdrawalForeign;
      const amountR = isDeposit ? entry.depositIRR : entry.withdrawalIRR;

      const bankLineId = `vl-rec-b-${Date.now()}`;
      const newVoucher: JournalVoucher = {
        id: `vch-rec-${Date.now()}`,
        voucherNumber: nextNum,
        date: entry.date,
        description: `سند تعدیل مغایرت بانکی (${bank.bankName}): ${entry.description}`,
        referenceNumber: entry.trackingNumber,
        status: 'permanent',
        createdAt: entry.date,
        lines: [
          {
            id: bankLineId,
            accountCode: bank.moeinCode,
            accountName:
              bank.currency === 'IRR'
                ? 'موجودی بانک‌های ریالی'
                : 'موجودی بانک‌ها و صرافی‌های ارزی',
            bankId: bank.id,
            bankName: bank.bankName,
            description: entry.description,
            currency: entry.currency,
            exchangeRate: rate,
            debitForeign: isDeposit ? amountF : 0,
            creditForeign: isDeposit ? 0 : amountF,
            debitIRR: isDeposit ? amountR : 0,
            creditIRR: isDeposit ? 0 : amountR,
            trackingNumber: entry.trackingNumber,
            reconciled: true,
          },
          {
            id: `vl-rec-exp-${Date.now()}`,
            accountCode: '5202',
            accountName: 'هزینه کارمزد بانکی و حوالجات ارزی',
            description: `ثبت مغایرت صورتحساب بانک (${entry.description})`,
            currency: entry.currency,
            exchangeRate: rate,
            debitForeign: isDeposit ? 0 : amountF,
            creditForeign: isDeposit ? amountF : 0,
            debitIRR: isDeposit ? 0 : amountR,
            creditIRR: isDeposit ? amountR : 0,
            trackingNumber: entry.trackingNumber,
          },
        ],
      };

      const updatedStatements = prev.bankStatementEntries.map((st) =>
        st.id === entry.id ? { ...st, matchedVoucherLineId: bankLineId } : st
      );

      return {
        ...prev,
        vouchers: [newVoucher, ...prev.vouchers],
        bankStatementEntries: updatedStatements,
      };
    });
  };

  const handleAddAccount = (account: Account) => {
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, account].sort((a, b) =>
        a.code.localeCompare(b.code)
      ),
    }));
  };

  const handleUpdateCurrencyRate = (code: CurrencyCode, newRate: number) => {
    setState((prev) => ({
      ...prev,
      currencies: prev.currencies.map((c) =>
        c.code === code ? { ...c, defaultRateToIRR: newRate } : c
      ),
    }));
  };

  const handleUpdateBotConfig = (patch: Partial<BotConfig>) => {
    setState((prev) => ({
      ...prev,
      botConfig: { ...prev.botConfig, ...patch },
    }));
  };

  const handleRecordInventoryMovement = (movement: InventoryMovement) => {
    setState((prev) => {
      const updatedProducts = prev.products.map((p) => {
        if (p.id !== movement.productId) return p;
        const delta =
          movement.type === 'inbound' ? movement.quantity : -movement.quantity;
        return {
          ...p,
          stockQty: Math.max(0, p.stockQty + delta),
        };
      });
      return {
        ...prev,
        products: updatedProducts,
        inventoryMovements: [movement, ...prev.inventoryMovements],
      };
    });
  };

  // HARD BLOCK: The application MUST NOT work or render any feature until activated (via Linux Server License or Windows hardware key)
  if (!licenseStatus.isActivated) {
    if (isVerifyingServerLicense) {
      return (
        <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
          <div className="flex items-center gap-3 text-slate-300 text-sm">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>در حال بررسی مجوز فعال‌سازی سرور...</span>
          </div>
        </div>
      );
    }

    return (
      <OfflineActivationModal
        license={licenseStatus}
        onActivated={(newLic) => {
          setLicenseStatus(newLic);
          setGlobalBanner(
            newLic.isServerLicensed
              ? `لایسنس سرور لینوکس فعال گردید. اکنون تمام کاربران شبکه و کلاینت‌های متصل به IP بدون نیاز به فعال‌سازی مجدد می‌توانند از سیستم استفاده کنند.`
              : `نرم‌افزار با موفقیت بر روی سخت‌افزار این سیستم (${newLic.machineId}) فعال گردید.`
          );
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col bg-slate-100 text-slate-900">
      {/* Top Bar Contract: strictly 3 zones separated by gap-8 */}
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 px-4 md:px-6 py-3 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('dashboard');
          }}
          className="text-sm md:text-base font-extrabold tracking-tight text-white whitespace-nowrap truncate max-w-[200px] sm:max-w-none shrink-0"
        >
          ترازبان ویندوز — خرید و فروش ارز و حسابداری دوارزی
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeModule === 'dashboard'
                ? 'text-white font-bold underline underline-offset-8'
                : ''
            }`}
          >
            میز کار ساده
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('fx_desk')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeModule === 'fx_desk'
                ? 'text-white font-bold underline underline-offset-8'
                : ''
            }`}
          >
            خرید و فروش ارز (F1)
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('reports')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeModule === 'reports'
                ? 'text-white font-bold underline underline-offset-8'
                : ''
            }`}
          >
            گزارشات و PDF (F3)
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('vouchers')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeModule === 'vouchers'
                ? 'text-white font-bold underline underline-offset-8'
                : ''
            }`}
          >
            ثبت سند دوارزی (F2)
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('banks')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeModule === 'banks'
                ? 'text-white font-bold underline underline-offset-8'
                : ''
            }`}
          >
            بانک و سرفصل‌ها (F8)
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleInstantFullBackupAndBot}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            بکاپ کامل به بله و تلگرام (F9)
          </button>
        </div>
      </header>

      {/* Main Workspace Container (Sidebar + Active Viewport) */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Windows Enterprise Sidebar Navigation */}
        <aside className="no-print w-full md:w-64 bg-white border-b md:border-b-0 md:border-l border-slate-200 p-3 flex md:flex-col gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'dashboard'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>۱. میز کار ساده (شروع سریع)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('fx_desk')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'fx_desk'
                ? 'bg-emerald-50 text-emerald-900 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 shrink-0 text-emerald-700" />
            <span>۲. خرید و فروش سریع ارز (F1)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('reports')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'reports'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Printer className="w-4 h-4 shrink-0 text-blue-700" />
            <span>۳. گزارش بانک/اشخاص/هزینه + PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('vouchers')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'vouchers'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FilePlus2 className="w-4 h-4 shrink-0" />
            <span>۴. ثبت سند و تبدیل ارز (F2)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('statements')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'statements'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>۵. صورتحساب ریالی/ارزی اشخاص</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('banks')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'banks'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Landmark className="w-4 h-4 shrink-0" />
            <span>۶. بانک‌ها، مغایرت و سرفصل</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('invoices')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'invoices'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>۷. صدور فاکتور و ارسال با بات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('backup')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'backup'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <DatabaseBackup className="w-4 h-4 shrink-0" />
            <span>۸. بکاپ، انبار و نسخه ویندوز</span>
          </button>

          <div className="hidden md:block mt-auto pt-4 border-t border-slate-200 px-2 space-y-1.5 text-[11px] text-slate-500">
            <div className="font-bold text-slate-700">{state.companyName}</div>
            <div>{state.fiscalYear} · نسخه ویندوز دسکتاپ (.EXE)</div>
            <div className="font-mono-num text-emerald-800 font-semibold">
              سخت‌افزار فعال: {licenseStatus.machineId}
            </div>
            <button
              type="button"
              onClick={() => setLicenseStatus(lockApplicationLicense())}
              className="mt-1 flex items-center gap-1 text-[11px] text-rose-700 hover:underline cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>قفل مجدد برنامه</span>
            </button>
          </div>
        </aside>

        {/* Main Active Content Area */}
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 max-w-[1440px] w-full mx-auto space-y-4">
          {globalBanner && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{globalBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalBanner(null)}
                className="text-xs underline"
              >
                بستن
              </button>
            </div>
          )}

          {activeModule === 'dashboard' && (
            <DashboardOverview
              state={state}
              onNavigate={(tab) => setActiveModule(tab)}
              onQuickBackup={handleInstantFullBackupAndBot}
            />
          )}

          {activeModule === 'fx_desk' && (
            <FXTradingDeskView
              state={state}
              onExecuteFXDeal={handleExecuteFXDeal}
              onRecordBotLog={handleRecordBotLog}
              onUpdateCurrencyRate={handleUpdateCurrencyRate}
            />
          )}

          {activeModule === 'reports' && (
            <StandardAccountingReportsView
              state={state}
              onRecordBotLog={handleRecordBotLog}
            />
          )}

          {activeModule === 'vouchers' && (
            <VoucherEntryView
              state={state}
              onSaveVoucher={handleSaveVoucher}
              onDeleteVoucher={handleDeleteVoucher}
            />
          )}

          {activeModule === 'statements' && (
            <PersonStatementsView
              state={state}
              onAddContact={handleAddContact}
              onRecordBotLog={handleRecordBotLog}
            />
          )}

          {activeModule === 'invoices' && (
            <InvoicesAndBotView
              state={state}
              onIssueInvoice={handleIssueInvoice}
              onRecordBotLog={handleRecordBotLog}
            />
          )}

          {activeModule === 'banks' && (
            <BanksAndReconciliationView
              state={state}
              onAddBank={handleAddBank}
              onAddBankStatementEntry={handleAddBankStatementEntry}
              onRecordBankDiscrepancyVoucher={handleRecordBankDiscrepancyVoucher}
              onAddAccount={handleAddAccount}
              onUpdateCurrencyRate={handleUpdateCurrencyRate}
            />
          )}

          {activeModule === 'backup' && (
            <BackupAndWarehouseView
              state={state}
              onUpdateBotConfig={handleUpdateBotConfig}
              onRecordBotLog={handleRecordBotLog}
              onRestoreFullBackup={(restored) => setState(restored)}
              onRecordInventoryMovement={handleRecordInventoryMovement}
            />
          )}
        </main>
      </div>
    </div>
  );
}
