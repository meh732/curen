import React, { useState, useEffect, useMemo, useRef } from 'react';
import { INITIAL_ACCOUNTING_STATE, BLANK_ACCOUNTING_STATE } from './data/initialAccountingData';
import {
  AccountingState,
  Currency,
  Account,
  Contact,
  BankAccount,
  ProductItem,
  JournalVoucher,
  VoucherLine,
  FXDeal,
  SalesInvoice,
  InventoryMovement,
  BankStatementEntry,
  BotConfig,
  BotDeliveryLog,
} from './types/accounting';
import { DashboardOverview } from './components/DashboardOverview';
import { FXTradingDeskView } from './components/FXTradingDeskView';
import { VoucherEntryView } from './components/VoucherEntryView';
import { PersonStatementsView } from './components/PersonStatementsView';
import { BackupAndWarehouseView } from './components/BackupAndWarehouseView';
import { InvoicesAndBotView } from './components/InvoicesAndBotView';
import { BanksAndReconciliationView } from './components/BanksAndReconciliationView';
import { StandardAccountingReportsView } from './components/StandardAccountingReportsView';
import { OfflineActivationModal } from './components/OfflineActivationModal';
import { CurrencyManagerModal } from './components/CurrencyManagerModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import {
  loadLicenseStatus,
  fetchServerLicenseStatus,
  LicenseStatus,
} from './utils/offlineLicenseEngine';
import { dispatchToMessengerBot } from './utils/botAndBackupService';
import {
  LayoutDashboard,
  Coins,
  Sparkles,
  Users,
  Package,
  ShoppingBag,
  Landmark,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Server,
  Database,
  Smartphone,
} from 'lucide-react';

type NavTab =
  | 'dashboard'
  | 'invoices'
  | 'vouchers'
  | 'fx_desk'
  | 'persons'
  | 'banks'
  | 'inventory'
  | 'reports';

const STORAGE_KEY = 'TARAZBAN_PERSONAL_ACCOUNTING_STATE_V8';

export function App() {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(() =>
    loadLicenseStatus()
  );

  // بررسی خودکار فایل لایسنس سروری (در صورت استقرار روی هاست/سرور)
  useEffect(() => {
    if (licenseStatus.isActivated) return;
    fetchServerLicenseStatus()
      .then((serverStatus) => {
        if (serverStatus && serverStatus.isActivated) {
          setLicenseStatus(serverStatus);
        }
      })
      .catch(() => {});
  }, [licenseStatus.isActivated]);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const loadInitialState = (): AccountingState | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
    return null;
  };

  const savedState = loadInitialState();

  const [currencies, setCurrencies] = useState<Currency[]>(
    savedState?.currencies || INITIAL_ACCOUNTING_STATE.currencies
  );
  const [accounts, setAccounts] = useState<Account[]>(
    savedState?.accounts || INITIAL_ACCOUNTING_STATE.accounts
  );
  const [contacts, setContacts] = useState<Contact[]>(
    savedState?.contacts || INITIAL_ACCOUNTING_STATE.contacts
  );
  const [banks, setBanks] = useState<BankAccount[]>(
    savedState?.banks || INITIAL_ACCOUNTING_STATE.banks
  );
  const [products, setProducts] = useState<ProductItem[]>(
    savedState?.products || INITIAL_ACCOUNTING_STATE.products
  );
  const [vouchers, setVouchers] = useState<JournalVoucher[]>(
    savedState?.vouchers || INITIAL_ACCOUNTING_STATE.vouchers
  );
  const [fxDeals, setFxDeals] = useState<FXDeal[]>(
    savedState?.fxDeals || INITIAL_ACCOUNTING_STATE.fxDeals
  );
  const [invoices, setInvoices] = useState<SalesInvoice[]>(
    savedState?.invoices || INITIAL_ACCOUNTING_STATE.invoices
  );
  const [movements, setMovements] = useState<InventoryMovement[]>(
    savedState?.inventoryMovements || INITIAL_ACCOUNTING_STATE.inventoryMovements
  );
  const [bankStatements, setBankStatements] = useState<BankStatementEntry[]>(
    savedState?.bankStatementEntries || INITIAL_ACCOUNTING_STATE.bankStatementEntries
  );
  const [botConfig, setBotConfig] = useState<BotConfig>(
    savedState?.botConfig || INITIAL_ACCOUNTING_STATE.botConfig
  );
  const [botLogs, setBotLogs] = useState<BotDeliveryLog[]>(
    savedState?.botLogs || INITIAL_ACCOUNTING_STATE.botLogs
  );

  const fullAccountingState: AccountingState = useMemo(
    () => ({
      companyName: INITIAL_ACCOUNTING_STATE.companyName,
      fiscalYear: INITIAL_ACCOUNTING_STATE.fiscalYear,
      currencies,
      accounts,
      contacts,
      banks,
      products,
      inventoryMovements: movements,
      vouchers,
      bankStatementEntries: bankStatements,
      invoices,
      fxDeals,
      botConfig,
      botLogs,
    }),
    [
      currencies,
      accounts,
      contacts,
      banks,
      products,
      movements,
      vouchers,
      bankStatements,
      invoices,
      fxDeals,
      botConfig,
      botLogs,
    ]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullAccountingState));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }, [fullAccountingState]);

  // وضعیت ارتباط شبکه و همگام‌سازی با سرور لینوکس
  const [networkSyncStatus, setNetworkSyncStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [showBlankConfirmModal, setShowBlankConfirmModal] = useState<boolean>(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState<boolean>(false);
  const lastServerUpdatedAtRef = useRef<string | null>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);

  // ۱. همگام‌سازی اولیه با سرور لینوکس (خواندن دیتابیس مشترک یا بارگذاری اولیه)
  useEffect(() => {
    let isMounted = true;
    const fetchInitialServerState = async () => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error('Server not reachable');
        const data = await res.json();
        if (!isMounted) return;

        setNetworkSyncStatus('connected');
        if (data.success && data.exists && data.state) {
          lastServerUpdatedAtRef.current = data.updatedAt;
          isRemoteUpdateRef.current = true;
          handleRestoreFullBackup(data.state);
          setLastSyncTime(new Date().toLocaleTimeString('fa-IR'));
        } else {
          // ذخیره وضعیت فعلی بر روی سرور برای سایر کلاینت‌ها
          await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: fullAccountingState }),
          });
          setLastSyncTime(new Date().toLocaleTimeString('fa-IR'));
        }
      } catch (err) {
        console.warn('Working in local/offline standalone mode:', err);
        if (isMounted) setNetworkSyncStatus('offline');
      }
    };

    fetchInitialServerState();
    return () => {
      isMounted = false;
    };
  }, []);

  // ۲. همگام‌سازی زنده دوره‌ای (Polling هر ۵ ثانیه): هر تغییری از گوشی یا کلاینت دیگر فورا روی این کلاینت اعمال می‌شود
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) {
          setNetworkSyncStatus('offline');
          return;
        }
        const data = await res.json();
        setNetworkSyncStatus('connected');

        if (
          data.success &&
          data.exists &&
          data.updatedAt &&
          lastServerUpdatedAtRef.current &&
          data.updatedAt !== lastServerUpdatedAtRef.current &&
          data.state
        ) {
          lastServerUpdatedAtRef.current = data.updatedAt;
          isRemoteUpdateRef.current = true;
          handleRestoreFullBackup(data.state);
          setLastSyncTime(new Date().toLocaleTimeString('fa-IR'));
        }
      } catch {
        setNetworkSyncStatus('offline');
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // ۳. ارسال خودکار تغییرات به سرور مشترک لینوکس (Debounced Sync)
  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: fullAccountingState }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.updatedAt) {
            lastServerUpdatedAtRef.current = data.updatedAt;
          }
          setNetworkSyncStatus('connected');
          setLastSyncTime(new Date().toLocaleTimeString('fa-IR'));
        }
      } catch {
        // سرور موقتا در دسترس نیست
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [fullAccountingState]);

  // ۴. ارسال خودکار ساعتی بکاپ به ربات‌های بله و تلگرام
  useEffect(() => {
    if (!botConfig.baleEnabled && !botConfig.telegramEnabled) return;

    const intervalHours = Math.max(1, botConfig.autoBackupIntervalHours || 1);
    const backupIntervalMs = intervalHours * 60 * 60 * 1000;

    const intervalId = setInterval(async () => {
      const now = new Date();
      const timeStr = `1404/08/12 - ${now.toTimeString().slice(0, 8)}`;
      const backupSummary = `پشتیبان خودکار ساعتی (${intervalHours} ساعته) با موفقیت در دیتابیس مرکزی سرور لینوکس ثبت و به ربات پیام‌رسان ارسال شد.`;

      if (botConfig.baleEnabled && botConfig.baleDefaultChatId) {
        const log = await dispatchToMessengerBot({
          platform: 'bale',
          botToken: botConfig.baleBotToken,
          chatId: botConfig.baleDefaultChatId,
          recipientName: 'بکاپ خودکار بله (ساعتی)',
          messageType: 'backup',
          text: `📦 *پشتیبان خودکار ساعتی ترازبان*\n📅 زمان: ${timeStr}\n${backupSummary}\n\nاطلاعات کامل در سرور مرکزی لینوکس سینک و پایدار شد.`,
          summary: backupSummary,
        });
        setBotLogs((prev) => [log, ...prev]);
      }

      if (botConfig.telegramEnabled && botConfig.telegramDefaultChatId) {
        const log = await dispatchToMessengerBot({
          platform: 'telegram',
          botToken: botConfig.telegramBotToken,
          chatId: botConfig.telegramDefaultChatId,
          recipientName: 'بکاپ خودکار تلگرام (ساعتی)',
          messageType: 'backup',
          text: `📦 *پشتیبان خودکار ساعتی ترازبان*\n📅 زمان: ${timeStr}\n${backupSummary}\n\nاطلاعات کامل در سرور مرکزی لینوکس سینک و پایدار شد.`,
          summary: backupSummary,
        });
        setBotLogs((prev) => [log, ...prev]);
      }

      setBotConfig((prev) => ({
        ...prev,
        lastBackupTime: timeStr,
      }));
    }, backupIntervalMs);

    return () => clearInterval(intervalId);
  }, [
    botConfig.autoBackupIntervalHours,
    botConfig.baleEnabled,
    botConfig.telegramEnabled,
    botConfig.baleBotToken,
    botConfig.baleDefaultChatId,
    botConfig.telegramBotToken,
    botConfig.telegramDefaultChatId,
    fullAccountingState,
  ]);

  // تابع کمکی برای تشخیص سرفصل متناظر با بانک یا صندوق
  const getAccountForBank = (bank?: BankAccount) => {
    if (!bank) return { code: '1102', name: 'موجودی بانک‌های ریالی' };
    if (bank.currency !== 'IRR') {
      return {
        code: '1103',
        name: 'موجودی بانک‌ها و خزانه‌های ارزی',
      };
    }
    if (bank.kind === 'cash_box') {
      return { code: '1101', name: 'موجودی نقد و صندوق‌ها (ریالی و ارزی)' };
    }
    return { code: '1102', name: 'موجودی بانک‌های ریالی' };
  };

  // ثبت معامله خرید و فروش ارز + ثبت خودکار اسناد دریافت/پرداخت چندبانکی و چندصندوقی
  const handleExecuteFXDeal = (deal: FXDeal) => {
    setFxDeals([deal, ...fxDeals]);

    const isBuy = deal.type === 'buy';
    const vaultBank =
      banks.find((b) => b.id === deal.targetForeignBankId) ||
      banks.find((b) => b.currency === deal.currency);
    const vaultAcc = getAccountForBank(vaultBank);

    const personAccCode = isBuy ? '2101' : '1104';
    const personAccName = isBuy
      ? 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)'
      : 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)';

    const vchId = deal.linkedVoucherId || `vch-fx-${Date.now()}`;
    const vaultLineId = `ln-fx-vault-${Date.now()}-1`;

    const lines: VoucherLine[] = [
      // ۱. ردیف ورود یا خروج ارز به صندوق/حساب ارزی ما
      {
        id: vaultLineId,
        accountCode: vaultAcc.code,
        accountName: vaultAcc.name,
        bankId: vaultBank?.id,
        bankName: vaultBank?.bankName,
        description: `${isBuy ? 'خرید ارز و ورود به' : 'فروش ارز و خروج از'} ${
          vaultBank?.bankName || 'خزانه ارزی'
        } (${deal.foreignAmount} ${deal.currency} به نرخ ${deal.exchangeRate})`,
        currency: deal.currency,
        exchangeRate: deal.exchangeRate,
        debitForeign: isBuy ? deal.foreignAmount : 0,
        creditForeign: isBuy ? 0 : deal.foreignAmount,
        debitIRR: isBuy ? deal.totalIRR : 0,
        creditIRR: isBuy ? 0 : deal.totalIRR,
        trackingNumber: deal.dealNumber,
        reconciled: true,
      },
      // ۲. ردیف ثبت اصل معامله در حساب شخص
      {
        id: `ln-fx-person-${Date.now()}-2`,
        accountCode: personAccCode,
        accountName: personAccName,
        contactId: deal.contactId,
        contactName: deal.contactName,
        description: `${isBuy ? 'خرید' : 'فروش'} ${deal.foreignAmount} ${
          deal.currency
        } به نرخ ${deal.exchangeRate} ریال (${deal.dealNumber})`,
        currency: deal.currency,
        exchangeRate: deal.exchangeRate,
        debitForeign: isBuy ? 0 : deal.foreignAmount,
        creditForeign: isBuy ? deal.foreignAmount : 0,
        debitIRR: isBuy ? 0 : deal.totalIRR,
        creditIRR: isBuy ? deal.totalIRR : 0,
        trackingNumber: deal.dealNumber,
      },
    ];

    const newBankStatements: BankStatementEntry[] = [];
    if (vaultBank) {
      newBankStatements.push({
        id: `bs-fx-v-${Date.now()}`,
        bankId: vaultBank.id,
        date: deal.date,
        trackingNumber: deal.dealNumber,
        description: `${isBuy ? 'ورود ارز خریداری‌شده' : 'خروج ارز فروخته‌شده'} (${
          deal.contactName
        })`,
        currency: deal.currency,
        depositForeign: isBuy ? deal.foreignAmount : 0,
        withdrawalForeign: isBuy ? 0 : deal.foreignAmount,
        depositIRR: isBuy ? deal.totalIRR : 0,
        withdrawalIRR: isBuy ? 0 : deal.totalIRR,
        matchedVoucherLineId: vaultLineId,
      });
    }

    // ۳. ثبت خودکار ردیف‌های دریافت یا پرداخت چند بانکی / چند صندوقی در همان سند
    if (deal.payments && deal.payments.length > 0) {
      deal.payments.forEach((sp, idx) => {
        if (!sp.bankId || sp.amountIRR <= 0) return;
        const payBank = banks.find((b) => b.id === sp.bankId);
        const payBankAcc = getAccountForBank(payBank);
        const isReceipt = !isBuy; // در فروش ارز، پول دریافت می‌کنیم؛ در خرید ارز، پول پرداخت می‌کنیم

        const splitDesc = `${
          isReceipt ? 'واریز به' : 'برداشت از'
        } ${payBank?.bankName || 'بانک/صندوق'} بابت تسویه ${deal.dealNumber} (${
          deal.contactName
        })`;
        const payBankLineId = `ln-fx-pay-b-${Date.now()}-${idx}`;
        const trk = sp.trackingNumber || `${deal.dealNumber}-${idx + 1}`;

        // آرتیکل بانک / صندوق
        lines.push({
          id: payBankLineId,
          accountCode: payBankAcc.code,
          accountName: payBankAcc.name,
          bankId: sp.bankId,
          bankName: payBank?.bankName,
          description: splitDesc,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isReceipt ? sp.amountForeign : 0,
          creditForeign: isReceipt ? 0 : sp.amountForeign,
          debitIRR: isReceipt ? sp.amountIRR : 0,
          creditIRR: isReceipt ? 0 : sp.amountIRR,
          trackingNumber: trk,
          reconciled: true,
        });

        // آرتیکل تسویه حساب شخص
        lines.push({
          id: `ln-fx-pay-p-${Date.now()}-${idx}`,
          accountCode: personAccCode,
          accountName: personAccName,
          contactId: deal.contactId,
          contactName: deal.contactName,
          description: `${
            isReceipt ? 'دریافت از شخص و واریز به' : 'پرداخت به شخص از'
          } ${payBank?.bankName || 'بانک/صندوق'} بابت ${deal.dealNumber}`,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isReceipt ? 0 : sp.amountForeign,
          creditForeign: isReceipt ? sp.amountForeign : 0,
          debitIRR: isReceipt ? 0 : sp.amountIRR,
          creditIRR: isReceipt ? sp.amountIRR : 0,
          trackingNumber: trk,
        });

        newBankStatements.push({
          id: `bs-fx-p-${Date.now()}-${idx}`,
          bankId: sp.bankId,
          date: deal.date,
          trackingNumber: trk,
          description: splitDesc,
          currency: sp.currency,
          depositForeign: isReceipt ? sp.amountForeign : 0,
          withdrawalForeign: isReceipt ? 0 : sp.amountForeign,
          depositIRR: isReceipt ? sp.amountIRR : 0,
          withdrawalIRR: isReceipt ? 0 : sp.amountIRR,
          matchedVoucherLineId: payBankLineId,
        });
      });
    }

    const autoVoucher: JournalVoucher = {
      id: vchId,
      voucherNumber: 1004 + vouchers.length,
      date: deal.date,
      description: `سند اتوماتیک ${isBuy ? 'خرید' : 'فروش'} ارز ${deal.dealNumber} (${
        deal.contactName
      })`,
      referenceNumber: deal.dealNumber,
      autoType: 'fx_deal',
      status: 'permanent',
      createdAt: deal.date,
      lines,
    };

    setVouchers([autoVoucher, ...vouchers]);
    if (newBankStatements.length > 0) {
      setBankStatements([...newBankStatements, ...bankStatements]);
    }
  };

  // صدور فاکتور خرید یا فروش + ثبت خودکار اسناد بانک‌ها و صندوق‌های ترکیبی و حساب شخص
  const handleIssueInvoice = (invoice: SalesInvoice) => {
    setInvoices([invoice, ...invoices]);

    const isSales = invoice.type !== 'purchase';

    // ۱. به‌روزرسانی موجودی انبار برای کالاهای انتخاب‌شده از انبار
    const newMovements: InventoryMovement[] = [];
    const updatedProducts = products.map((p) => {
      const soldItem = invoice.items.find((i) => i.productId === p.id);
      if (!soldItem) return p;

      const delta = isSales ? -soldItem.quantity : soldItem.quantity;
      newMovements.push({
        id: `mov-inv-${Date.now()}-${p.id}`,
        date: invoice.date,
        productId: p.id,
        productSku: p.sku,
        productName: p.name,
        type: isSales ? 'outbound' : 'inbound',
        quantity: soldItem.quantity,
        unitPriceForeign: soldItem.unitPriceIRR,
        currency: 'IRR',
        exchangeRate: 1,
        unitPriceIRR: soldItem.unitPriceIRR,
        referenceDoc: invoice.invoiceNumber,
        warehouseName: invoice.warehouseName || 'انبار مرکزی',
        notes: `فاکتور ${isSales ? 'فروش' : 'خرید'} ${invoice.invoiceNumber}`,
      });
      return {
        ...p,
        stockQty: Math.max(0, p.stockQty + delta),
      };
    });

    setProducts(updatedProducts);
    if (newMovements.length > 0) {
      setMovements([...newMovements, ...movements]);
    }

    // ۲. ساخت آرتیکل‌های سند حسابداری اتوماتیک فاکتور
    const personAccCode = isSales ? '1104' : '2101';
    const personAccName = isSales
      ? 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)'
      : 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)';

    const lines: VoucherLine[] = [];

    if (isSales) {
      // بدهکار کردن مشتری بابت کل فاکتور فروش
      lines.push({
        id: `ln-inv-cust-${Date.now()}-1`,
        accountCode: '1104',
        accountName: 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)',
        contactId: invoice.contactId,
        contactName: invoice.contactName,
        description: `فاکتور فروش شماره ${invoice.invoiceNumber} - ${invoice.contactName}`,
        currency: 'IRR',
        exchangeRate: 1,
        debitForeign: invoice.grandTotalIRR,
        creditForeign: 0,
        debitIRR: invoice.grandTotalIRR,
        creditIRR: 0,
        trackingNumber: invoice.invoiceNumber,
      });

      // بستانکار کردن درآمد فروش
      const netSalesIRR = invoice.subtotalIRR - invoice.totalDiscountIRR;
      lines.push({
        id: `ln-inv-rev-${Date.now()}-2`,
        accountCode: '4101',
        accountName: 'درآمد فروش ریالی',
        description: `فروش طبق فاکتور ${invoice.invoiceNumber}`,
        currency: 'IRR',
        exchangeRate: 1,
        debitForeign: 0,
        creditForeign: netSalesIRR,
        debitIRR: 0,
        creditIRR: netSalesIRR,
        trackingNumber: invoice.invoiceNumber,
      });

      if (invoice.totalTaxIRR > 0) {
        lines.push({
          id: `ln-inv-tax-${Date.now()}-3`,
          accountCode: '2102',
          accountName: 'اسناد و چک‌های پرداختنی',
          description: `مالیات فاکتور ${invoice.invoiceNumber}`,
          currency: 'IRR',
          exchangeRate: 1,
          debitForeign: 0,
          creditForeign: invoice.totalTaxIRR,
          debitIRR: 0,
          creditIRR: invoice.totalTaxIRR,
        });
      }
    } else {
      // فاکتور خرید: بدهکار کردن موجودی کالا/خرید (1106) و بستانکار کردن فروشنده (2101)
      lines.push({
        id: `ln-inv-pur-${Date.now()}-1`,
        accountCode: '1106',
        accountName: 'موجودی کالا و خرید انبار',
        description: `خرید کالا/خدمات طبق فاکتور ${invoice.invoiceNumber} از ${invoice.contactName}`,
        currency: 'IRR',
        exchangeRate: 1,
        debitForeign: invoice.grandTotalIRR,
        creditForeign: 0,
        debitIRR: invoice.grandTotalIRR,
        creditIRR: 0,
        trackingNumber: invoice.invoiceNumber,
      });

      lines.push({
        id: `ln-inv-sup-${Date.now()}-2`,
        accountCode: '2101',
        accountName: 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)',
        contactId: invoice.contactId,
        contactName: invoice.contactName,
        description: `فاکتور خرید شماره ${invoice.invoiceNumber} - ${invoice.contactName}`,
        currency: 'IRR',
        exchangeRate: 1,
        debitForeign: 0,
        creditForeign: invoice.grandTotalIRR,
        debitIRR: 0,
        creditIRR: invoice.grandTotalIRR,
        trackingNumber: invoice.invoiceNumber,
      });
    }

    // ۳. ثبت خودکار تمامی ردیف‌های دریافت یا پرداخت ترکیبی (چند بانکی / چند صندوقی / ارزی)
    const newBankStatements: BankStatementEntry[] = [];
    if (invoice.payments && invoice.payments.length > 0) {
      invoice.payments.forEach((sp, idx) => {
        if (!sp.bankId || sp.amountIRR <= 0) return;
        const payBank = banks.find((b) => b.id === sp.bankId);
        const payBankAcc = getAccountForBank(payBank);

        const splitDesc = `${
          isSales ? 'دریافت وجه فاکتور فروش و واریز به' : 'پرداخت وجه فاکتور خرید از'
        } ${payBank?.bankName || 'بانک/صندوق'} بابت ${invoice.invoiceNumber} (${
          invoice.contactName
        })`;
        const payBankLineId = `ln-inv-pay-b-${Date.now()}-${idx}`;
        const trk = sp.trackingNumber || `${invoice.invoiceNumber}-${idx + 1}`;

        // ردیف بانک یا صندوق
        lines.push({
          id: payBankLineId,
          accountCode: payBankAcc.code,
          accountName: payBankAcc.name,
          bankId: sp.bankId,
          bankName: payBank?.bankName,
          description: splitDesc,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isSales ? sp.amountForeign : 0,
          creditForeign: isSales ? 0 : sp.amountForeign,
          debitIRR: isSales ? sp.amountIRR : 0,
          creditIRR: isSales ? 0 : sp.amountIRR,
          trackingNumber: trk,
          reconciled: true,
        });

        // ردیف کسر از حساب شخص (تسویه)
        lines.push({
          id: `ln-inv-pay-p-${Date.now()}-${idx}`,
          accountCode: personAccCode,
          accountName: personAccName,
          contactId: invoice.contactId,
          contactName: invoice.contactName,
          description: `${
            isSales ? 'تسویه/دریافت از مشتری به' : 'تسویه/پرداخت به فروشنده از'
          } ${payBank?.bankName || 'بانک/صندوق'} (${
            sp.currency !== 'IRR'
              ? `${sp.amountForeign} ${sp.currency} به نرخ ${sp.exchangeRate}`
              : `${sp.amountIRR} ریال`
          })`,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isSales ? 0 : sp.amountForeign,
          creditForeign: isSales ? sp.amountForeign : 0,
          debitIRR: isSales ? 0 : sp.amountIRR,
          creditIRR: isSales ? sp.amountIRR : 0,
          trackingNumber: trk,
        });

        newBankStatements.push({
          id: `bs-inv-${Date.now()}-${idx}`,
          bankId: sp.bankId,
          date: invoice.date,
          trackingNumber: trk,
          description: splitDesc,
          currency: sp.currency,
          depositForeign: isSales ? sp.amountForeign : 0,
          withdrawalForeign: isSales ? 0 : sp.amountForeign,
          depositIRR: isSales ? sp.amountIRR : 0,
          withdrawalIRR: isSales ? 0 : sp.amountIRR,
          matchedVoucherLineId: payBankLineId,
        });
      });
    }

    const vchId = invoice.linkedVoucherId || `vch-inv-${Date.now()}`;
    const autoVoucher: JournalVoucher = {
      id: vchId,
      voucherNumber: 1004 + vouchers.length,
      date: invoice.date,
      description: `سند اتوماتیک فاکتور ${isSales ? 'فروش' : 'خرید'} ${
        invoice.invoiceNumber
      } (${invoice.contactName})`,
      referenceNumber: invoice.invoiceNumber,
      invoiceId: invoice.id,
      autoType: 'invoice',
      status: 'permanent',
      createdAt: invoice.date,
      lines,
    };

    setVouchers([autoVoucher, ...vouchers]);
    if (newBankStatements.length > 0) {
      setBankStatements([...newBankStatements, ...bankStatements]);
    }
  };

  // ثبت سند مالی (اتوماتیک یا دستی) + همگام‌سازی خودکار صورتحساب بانک
  const handleAddVoucher = (v: JournalVoucher) => {
    setVouchers([v, ...vouchers]);

    const newStatements: BankStatementEntry[] = [];
    v.lines.forEach((ln, idx) => {
      if (ln.bankId && (ln.debitIRR > 0 || ln.creditIRR > 0)) {
        newStatements.push({
          id: `bs-vch-${Date.now()}-${idx}`,
          bankId: ln.bankId,
          date: v.date,
          trackingNumber: ln.trackingNumber || `VCH-${v.voucherNumber}-${idx + 1}`,
          description: ln.description || v.description,
          currency: ln.currency,
          depositForeign: ln.debitForeign || ln.debitIRR,
          withdrawalForeign: ln.creditForeign || ln.creditIRR,
          depositIRR: ln.debitIRR,
          withdrawalIRR: ln.creditIRR,
          matchedVoucherLineId: ln.id,
        });
      }
    });

    if (newStatements.length > 0) {
      setBankStatements([...newStatements, ...bankStatements]);
    }
  };

  // ویرایش فاکتور خرید یا فروش + به‌روزرسانی خودکار سند متناظر و گردش بانک‌ها
  const handleUpdateInvoice = (updated: SalesInvoice) => {
    setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));

    if (updated.linkedVoucherId) {
      setVouchers((prev) =>
        prev.map((v) => {
          if (v.id === updated.linkedVoucherId) {
            const isSales = updated.type !== 'purchase';
            const personAccCode = isSales ? '1104' : '2101';
            const personAccName = isSales
              ? 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)'
              : 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)';

            const lines: VoucherLine[] = [];
            if (isSales) {
              lines.push({
                id: `ln-inv-cust-${Date.now()}-1`,
                accountCode: '1104',
                accountName: 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)',
                contactId: updated.contactId,
                contactName: updated.contactName,
                description: `فاکتور فروش شماره ${updated.invoiceNumber} - ${updated.contactName}`,
                currency: 'IRR',
                exchangeRate: 1,
                debitForeign: updated.grandTotalIRR,
                creditForeign: 0,
                debitIRR: updated.grandTotalIRR,
                creditIRR: 0,
                trackingNumber: updated.invoiceNumber,
              });
              const netSalesIRR = updated.subtotalIRR - updated.totalDiscountIRR;
              lines.push({
                id: `ln-inv-rev-${Date.now()}-2`,
                accountCode: '4101',
                accountName: 'درآمد فروش ریالی',
                description: `فروش طبق فاکتور ${updated.invoiceNumber}`,
                currency: 'IRR',
                exchangeRate: 1,
                debitForeign: 0,
                creditForeign: netSalesIRR,
                debitIRR: 0,
                creditIRR: netSalesIRR,
                trackingNumber: updated.invoiceNumber,
              });
              if (updated.totalTaxIRR > 0) {
                lines.push({
                  id: `ln-inv-tax-${Date.now()}-3`,
                  accountCode: '2102',
                  accountName: 'اسناد و چک‌های پرداختنی',
                  description: `مالیات فاکتور ${updated.invoiceNumber}`,
                  currency: 'IRR',
                  exchangeRate: 1,
                  debitForeign: 0,
                  creditForeign: updated.totalTaxIRR,
                  debitIRR: 0,
                  creditIRR: updated.totalTaxIRR,
                });
              }
            } else {
              lines.push({
                id: `ln-inv-pur-${Date.now()}-1`,
                accountCode: '1106',
                accountName: 'موجودی کالا و خرید انبار',
                description: `خرید طبق فاکتور ${updated.invoiceNumber} از ${updated.contactName}`,
                currency: 'IRR',
                exchangeRate: 1,
                debitForeign: updated.grandTotalIRR,
                creditForeign: 0,
                debitIRR: updated.grandTotalIRR,
                creditIRR: 0,
                trackingNumber: updated.invoiceNumber,
              });
              lines.push({
                id: `ln-inv-sup-${Date.now()}-2`,
                accountCode: '2101',
                accountName: 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)',
                contactId: updated.contactId,
                contactName: updated.contactName,
                description: `فاکتور خرید شماره ${updated.invoiceNumber} - ${updated.contactName}`,
                currency: 'IRR',
                exchangeRate: 1,
                debitForeign: 0,
                creditForeign: updated.grandTotalIRR,
                debitIRR: 0,
                creditIRR: updated.grandTotalIRR,
                trackingNumber: updated.invoiceNumber,
              });
            }

            if (updated.payments && updated.payments.length > 0) {
              updated.payments.forEach((sp, idx) => {
                if (!sp.bankId || sp.amountIRR <= 0) return;
                const payBank = banks.find((b) => b.id === sp.bankId);
                const payBankAcc = getAccountForBank(payBank);
                const payBankLineId = `ln-inv-pay-b-${Date.now()}-${idx}`;
                const trk = sp.trackingNumber || `${updated.invoiceNumber}-${idx + 1}`;
                lines.push({
                  id: payBankLineId,
                  accountCode: payBankAcc.code,
                  accountName: payBankAcc.name,
                  bankId: sp.bankId,
                  bankName: payBank?.bankName,
                  description: `تسویه ${updated.invoiceNumber} (${sp.bankName || 'بانک/صندوق'})`,
                  currency: sp.currency,
                  exchangeRate: sp.exchangeRate,
                  debitForeign: isSales ? sp.amountForeign : 0,
                  creditForeign: isSales ? 0 : sp.amountForeign,
                  debitIRR: isSales ? sp.amountIRR : 0,
                  creditIRR: isSales ? 0 : sp.amountIRR,
                  trackingNumber: trk,
                  reconciled: true,
                });
                lines.push({
                  id: `ln-inv-pay-p-${Date.now()}-${idx}`,
                  accountCode: personAccCode,
                  accountName: personAccName,
                  contactId: updated.contactId,
                  contactName: updated.contactName,
                  description: `تسویه فاکتور ${updated.invoiceNumber} - ${updated.contactName}`,
                  currency: sp.currency,
                  exchangeRate: sp.exchangeRate,
                  debitForeign: isSales ? 0 : sp.amountForeign,
                  creditForeign: isSales ? sp.amountForeign : 0,
                  debitIRR: isSales ? 0 : sp.amountIRR,
                  creditIRR: isSales ? sp.amountIRR : 0,
                  trackingNumber: trk,
                });
              });
            }

            return {
              ...v,
              date: updated.date,
              description: `سند فاکتور ${isSales ? 'فروش' : 'خرید'} ${updated.invoiceNumber} (${updated.contactName})`,
              lines,
            };
          }
          return v;
        })
      );
    }
  };

  // ویرایش سند مالی دستی یا اتوماتیک و بازتولید ردیف‌های صورتحساب بانک
  const handleUpdateVoucher = (updated: JournalVoucher) => {
    setVouchers((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

    setBankStatements((prev) => {
      const lineIds = new Set(updated.lines.map((l) => l.id));
      const filtered = prev.filter((bs) => !bs.matchedVoucherLineId || !lineIds.has(bs.matchedVoucherLineId));
      const newEntries: BankStatementEntry[] = [];
      updated.lines.forEach((ln, idx) => {
        if (ln.bankId && (ln.debitIRR > 0 || ln.creditIRR > 0)) {
          newEntries.push({
            id: `bs-vch-${Date.now()}-${idx}`,
            bankId: ln.bankId,
            date: updated.date,
            trackingNumber: ln.trackingNumber || `VCH-${updated.voucherNumber}-${idx + 1}`,
            description: ln.description || updated.description,
            currency: ln.currency,
            depositForeign: ln.debitForeign || ln.debitIRR,
            withdrawalForeign: ln.creditForeign || ln.creditIRR,
            depositIRR: ln.debitIRR,
            withdrawalIRR: ln.creditIRR,
            matchedVoucherLineId: ln.id,
          });
        }
      });
      return [...newEntries, ...filtered];
    });
  };

  // تعریف بانک یا صندوق جدید + صدور خودکار سند موجودی اولیه
  const handleAddBank = (newBank: BankAccount) => {
    const initForeign = newBank.initialBalanceForeign || 0;
    const initIRR = newBank.initialBalanceIRR || 0;

    // ذخیره بانک با موجودی اولیه صفر در فیلد پایه و ثبت موجودی اولیه در سند افتتاحیه تا تراز آزمایشی و بانک ۱۰۰٪ منطبق باشند
    const cleanBank: BankAccount = {
      ...newBank,
      initialBalanceForeign: 0,
      initialBalanceIRR: 0,
    };
    setBanks([...banks, cleanBank]);

    if (initIRR > 0) {
      const bankAcc = getAccountForBank(cleanBank);
      const rate =
        cleanBank.currency === 'IRR'
          ? 1
          : currencies.find((c) => c.code === cleanBank.currency)?.defaultRateToIRR || 1;
      const vchId = `vch-init-bnk-${Date.now()}`;
      const lineId = `ln-ib-1-${Date.now()}`;

      const initVoucher: JournalVoucher = {
        id: vchId,
        voucherNumber: 1004 + vouchers.length,
        date: '1404/08/12',
        description: `سند موجودی اولیه ${cleanBank.bankName}`,
        status: 'permanent',
        createdAt: '1404/08/12',
        autoType: 'income',
        lines: [
          {
            id: lineId,
            accountCode: bankAcc.code,
            accountName: bankAcc.name,
            bankId: cleanBank.id,
            bankName: cleanBank.bankName,
            description: `موجودی اولیه ${cleanBank.bankName}`,
            currency: cleanBank.currency,
            exchangeRate: rate,
            debitForeign: initForeign,
            creditForeign: 0,
            debitIRR: initIRR,
            creditIRR: 0,
            trackingNumber: `INIT-${cleanBank.code}`,
            reconciled: true,
          },
          {
            id: `ln-ib-2-${Date.now()}`,
            accountCode: '3101',
            accountName: 'سرمایه و موجودی اول دوره',
            description: `موجودی اولیه ${cleanBank.bankName}`,
            currency: 'IRR',
            exchangeRate: 1,
            debitForeign: 0,
            creditForeign: initIRR,
            debitIRR: 0,
            creditIRR: initIRR,
          },
        ],
      };

      setVouchers([initVoucher, ...vouchers]);
      setBankStatements([
        {
          id: `bs-ib-${Date.now()}`,
          bankId: cleanBank.id,
          date: initVoucher.date,
          trackingNumber: `INIT-${cleanBank.code}`,
          description: `موجودی اولیه ${cleanBank.bankName}`,
          currency: cleanBank.currency,
          depositForeign: initForeign,
          withdrawalForeign: 0,
          depositIRR: initIRR,
          withdrawalIRR: 0,
          matchedVoucherLineId: lineId,
        },
        ...bankStatements,
      ]);
    }
  };

  const handleRegisterMovement = (mov: InventoryMovement) => {
    setMovements([mov, ...movements]);
    setProducts(
      products.map((p) => {
        if (p.id === mov.productId) {
          const delta = mov.type === 'inbound' ? mov.quantity : -mov.quantity;
          return { ...p, stockQty: Math.max(0, p.stockQty + delta) };
        }
        return p;
      })
    );
  };

  const handleRestoreFullBackup = (restored: AccountingState) => {
    setCurrencies(restored.currencies || INITIAL_ACCOUNTING_STATE.currencies);
    setAccounts(restored.accounts || INITIAL_ACCOUNTING_STATE.accounts);
    setContacts(restored.contacts ?? []);
    setBanks(restored.banks || INITIAL_ACCOUNTING_STATE.banks);
    setProducts(restored.products ?? []);
    setVouchers(restored.vouchers ?? []);
    setFxDeals(restored.fxDeals ?? []);
    setInvoices(restored.invoices ?? []);
    setMovements(restored.inventoryMovements ?? []);
    setBankStatements(restored.bankStatementEntries ?? []);
    if (restored.botConfig) setBotConfig(restored.botConfig);
    if (restored.botLogs) setBotLogs(restored.botLogs ?? []);
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    handleRestoreFullBackup(INITIAL_ACCOUNTING_STATE);
  };

  // صفر کردن و خام کردن دیتابیس (حذف تمام داده‌های تستی و شروع واقعی)
  const handleResetToBlankDatabase = async () => {
    try {
      await fetch('/api/reset-blank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blankState: BLANK_ACCOUNTING_STATE }),
      });
    } catch (e) {
      console.warn('Network server reset notice:', e);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(BLANK_ACCOUNTING_STATE));
    handleRestoreFullBackup(BLANK_ACCOUNTING_STATE);
    setShowBlankConfirmModal(false);
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'خلاصه وضعیت من',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'fx_desk',
      label: 'خرید و فروش ارز (صرافی)',
      icon: <Coins className="w-4 h-4 text-amber-400" />,
      badge: 'اصلی',
    },
    {
      id: 'invoices',
      label: 'فاکتور معاملات ارزی',
      icon: <ShoppingBag className="w-4 h-4 text-teal-400" />,
      badge: 'تسویه چندارزی',
    },
    {
      id: 'vouchers',
      label: 'امور مالی و دریافت/پرداخت',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'persons',
      label: 'حساب اشخاص (طلب/بدهی ارزی)',
      icon: <Users className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: 'banks',
      label: 'بانک‌ها و صندوق‌های ارزی',
      icon: <Landmark className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'inventory',
      label: 'موجودی ارزها و پشتیبان',
      icon: <Package className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'reports',
      label: 'گزارش سود و زیان معاملات',
      icon: <FileSpreadsheet className="w-4 h-4 text-rose-400" />,
    },
  ];

  if (!licenseStatus.isActivated) {
    return (
      <OfflineActivationModal
        license={licenseStatus}
        onActivated={(newStatus) => setLicenseStatus(newStatus)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* PWA Install Banner */}
      <PWAInstallPrompt />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-3 sm:px-6 py-2.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <Coins className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  ترازبان ارزی — حسابداری صرافی
                </h1>
                <span className="hidden xs:inline-block px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-md shrink-0">
                  تسویه چندارزی
                </span>
              </div>
              <p className="hidden sm:block text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                طراحی‌شده برای صرافی و حسابداری معاملات ارزی در گوشی و رایانه
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Live Network Server Sync Status */}
            <div className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs rounded-xl border border-slate-200 bg-slate-50">
              {networkSyncStatus === 'connected' ? (
                <>
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <Server className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700 font-bold text-[10px] sm:text-[11px] hidden xs:inline">متصل به سرور</span>
                </>
              ) : networkSyncStatus === 'connecting' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <RefreshCw className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
                  <span className="text-amber-700 font-bold text-[10px] hidden xs:inline">اتصال...</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  <WifiOff className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-slate-600 font-bold text-[10px] hidden xs:inline">آفلاین</span>
                </>
              )}
            </div>

            {/* Manage Currencies Button */}
            <button
              onClick={() => setShowCurrencyModal(true)}
              className="px-2 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[10px] sm:text-[11px] border border-teal-200 transition cursor-pointer shrink-0"
            >
              + ارزها ({currencies.length})
            </button>

            {/* Reset Demo Data */}
            <button
              onClick={handleResetDemoData}
              title="بازگردانی داده‌های پیش‌فرض نمونه"
              className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] sm:text-xs text-slate-700 flex items-center gap-1 transition cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span className="hidden sm:inline">ریست نمونه</span>
            </button>
          </div>
        </div>
      </header>

      {/* Currency Manager Modal */}
      <CurrencyManagerModal
        currencies={currencies}
        isOpen={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        onUpdateCurrencies={setCurrencies}
      />

      {/* Blank Database Confirmation Modal */}
      {showBlankConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-200">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">خام کردن و صفر کردن کامل دیتابیس</h3>
                <p className="text-xs text-slate-500">شروع کار واقعی بدون اسناد یا مشتریان تستی</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-slate-800 leading-relaxed space-y-2">
              <p>
                ⚠️ با تایید این گزینه، <strong>تمام اسناد حسابداری، فاکتورها، معاملات ارزی و اشخاص تستی پاکسازی می‌شوند</strong> و یک دیتابیس کاملاً سفید و خام ایجاد می‌گردد.
              </p>
              <p className="text-slate-600">
                • تنظیمات پایه ارزها و بانک‌های اصلی حفظ می‌گردند تا بتوانید بلافاصله فاکتور و اسناد واقعی خود را وارد نمایید.
              </p>
              <p className="text-emerald-700 font-semibold">
                • این پاکسازی به صورت سراسری در فایل پایگاه‌داده سرور لینوکس نیز اعمال شده و تمام گوشی‌ها و کامپیوترهای متصل همگام می‌شوند.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBlankConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-semibold cursor-pointer transition"
              >
                انصراف
              </button>
              <button
                onClick={handleResetToBlankDatabase}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-xs font-bold text-white cursor-pointer shadow-lg shadow-amber-500/20 transition"
              >
                تایید و خام کردن کامل دیتابیس
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout - Pocket Mobile Friendly with Vertical Sidebar on Desktop & Fixed Bottom Nav Bar on Mobile */}
      <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col lg:flex-row gap-5 p-2.5 sm:p-6 pb-20 lg:pb-6 overflow-x-hidden">
        {/* Navigation Bar (Desktop Vertical Sidebar Only) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col gap-1.5 sticky top-20 z-20 shadow-xs">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`whitespace-nowrap lg:whitespace-normal shrink-0 lg:shrink flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-teal-600 text-white font-bold shadow-md shadow-teal-600/20'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`mr-2 px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Module Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              currencies={currencies}
              accounts={accounts}
              vouchers={vouchers}
              fxDeals={fxDeals}
              invoices={invoices}
              banks={banks}
              contacts={contacts}
              onNavigate={(tab) => setActiveTab(tab as NavTab)}
              onUpdateCurrencies={setCurrencies}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesAndBotView
              invoices={invoices}
              contacts={contacts}
              products={products}
              banks={banks}
              currencies={currencies}
              onIssueInvoice={handleIssueInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onAddContact={(newContact) => setContacts([...contacts, newContact])}
              onDeleteInvoice={(invId) => {
                const target = invoices.find((i) => i.id === invId);
                setInvoices(invoices.filter((i) => i.id !== invId));
                if (target?.linkedVoucherId) {
                  setVouchers(vouchers.filter((v) => v.id !== target.linkedVoucherId));
                }
              }}
            />
          )}

          {activeTab === 'vouchers' && (
            <VoucherEntryView
              accounts={accounts}
              contacts={contacts}
              banks={banks}
              currencies={currencies}
              vouchers={vouchers}
              onAddVoucher={handleAddVoucher}
              onUpdateVoucher={handleUpdateVoucher}
              onAddContact={(newContact) => setContacts([...contacts, newContact])}
              onDeleteVoucher={(id) => {
                setVouchers(vouchers.filter((v) => v.id !== id));
              }}
            />
          )}

          {activeTab === 'fx_desk' && (
            <FXTradingDeskView
              fxDeals={fxDeals}
              currencies={currencies}
              contacts={contacts}
              banks={banks}
              onExecuteDeal={handleExecuteFXDeal}
              onAddContact={(newContact) => setContacts([...contacts, newContact])}
              onDeleteDeal={(dealId) => {
                const target = fxDeals.find((d) => d.id === dealId);
                setFxDeals(fxDeals.filter((d) => d.id !== dealId));
                if (target?.linkedVoucherId) {
                  setVouchers(vouchers.filter((v) => v.id !== target.linkedVoucherId));
                }
              }}
            />
          )}

          {activeTab === 'persons' && (
            <PersonStatementsView
              state={fullAccountingState}
              onAddContact={(newContact) => setContacts([...contacts, newContact])}
              onRecordBotLog={(log) => setBotLogs([log, ...botLogs])}
            />
          )}

          {activeTab === 'banks' && (
            <BanksAndReconciliationView
              banks={banks}
              bankStatements={bankStatements}
              vouchers={vouchers}
              currencies={currencies}
              onAddBankStatement={(entry) =>
                setBankStatements([entry, ...bankStatements])
              }
              onAddBank={handleAddBank}
              onDeleteBank={(id) => setBanks(banks.filter((b) => b.id !== id))}
              onUpdateCurrencies={setCurrencies}
            />
          )}

          {activeTab === 'inventory' && (
            <BackupAndWarehouseView
              state={fullAccountingState}
              onUpdateBotConfig={(patch) => setBotConfig({ ...botConfig, ...patch })}
              onRecordBotLog={(log) => setBotLogs([log, ...botLogs])}
              onRestoreFullBackup={handleRestoreFullBackup}
              onRecordInventoryMovement={handleRegisterMovement}
              onResetToBlankDatabase={handleResetToBlankDatabase}
            />
          )}

          {activeTab === 'reports' && (
            <StandardAccountingReportsView
              state={fullAccountingState}
              onRecordBotLog={(log) => setBotLogs([log, ...botLogs])}
            />
          )}
        </main>
      </div>

      {/* Sticky Bottom Mobile Navigation Bar for Phone Screens */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 backdrop-blur-xl px-1.5 py-2 flex items-center justify-around shadow-xl">
        <button
          onClick={() => setActiveTab('fx_desk')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition ${
            activeTab === 'fx_desk' ? 'text-amber-700 font-bold bg-amber-50' : 'text-slate-600'
          }`}
        >
          <Coins className="w-5 h-5 text-amber-600" />
          <span className="text-[10px]">معامله صرافی</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition ${
            activeTab === 'invoices' ? 'text-teal-700 font-bold bg-teal-50' : 'text-slate-600'
          }`}
        >
          <ShoppingBag className="w-5 h-5 text-teal-600" />
          <span className="text-[10px]">فاکتور ارزی</span>
        </button>

        <button
          onClick={() => setActiveTab('persons')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition ${
            activeTab === 'persons' ? 'text-cyan-700 font-bold bg-cyan-50' : 'text-slate-600'
          }`}
        >
          <Users className="w-5 h-5 text-cyan-600" />
          <span className="text-[10px]">طرف حساب‌ها</span>
        </button>

        <button
          onClick={() => setActiveTab('banks')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition ${
            activeTab === 'banks' ? 'text-indigo-700 font-bold bg-indigo-50' : 'text-slate-600'
          }`}
        >
          <Landmark className="w-5 h-5 text-indigo-600" />
          <span className="text-[10px]">خزانه و بانک</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition ${
            activeTab === 'dashboard' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px]">داشبورد</span>
        </button>
      </div>
    </div>
  );
}

export default App;
