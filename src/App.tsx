import React, { useState, useEffect, useMemo, useRef } from 'react';
import arkaLogo from './assets/arka-logo.jpg';
import { INITIAL_ACCOUNTING_STATE, BLANK_ACCOUNTING_STATE, INITIAL_USERS } from './data/initialAccountingData';
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
  FXDeliverySplit,
  SalesInvoice,
  InventoryMovement,
  BankStatementEntry,
  BotConfig,
  BotDeliveryLog,
  UserAccount,
} from './types/accounting';
import { DashboardOverview } from './components/DashboardOverview';
import { formatNumber, getTodayJalaliDate } from './utils/accountingEngine';
import { FXTradingDeskView } from './components/FXTradingDeskView';
import { VoucherEntryView } from './components/VoucherEntryView';
import { PersonStatementsView } from './components/PersonStatementsView';
import { BackupAndWarehouseView } from './components/BackupAndWarehouseView';
import { InvoicesAndBotView } from './components/InvoicesAndBotView';
import { BanksAndReconciliationView } from './components/BanksAndReconciliationView';
import { StandardAccountingReportsView } from './components/StandardAccountingReportsView';
import { OfflineActivationModal } from './components/OfflineActivationModal';
import { CurrencyManagerModal } from './components/CurrencyManagerModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';
import { InitialSetupWizardModal } from './components/InitialSetupWizardModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { GlobalReceiptSearchModal } from './components/GlobalReceiptSearchModal';
import {
  loadLicenseStatus,
  lockApplicationLicense,
  verifyNativeTauriLicenseLock,
  recoverLicenseFromNativeLock,
  invokeTauriCommand,
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
  WifiOff,
  RefreshCw,
  Server,
  Settings,
  LogOut,
  UserCheck,
  Search,
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

const STORAGE_KEY = 'TARAZBAN_PERSONAL_ACCOUNTING_STATE_V10';
const CURRENT_USER_SESSION_KEY = 'TARAZBAN_CURRENT_USER_SESSION';

export function App() {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(() =>
    loadLicenseStatus()
  );

  // بررسی قفل بومی تائوری و همگام‌سازی لایسنس سرور لینوکس/شبکه تا پس از یک‌بار فعال‌سازی روی سرور، قفل مجدد نخواهد
  useEffect(() => {
    let active = true;

    async function syncLicense() {
      try {
        const res = await fetch('/api/license');
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          if (data && (data.isActivated || data.license?.isActivated)) {
            const srvLic = data.license || data;
            const unlockedStatus: LicenseStatus = {
              isActivated: true,
              machineId: srvLic.machineId || licenseStatus.machineId,
              activatedAt: srvLic.activatedAt || '1405/01/01',
              activationKey: srvLic.activatedKey || srvLic.activationKey || 'SERVER-UNLOCKED',
              activatedKey: srvLic.activatedKey || srvLic.activationKey || 'SERVER-UNLOCKED',
              masterAuthorized: true,
            };
            setLicenseStatus(unlockedStatus);
            return;
          } else if (licenseStatus.isActivated) {
            fetch('/api/license', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ license: licenseStatus }),
            }).catch(() => {});
            return;
          }
        }
      } catch {
        // Offline or Tauri standalone mode
      }

      const valid = await verifyNativeTauriLicenseLock();
      if (!active) return;
      if (valid) {
        const fresh = loadLicenseStatus();
        if (fresh.isActivated) {
          setLicenseStatus(fresh);
        }
      } else {
        setLicenseStatus((prev) => ({
          isActivated: false,
          machineId: prev.machineId,
        }));
      }
    }

    void syncLicense();

    return () => {
      active = false;
    };
  }, []);

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

  const [companyName, setCompanyName] = useState<string>(() => {
    const raw = savedState?.companyName || INITIAL_ACCOUNTING_STATE.companyName;
    return raw.includes('ترازبان') ? raw.replace(/ترازبان/g, 'آرکا') : raw;
  });
  const [currencies, setCurrencies] = useState<Currency[]>(
    savedState?.currencies || INITIAL_ACCOUNTING_STATE.currencies
  );
  const [accounts, setAccounts] = useState<Account[]>(
    savedState?.accounts || INITIAL_ACCOUNTING_STATE.accounts
  );
  const [contacts, setContacts] = useState<Contact[]>(
    savedState?.contacts ?? INITIAL_ACCOUNTING_STATE.contacts
  );
  const [banks, setBanks] = useState<BankAccount[]>(
    savedState?.banks ?? INITIAL_ACCOUNTING_STATE.banks
  );
  const [products, setProducts] = useState<ProductItem[]>(
    savedState?.products ?? INITIAL_ACCOUNTING_STATE.products
  );
  const [vouchers, setVouchers] = useState<JournalVoucher[]>(
    savedState?.vouchers ?? INITIAL_ACCOUNTING_STATE.vouchers
  );
  const [fxDeals, setFxDeals] = useState<FXDeal[]>(
    savedState?.fxDeals ?? INITIAL_ACCOUNTING_STATE.fxDeals
  );
  const [invoices, setInvoices] = useState<SalesInvoice[]>(
    savedState?.invoices ?? INITIAL_ACCOUNTING_STATE.invoices
  );
  const [movements, setMovements] = useState<InventoryMovement[]>(
    savedState?.inventoryMovements ?? INITIAL_ACCOUNTING_STATE.inventoryMovements
  );
  const [bankStatements, setBankStatements] = useState<BankStatementEntry[]>(
    savedState?.bankStatementEntries ?? INITIAL_ACCOUNTING_STATE.bankStatementEntries
  );
  const [botConfig, setBotConfig] = useState<BotConfig>(
    savedState?.botConfig || INITIAL_ACCOUNTING_STATE.botConfig
  );
  const [botLogs, setBotLogs] = useState<BotDeliveryLog[]>(
    savedState?.botLogs ?? INITIAL_ACCOUNTING_STATE.botLogs
  );
  const [users, setUsers] = useState<UserAccount[]>(
    savedState?.users || INITIAL_ACCOUNTING_STATE.users || INITIAL_USERS
  );

  // Active User Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = sessionStorage.getItem(CURRENT_USER_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const fullAccountingState: AccountingState = useMemo(
    () => ({
      companyName: companyName || INITIAL_ACCOUNTING_STATE.companyName,
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
      users,
    }),
    [
      companyName,
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
      users,
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
  const [showBlankSetupWizard, setShowBlankSetupWizard] = useState<boolean>(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState<boolean>(false);
  const [statementInitialContactId, setStatementInitialContactId] = useState<string | null>(null);
  const lastServerUpdatedAtRef = useRef<string | null>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);

  // ۱. همگام‌سازی اولیه با سرور لینوکس
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

  // ۲. همگام‌سازی زنده دوره‌ای (Polling هر ۲ ثانیه برای سینک آنی کلاینت‌ها)
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
    }, 2000);

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
    }, 500);

    return () => clearTimeout(timer);
  }, [fullAccountingState]);

  const latestStateRef = useRef<AccountingState>(fullAccountingState);
  useEffect(() => {
    latestStateRef.current = fullAccountingState;
  }, [fullAccountingState]);

  // تابع مرکزی ذخیره بکاپ اتوماتیک در ویندوز Tauri و سرور لینوکس/محلی
  const performAutoBackup = async (reason: string): Promise<string | null> => {
    let savedPath: string | null = null;
    const stateToSave = latestStateRef.current;
    const payloadObj = {
      app: 'TarazBan Personal & Exchange Multi-Currency Accounting',
      version: '2.5.0',
      reason,
      exportedAtISO: new Date().toISOString(),
      data: stateToSave,
    };

    try {
      const tauriSaved = await invokeTauriCommand<string>('save_auto_backup', {
        jsonContent: JSON.stringify(payloadObj, null, 2),
        reason,
      });
      if (tauriSaved) {
        savedPath = tauriSaved;
      }

      const res = await fetch('/api/auto-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateToSave, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!savedPath) {
          savedPath = data.latestPath || data.backupPath || null;
        }
      }
    } catch {
      // ignore offline error
    }
    return savedPath;
  };

  // ۴. بکاپ اتوماتیک اولیه + بکاپ اتوماتیک موقع بستن برنامه (ویندوز تائوری و مرورگر)
  useEffect(() => {
    const startupTimer = setTimeout(() => {
      performAutoBackup('startup_auto');
    }, 3000);

    const handleBeforeUnloadOrClose = () => {
      try {
        const stateSnapshot = latestStateRef.current;
        void invokeTauriCommand('save_auto_backup', {
          jsonContent: JSON.stringify(
            {
              app: 'ARKA Personal & Exchange Multi-Currency Accounting',
              version: '6.0.0',
              reason: 'app_close_auto',
              exportedAtISO: new Date().toISOString(),
              data: stateSnapshot,
            },
            null,
            2
          ),
          reason: 'app_close_auto',
        });

        if (navigator.sendBeacon) {
          const blob = new Blob(
            [JSON.stringify({ state: stateSnapshot, reason: 'app_close_auto' })],
            { type: 'application/json' }
          );
          navigator.sendBeacon('/api/auto-backup', blob);
        }
      } catch {
        // ignore close error
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnloadOrClose);
    window.addEventListener('pagehide', handleBeforeUnloadOrClose);

    return () => {
      clearTimeout(startupTimer);
      window.removeEventListener('beforeunload', handleBeforeUnloadOrClose);
      window.removeEventListener('pagehide', handleBeforeUnloadOrClose);
    };
  }, []);

  // ۵. بکاپ اتوماتیک هر ۲ ساعت یکبار (در پوشه ویندوز/سرور + ربات‌های بله و تلگرام)
  useEffect(() => {
    const intervalHours = Math.max(1, botConfig.autoBackupIntervalHours || 2);
    const backupIntervalMs = intervalHours * 60 * 60 * 1000;

    const intervalId = setInterval(async () => {
      const now = new Date();
      const timeStr = `1404/08/12 - ${now.toTimeString().slice(0, 8)}`;
      const savedPath = await performAutoBackup(`interval_${intervalHours}h`);
      const backupSummary = `پشتیبان خودکار ${intervalHours} ساعته با موفقیت در مسیر (${
        savedPath || 'C:\\TarazBan_Backups\\TarazBan_Latest_AutoBackup.json'
      }) ذخیره شد.`;

      if (botConfig.baleEnabled && botConfig.baleDefaultChatId) {
        const log = await dispatchToMessengerBot({
          platform: 'bale',
          botToken: botConfig.baleBotToken,
          chatId: botConfig.baleDefaultChatId,
          recipientName: `بکاپ خودکار بله (${intervalHours} ساعته)`,
          messageType: 'backup',
          text: `📦 *پشتیبان خودکار ${intervalHours} ساعته ترازبان*\n📅 زمان: ${timeStr}\n${backupSummary}`,
          summary: backupSummary,
        });
        setBotLogs((prev) => [log, ...prev]);
      }

      if (botConfig.telegramEnabled && botConfig.telegramDefaultChatId) {
        const log = await dispatchToMessengerBot({
          platform: 'telegram',
          botToken: botConfig.telegramBotToken,
          chatId: botConfig.telegramDefaultChatId,
          recipientName: `بکاپ خودکار تلگرام (${intervalHours} ساعته)`,
          messageType: 'backup',
          text: `📦 *پشتیبان خودکار ${intervalHours} ساعته ترازبان*\n📅 زمان: ${timeStr}\n${backupSummary}`,
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
  ]);

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

  const buildFXDealVoucherLines = (deal: FXDeal) => {
    const isBuy = deal.type === 'buy';
    const vaultBank =
      banks.find((b) => b.id === deal.targetForeignBankId) ||
      banks.find((b) => b.currency === deal.currency);
    const vaultAcc = getAccountForBank(vaultBank);

    const personAccCode = isBuy ? '2101' : '1104';
    const personAccName = isBuy
      ? 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)'
      : 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)';

    const isDeferred = (deal.deliveredForeignAmount ?? deal.foreignAmount) === 0;
    const deliveryNote = isDeferred
      ? ` [تحویل ارز در مراحل بعد — ثبت در مانده ارزی شخص]`
      : ` [تحویل همزمان ارز به صندوق]`;

    const userNotePart = deal.notes ? ` — توضیحات: ${deal.notes}` : '';
    const mainTracking = (deal.trackingNumber || '').trim() || deal.dealNumber;

    const lines: VoucherLine[] = [];
    const newBankStatements: BankStatementEntry[] = [];

    if (!isDeferred) {
      // تحویل همزمان ارز در لحظه فاکتور: ورود/خروج ارز در صندوق ارزی + ثبت معادل ریالی در حساب شخص (مانده ارزی شخص = 0)
      const vaultLineId = `ln-fx-vault-${Date.now()}-1`;
      lines.push({
        id: vaultLineId,
        accountCode: vaultAcc.code,
        accountName: vaultAcc.name,
        bankId: vaultBank?.id,
        bankName: vaultBank?.bankName,
        description: `${isBuy ? 'خرید ارز و ورود به' : 'فروش ارز و خروج از'} ${
          vaultBank?.bankName || 'خزانه ارزی'
        } (${deal.foreignAmount} ${deal.currency} به نرخ ${deal.exchangeRate}) [شماره فیش/رهگیری: ${mainTracking}]${deliveryNote}${userNotePart}`,
        currency: deal.currency,
        exchangeRate: deal.exchangeRate,
        debitForeign: isBuy ? deal.foreignAmount : 0,
        creditForeign: isBuy ? 0 : deal.foreignAmount,
        debitIRR: isBuy ? deal.totalIRR : 0,
        creditIRR: isBuy ? 0 : deal.totalIRR,
        trackingNumber: mainTracking,
        reconciled: true,
      });

      lines.push({
        id: `ln-fx-person-${Date.now()}-2`,
        accountCode: personAccCode,
        accountName: personAccName,
        contactId: deal.contactId,
        contactName: deal.contactName,
        description: `فاکتور ${isBuy ? 'خرید' : 'فروش'} ${deal.foreignAmount} ${
          deal.currency
        } به نرخ ${deal.exchangeRate} ریال (${deal.dealNumber}) [شماره فیش/رهگیری: ${mainTracking}]${deliveryNote}${userNotePart}`,
        currency: 'IRR',
        exchangeRate: 1,
        debitForeign: 0,
        creditForeign: 0,
        debitIRR: isBuy ? 0 : deal.totalIRR,
        creditIRR: isBuy ? deal.totalIRR : 0,
        trackingNumber: mainTracking,
      });

      if (vaultBank) {
        newBankStatements.push({
          id: `bs-fx-v-${Date.now()}`,
          bankId: vaultBank.id,
          date: deal.date,
          trackingNumber: mainTracking,
          description: `${isBuy ? 'ورود ارز خریداری‌شده' : 'خروج ارز فروخته‌شده'} (${
            deal.contactName
          }) [فیش: ${mainTracking}]`,
          currency: deal.currency,
          depositForeign: isBuy ? deal.foreignAmount : 0,
          withdrawalForeign: isBuy ? 0 : deal.foreignAmount,
          depositIRR: isBuy ? deal.totalIRR : 0,
          withdrawalIRR: isBuy ? 0 : deal.totalIRR,
          matchedVoucherLineId: vaultLineId,
        });
      }
    } else {
      // ارز در حساب ارزی شخص می‌ماند تا بعداً در بخش «تحویل ارز / دریافت و پرداخت» دریافت یا پرداخت شود:
      // در خرید ارز: شخص بابت ریال بستانکار می‌شود (creditIRR) و بابت خودِ ارز بدهکار ارزی می‌شود (debitForeign) تا بعداً تحویل دهد.
      // در فروش ارز: شخص بابت ریال بدهکار می‌شود (debitIRR) و بابت خودِ ارز بستانکار ارزی می‌شود (creditForeign) تا بعداً به او تحویل دهیم.
      lines.push({
        id: `ln-fx-unsettled-v-${Date.now()}-1`,
        accountCode: '1103',
        accountName: 'موجودی بانک‌ها و خزانه‌های ارزی',
        description: `تعهد ${isBuy ? 'خرید' : 'فروش'} ارز (${deal.foreignAmount} ${deal.currency}) در انتظار تحویل — ${deal.dealNumber}`,
        currency: deal.currency,
        exchangeRate: deal.exchangeRate,
        debitForeign: 0,
        creditForeign: 0,
        debitIRR: isBuy ? deal.totalIRR : 0,
        creditIRR: isBuy ? 0 : deal.totalIRR,
        trackingNumber: mainTracking,
      });

      lines.push({
        id: `ln-fx-person-${Date.now()}-2`,
        accountCode: personAccCode,
        accountName: personAccName,
        contactId: deal.contactId,
        contactName: deal.contactName,
        description: `فاکتور ${isBuy ? 'خرید' : 'فروش'} ${deal.foreignAmount} ${
          deal.currency
        } به نرخ ${deal.exchangeRate} ریال (${deal.dealNumber}) [فیش/رهگیری: ${mainTracking}]${deliveryNote}${userNotePart}`,
        currency: deal.currency,
        exchangeRate: deal.exchangeRate,
        debitForeign: isBuy ? deal.foreignAmount : 0,
        creditForeign: isBuy ? 0 : deal.foreignAmount,
        debitIRR: isBuy ? 0 : deal.totalIRR,
        creditIRR: isBuy ? deal.totalIRR : 0,
        trackingNumber: mainTracking,
      });
    }

    if (deal.payments && deal.payments.length > 0) {
      deal.payments.forEach((sp, idx) => {
        if (!sp.bankId || sp.amountIRR <= 0) return;
        const payBank = banks.find((b) => b.id === sp.bankId);
        const payBankAcc = getAccountForBank(payBank);
        const isReceipt = !isBuy;

        const trk = (sp.trackingNumber || '').trim() || `${mainTracking}-${idx + 1}`;
        const splitExtraDesc = [
          sp.description ? `توضیحات فیش: ${sp.description}` : '',
          deal.notes ? `توضیحات معامله: ${deal.notes}` : '',
        ]
          .filter(Boolean)
          .join(' — ');
        const splitDesc = `${
          isReceipt ? 'واریز به' : 'برداشت از'
        } ${payBank?.bankName || 'بانک/صندوق'} بابت تسویه ${deal.dealNumber} (${
          deal.contactName
        }) [شماره فیش/رهگیری: ${trk}]${splitExtraDesc ? ` — ${splitExtraDesc}` : ''}`;
        const payBankLineId = `ln-fx-pay-b-${Date.now()}-${idx}`;

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

        lines.push({
          id: `ln-fx-pay-p-${Date.now()}-${idx}`,
          accountCode: personAccCode,
          accountName: personAccName,
          contactId: deal.contactId,
          contactName: deal.contactName,
          description: `${
            isReceipt ? 'دریافت از شخص و واریز به' : 'پرداخت به شخص از'
          } ${payBank?.bankName || 'بانک/صندوق'} بابت ${deal.dealNumber} [شماره فیش/رهگیری: ${trk}]${
            splitExtraDesc ? ` — ${splitExtraDesc}` : ''
          }`,
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

    return { lines, newBankStatements, mainTracking, userNotePart };
  };

  const handleExecuteFXDeal = (deal: FXDeal) => {
    setFxDeals([deal, ...fxDeals]);

    const isBuy = deal.type === 'buy';
    const vchId = deal.linkedVoucherId || `vch-fx-${Date.now()}`;
    const { lines, newBankStatements, mainTracking, userNotePart } = buildFXDealVoucherLines(deal);

    const nextVoucherNumber =
      Math.max(1003, ...vouchers.map((v) => v.voucherNumber || 0)) + 1;

    const autoVoucher: JournalVoucher = {
      id: vchId,
      voucherNumber: nextVoucherNumber,
      date: deal.date,
      description: `سند اتوماتیک ${isBuy ? 'خرید' : 'فروش'} ارز ${deal.dealNumber} (${
        deal.contactName
      }) [فیش/رهگیری: ${mainTracking}]${userNotePart}`,
      referenceNumber: mainTracking,
      autoType: 'fx_deal',
      status: 'permanent',
      createdAt: deal.date,
      lines,
    };

    setVouchers([autoVoucher, ...vouchers]);
    if (newBankStatements.length > 0) {
      setBankStatements([...newBankStatements, ...bankStatements]);
    }
    if (botConfig.autoBackupOnVoucherSave) {
      setTimeout(() => performAutoBackup('fx_deal_save'), 300);
    }
  };

  // ثبت مرحله جدید تحویل ارز برای معامله خرید یا فروش ارز
  const handleRecordFXDealDelivery = (dealId: string, split: FXDeliverySplit) => {
    const targetDeal = fxDeals.find((d) => d.id === dealId);
    if (!targetDeal) return;

    const prevDelivered =
      targetDeal.deliveredForeignAmount !== undefined
        ? targetDeal.deliveredForeignAmount
        : targetDeal.foreignAmount;
    const newDelivered = Math.min(targetDeal.foreignAmount, prevDelivered + split.amountForeign);
    const newRemaining = Math.max(0, targetDeal.foreignAmount - newDelivered);
    const newStatus: 'pending' | 'partial' | 'delivered' =
      newRemaining <= 0.001 ? 'delivered' : newDelivered > 0 ? 'partial' : 'pending';
    const updatedSplits = [...(targetDeal.deliverySplits || []), split];

    const updatedDeal: FXDeal = {
      ...targetDeal,
      deliveredForeignAmount: newDelivered,
      remainingForeignDelivery: newRemaining,
      deliveryStatus: newStatus,
      deliverySplits: updatedSplits,
    };

    setFxDeals((prev) => prev.map((d) => (d.id === dealId ? updatedDeal : d)));

    // بروزرسانی شرح سند مرتبط با معامله جهت نمایش دقیق مراحل تحویل در صورتحساب شخص
    if (targetDeal.linkedVoucherId) {
      const stagesText = updatedSplits
        .map(
          (s, idx) =>
            `مرحله ${idx + 1}: ${s.amountForeign} ${targetDeal.currency} در ${s.date}${
              s.trackingNumber ? ` (پیگیری: ${s.trackingNumber})` : ''
            }${s.notes ? ` - ${s.notes}` : ''}`
        )
        .join(' | ');

      const deliverySummaryText = ` [وضعیت تحویل ارز: تحویل‌شده ${newDelivered} از ${targetDeal.foreignAmount} ${targetDeal.currency} | مانده تحویل‌نشده: ${newRemaining} ${targetDeal.currency} | مراحل: ${stagesText}]`;
      const userNotePart = targetDeal.notes ? ` — توضیحات: ${targetDeal.notes}` : '';

      setVouchers((prev) =>
        prev.map((v) => {
          if (v.id !== targetDeal.linkedVoucherId) return v;
          return {
            ...v,
            lines: v.lines.map((ln) => {
              const isMainDealLine =
                ln.contactId === targetDeal.contactId &&
                !ln.description.includes('واریز به') &&
                !ln.description.includes('پرداخت به شخص از') &&
                !ln.description.includes('دریافت از شخص و واریز به') &&
                (ln.trackingNumber === targetDeal.dealNumber ||
                  ln.trackingNumber === targetDeal.trackingNumber ||
                  ln.description.includes(targetDeal.dealNumber));
              if (isMainDealLine) {
                return {
                  ...ln,
                  description: `${targetDeal.type === 'buy' ? 'خرید' : 'فروش'} ${
                    targetDeal.foreignAmount
                  } ${targetDeal.currency} به نرخ ${targetDeal.exchangeRate} ریال (${
                    targetDeal.dealNumber
                  }) [شماره فیش/رهگیری: ${
                    targetDeal.trackingNumber || targetDeal.dealNumber
                  }]${deliverySummaryText}${userNotePart}`,
                };
              }
              return ln;
            }),
          };
        })
      );
    }

    if (botConfig.autoBackupOnVoucherSave) {
      setTimeout(() => performAutoBackup('fx_delivery_stage_save'), 300);
    }
  };

  const handleIssueInvoice = (invoice: SalesInvoice) => {
    setInvoices([invoice, ...invoices]);

    const isSales = invoice.type !== 'purchase';

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

    const personAccCode = isSales ? '1104' : '2101';
    const personAccName = isSales
      ? 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)'
      : 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)';

    const lines: VoucherLine[] = [];

    const invCurr = invoice.currency || 'IRR';
    const invRate = invCurr === 'IRR' ? 1 : invoice.exchangeRate || 1;
    const invNotePart = invoice.notes ? ` — توضیحات: ${invoice.notes}` : '';

    if (isSales) {
      lines.push({
        id: `ln-inv-cust-${Date.now()}-1`,
        accountCode: '1104',
        accountName: 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)',
        contactId: invoice.contactId,
        contactName: invoice.contactName,
        description: `فاکتور فروش شماره ${invoice.invoiceNumber} - ${invoice.contactName}${invNotePart}`,
        currency: invCurr,
        exchangeRate: invRate,
        debitForeign: invCurr === 'IRR' ? invoice.grandTotalIRR : invoice.grandTotalForeign,
        creditForeign: 0,
        debitIRR: invoice.grandTotalIRR,
        creditIRR: 0,
        trackingNumber: invoice.invoiceNumber,
      });

      const netSalesIRR = invoice.subtotalIRR - invoice.totalDiscountIRR;
      const netSalesForeign = invoice.subtotalForeign - invoice.totalDiscountForeign;
      lines.push({
        id: `ln-inv-rev-${Date.now()}-2`,
        accountCode: '4101',
        accountName: 'درآمد فروش ریالی',
        description: `فروش طبق فاکتور ${invoice.invoiceNumber}${invNotePart}`,
        currency: invCurr,
        exchangeRate: invRate,
        debitForeign: 0,
        creditForeign: invCurr === 'IRR' ? netSalesIRR : netSalesForeign,
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
          currency: invCurr,
          exchangeRate: invRate,
          debitForeign: 0,
          creditForeign: invCurr === 'IRR' ? invoice.totalTaxIRR : invoice.totalTaxForeign,
          debitIRR: 0,
          creditIRR: invoice.totalTaxIRR,
        });
      }
    } else {
      lines.push({
        id: `ln-inv-pur-${Date.now()}-1`,
        accountCode: '1106',
        accountName: 'موجودی کالا و خرید انبار',
        description: `خرید کالا/خدمات طبق فاکتور ${invoice.invoiceNumber} از ${invoice.contactName}${invNotePart}`,
        currency: invCurr,
        exchangeRate: invRate,
        debitForeign: invCurr === 'IRR' ? invoice.grandTotalIRR : invoice.grandTotalForeign,
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
        description: `فاکتور خرید شماره ${invoice.invoiceNumber} - ${invoice.contactName}${invNotePart}`,
        currency: invCurr,
        exchangeRate: invRate,
        debitForeign: 0,
        creditForeign: invCurr === 'IRR' ? invoice.grandTotalIRR : invoice.grandTotalForeign,
        debitIRR: 0,
        creditIRR: invoice.grandTotalIRR,
        trackingNumber: invoice.invoiceNumber,
      });
    }

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
    const nextInvVoucherNumber =
      Math.max(1003, ...vouchers.map((v) => v.voucherNumber || 0)) + 1;
    const autoVoucher: JournalVoucher = {
      id: vchId,
      voucherNumber: nextInvVoucherNumber,
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

  const handleAddVoucher = (v: JournalVoucher) => {
    setVouchers([v, ...vouchers]);

    const newStatements: BankStatementEntry[] = [];
    v.lines.forEach((ln, idx) => {
      if (ln.bankId && (ln.debitIRR > 0 || ln.creditIRR > 0 || ln.debitForeign > 0 || ln.creditForeign > 0)) {
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

            const invCurr = updated.currency || 'IRR';
            const invRate = invCurr === 'IRR' ? 1 : updated.exchangeRate || 1;
            const invNotePart = updated.notes ? ` — توضیحات: ${updated.notes}` : '';

            const lines: VoucherLine[] = [];
            if (isSales) {
              lines.push({
                id: `ln-inv-cust-${Date.now()}-1`,
                accountCode: '1104',
                accountName: 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)',
                contactId: updated.contactId,
                contactName: updated.contactName,
                description: `فاکتور فروش شماره ${updated.invoiceNumber} - ${updated.contactName}${invNotePart}`,
                currency: invCurr,
                exchangeRate: invRate,
                debitForeign: invCurr === 'IRR' ? updated.grandTotalIRR : updated.grandTotalForeign,
                creditForeign: 0,
                debitIRR: updated.grandTotalIRR,
                creditIRR: 0,
                trackingNumber: updated.invoiceNumber,
              });
              const netSalesIRR = updated.subtotalIRR - updated.totalDiscountIRR;
              const netSalesForeign = updated.subtotalForeign - updated.totalDiscountForeign;
              lines.push({
                id: `ln-inv-rev-${Date.now()}-2`,
                accountCode: '4101',
                accountName: 'درآمد فروش ریالی',
                description: `فروش طبق فاکتور ${updated.invoiceNumber}${invNotePart}`,
                currency: invCurr,
                exchangeRate: invRate,
                debitForeign: 0,
                creditForeign: invCurr === 'IRR' ? netSalesIRR : netSalesForeign,
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
                  currency: invCurr,
                  exchangeRate: invRate,
                  debitForeign: 0,
                  creditForeign: invCurr === 'IRR' ? updated.totalTaxIRR : updated.totalTaxForeign,
                  debitIRR: 0,
                  creditIRR: updated.totalTaxIRR,
                });
              }
            } else {
              lines.push({
                id: `ln-inv-pur-${Date.now()}-1`,
                accountCode: '1106',
                accountName: 'موجودی کالا و خرید انبار',
                description: `خرید طبق فاکتور ${updated.invoiceNumber} از ${updated.contactName}${invNotePart}`,
                currency: invCurr,
                exchangeRate: invRate,
                debitForeign: invCurr === 'IRR' ? updated.grandTotalIRR : updated.grandTotalForeign,
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
                description: `فاکتور خرید شماره ${updated.invoiceNumber} - ${updated.contactName}${invNotePart}`,
                currency: invCurr,
                exchangeRate: invRate,
                debitForeign: 0,
                creditForeign: invCurr === 'IRR' ? updated.grandTotalIRR : updated.grandTotalForeign,
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

  const handleUpdateVoucher = (updated: JournalVoucher) => {
    setVouchers((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

    setBankStatements((prev) => {
      const lineIds = new Set(updated.lines.map((l) => l.id));
      const filtered = prev.filter((bs) => !bs.matchedVoucherLineId || !lineIds.has(bs.matchedVoucherLineId));
      const newEntries: BankStatementEntry[] = [];
      updated.lines.forEach((ln, idx) => {
        if (ln.bankId && (ln.debitIRR > 0 || ln.creditIRR > 0 || ln.debitForeign > 0 || ln.creditForeign > 0)) {
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

  const handleDeleteVoucher = (id: string) => {
    const targetVch = vouchers.find((v) => v.id === id);
    setVouchers((prev) => prev.filter((v) => v.id !== id));
    setFxDeals((prev) => prev.filter((d) => d.linkedVoucherId !== id));
    setInvoices((prev) => prev.filter((i) => i.linkedVoucherId !== id));
    if (targetVch) {
      const lineIds = new Set(targetVch.lines.map((l) => l.id));
      setBankStatements((prev) =>
        prev.filter((bs) => !bs.matchedVoucherLineId || !lineIds.has(bs.matchedVoucherLineId))
      );
    }
  };

  const handleAddBank = (newBank: BankAccount) => {
    const initForeign = newBank.initialBalanceForeign || 0;
    const initIRR = newBank.initialBalanceIRR || 0;

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

      const nextBankVoucherNumber =
        Math.max(1003, ...vouchers.map((v) => v.voucherNumber || 0)) + 1;
      const todayDate = getTodayJalaliDate();
      const initVoucher: JournalVoucher = {
        id: vchId,
        voucherNumber: nextBankVoucherNumber,
        date: todayDate,
        description: `سند موجودی اولیه ${cleanBank.bankName}`,
        status: 'permanent',
        createdAt: todayDate,
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
    if (restored.companyName) setCompanyName(restored.companyName);
    setCurrencies(restored.currencies || INITIAL_ACCOUNTING_STATE.currencies);
    setAccounts(restored.accounts || INITIAL_ACCOUNTING_STATE.accounts);
    setContacts(restored.contacts ?? []);
    setBanks(restored.banks ?? []);
    setProducts(restored.products ?? []);
    setVouchers(restored.vouchers ?? []);
    setFxDeals(restored.fxDeals ?? []);
    setInvoices(restored.invoices ?? []);
    setMovements(restored.inventoryMovements ?? []);
    setBankStatements(restored.bankStatementEntries ?? []);
    if (restored.botConfig) setBotConfig(restored.botConfig);
    if (restored.botLogs) setBotLogs(restored.botLogs ?? []);
    if (restored.users) setUsers(restored.users);
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    handleRestoreFullBackup(INITIAL_ACCOUNTING_STATE);
  };

  // صفر کردن و خام کردن دیتابیس (باز کردن ویزارد انتخاب نام صرافی و ادمین جدید)
  const handleOpenBlankSetupWizard = () => {
    setShowSettingsModal(false);
    setShowBlankSetupWizard(true);
  };

  const handleCompleteSetupWizard = async (
    newState: AccountingState,
    adminUser: UserAccount
  ) => {
    try {
      await fetch('/api/reset-blank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blankState: newState }),
      });
    } catch (e) {
      console.warn('Network server reset notice:', e);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setCompanyName(newState.companyName);
    setCurrencies(newState.currencies);
    setAccounts(newState.accounts);
    setContacts([]);
    setBanks([]); // 100% EMPTY - No pre-defined banks!
    setProducts([]);
    setVouchers([]);
    setFxDeals([]);
    setInvoices([]);
    setMovements([]);
    setBankStatements([]);
    setUsers(newState.users || [adminUser]);

    setCurrentUser(adminUser);
    sessionStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(adminUser));
    setShowBlankSetupWizard(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(CURRENT_USER_SESSION_KEY);
  };

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    sessionStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(user));
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'میز کار و خلاصه وضعیت',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'fx_desk',
      label: 'ثبت خرید و فروش ارز',
      icon: <Coins className="w-4 h-4 text-amber-500" />,
      badge: 'اصلی',
    },
    {
      id: 'persons',
      label: 'بدهکاران و صورتحساب اشخاص',
      icon: <Users className="w-4 h-4 text-cyan-600" />,
    },
    {
      id: 'vouchers',
      label: 'ثبت دریافت و پرداخت به اشخاص',
      icon: <Sparkles className="w-4 h-4 text-emerald-600" />,
    },
    {
      id: 'reports',
      label: 'سود ماهانه و گزارشات',
      icon: <FileSpreadsheet className="w-4 h-4 text-rose-600" />,
    },
    {
      id: 'banks',
      label: 'بانک‌ها و صندوق‌های ارزی',
      icon: <Landmark className="w-4 h-4 text-indigo-600" />,
    },
    {
      id: 'invoices',
      label: 'فاکتور رسمی چندارزی',
      icon: <ShoppingBag className="w-4 h-4 text-teal-600" />,
    },
    {
      id: 'inventory',
      label: 'پشتیبان‌گیری و ربات بله/تلگرام',
      icon: <Package className="w-4 h-4 text-purple-600" />,
    },
  ];

  if (!licenseStatus.isActivated) {
    return (
      <OfflineActivationModal
        license={licenseStatus}
        onActivated={(newStatus) => {
          setLicenseStatus(newStatus);
          fetch('/api/license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license: newStatus }),
          }).catch(() => {});
        }}
      />
    );
  }

  // If user is not logged in, show Login Screen
  if (!currentUser) {
    return <LoginModal users={users} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* PWA Install Banner */}
      <PWAInstallPrompt />

      {/* Setup Wizard Modal for 100% Blank Reset */}
      <InitialSetupWizardModal
        isOpen={showBlankSetupWizard}
        onClose={() => setShowBlankSetupWizard(false)}
        onCompleteSetup={handleCompleteSetupWizard}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-3 sm:px-6 py-2.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={arkaLogo}
              alt="لوگو آرکا (ARKA)"
              referrerPolicy="no-referrer"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border-2 border-teal-500 shadow-md shadow-teal-500/20 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-extrabold bg-gradient-to-l from-teal-700 to-emerald-600 text-white rounded-lg shadow-xs shrink-0">
                  آرکا (ARKA)
                </span>
                <h1 className="text-xs sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                  {companyName || 'آرکا (ARKA) — سیستم حسابداری و صرافی دوارزی'}
                </h1>
                <span className="hidden md:inline-block px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-md shrink-0">
                  تسویه چندارزی
                </span>
              </div>
              <p className="hidden sm:block text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                نرم‌افزار تخصصی آرکا (ARKA) — مدیریت صرافی، معاملات ارزی، دریافت و پرداخت و صورتحساب دوارزی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Global System-Wide Receipt & Tracking Code Search Button */}
            <button
              type="button"
              onClick={() => setShowGlobalSearchModal(true)}
              className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[10px] sm:text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-sm shadow-teal-600/20"
              title="جستجوی سراسری شماره فیش، کد رهگیری و رسید در کل سیستم"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">سرچ کل سیستم (فیش / کد رهگیری)</span>
              <span className="sm:hidden">سرچ فیش</span>
            </button>

            {/* User Profile Badge & Logout */}
            <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold transition">
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-slate-800 text-[11px] sm:text-xs max-w-[100px] truncate">{currentUser.fullName}</span>
              <button
                onClick={handleLogout}
                title="خروج از حساب کاربری"
                className="text-slate-400 hover:text-rose-600 mr-1 p-0.5 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

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

            {/* Manage Banks & Cashboxes Button */}
            <button
              onClick={() => setActiveTab('banks')}
              className={`px-2 sm:px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold border transition cursor-pointer shrink-0 flex items-center gap-1 ${
                activeTab === 'banks'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="تعریف و مدیریت بانک‌ها و صندوق‌های ارزی"
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>بانک‌ها و صندوق‌ها ({banks.length})</span>
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition cursor-pointer shrink-0 shadow-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>تنظیمات</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global System-Wide Receipt & Tracking Search Modal */}
      <GlobalReceiptSearchModal
        isOpen={showGlobalSearchModal}
        onClose={() => setShowGlobalSearchModal(false)}
        state={fullAccountingState}
        onOpenPersonStatement={(cId) => {
          setStatementInitialContactId(cId);
          setActiveTab('persons');
        }}
        onNavigateToVouchers={() => setActiveTab('vouchers')}
      />

      {/* Currency Manager Modal */}
      <CurrencyManagerModal
        currencies={currencies}
        isOpen={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        onUpdateCurrencies={setCurrencies}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        state={fullAccountingState}
        currentUser={currentUser}
        onResetToBlankDatabase={handleOpenBlankSetupWizard}
        onUpdateBotConfig={(patch) => setBotConfig({ ...botConfig, ...patch })}
        onUpdateUsers={setUsers}
        networkSyncStatus={networkSyncStatus}
        lastSyncTime={lastSyncTime}
        licenseStatus={licenseStatus}
        onLockLicense={() => {
          setLicenseStatus(lockApplicationLicense());
          fetch('/api/license', { method: 'DELETE' }).catch(() => {});
        }}
        onRestoreFullBackup={handleRestoreFullBackup}
      />

      {/* Main Layout */}
      <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col lg:flex-row gap-5 p-2.5 sm:p-6 pb-20 lg:pb-6 overflow-x-hidden">
        {/* Navigation Bar (Desktop Vertical Sidebar Only) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col gap-1.5 sticky top-20 z-20 shadow-xs">
            {/* Desktop Brand Header Card */}
            <div className="p-2.5 mb-1 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 rounded-lg text-white border border-teal-500/30 flex items-center gap-2.5 shadow-sm">
              <img
                src={arkaLogo}
                alt="ARKA Logo"
                className="w-10 h-10 rounded-lg object-cover border border-teal-400 shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-amber-400 tracking-wide">آرکا (ARKA)</span>
                  <span className="text-[9px] px-1 py-0.2 bg-teal-500/20 text-teal-300 rounded font-mono">v6.0</span>
                </div>
                <p className="text-[10px] text-slate-300 truncate">حسابداری و صرافی دوارزی</p>
              </div>
            </div>

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

            <div className="pt-2 border-t border-slate-200 mt-1">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>تنظیمات و کاربران</span>
                </div>
              </button>
            </div>
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
              onDeleteVoucher={handleDeleteVoucher}
            />
          )}

          {activeTab === 'fx_desk' && (
            <FXTradingDeskView
              fxDeals={fxDeals}
              currencies={currencies}
              contacts={contacts}
              banks={banks}
              vouchers={vouchers}
              companyName={companyName}
              onExecuteDeal={handleExecuteFXDeal}
              onUpdateDeal={(updatedDeal) => {
                setFxDeals(fxDeals.map((d) => (d.id === updatedDeal.id ? updatedDeal : d)));
                if (updatedDeal.linkedVoucherId) {
                  const { lines, mainTracking, userNotePart } = buildFXDealVoucherLines(updatedDeal);
                  const isBuy = updatedDeal.type === 'buy';
                  setVouchers(
                    vouchers.map((v) => {
                      if (v.id !== updatedDeal.linkedVoucherId) return v;
                      return {
                        ...v,
                        date: updatedDeal.date,
                        referenceNumber: mainTracking,
                        description: `سند اتوماتیک ${isBuy ? 'خرید' : 'فروش'} ارز ${updatedDeal.dealNumber} (${updatedDeal.contactName}) [فیش/رهگیری: ${mainTracking}]${userNotePart}`,
                        lines,
                      };
                    })
                  );
                }
              }}
              onRecordDealDelivery={handleRecordFXDealDelivery}
              onAddContact={(newContact) => setContacts([...contacts, newContact])}
              onDeleteDeal={(dealId) => {
                const target = fxDeals.find((d) => d.id === dealId);
                setFxDeals(fxDeals.filter((d) => d.id !== dealId));
                if (target?.linkedVoucherId) {
                  handleDeleteVoucher(target.linkedVoucherId);
                }
              }}
              onAddVoucher={handleAddVoucher}
              onUpdateVoucher={handleUpdateVoucher}
              onDeleteVoucher={handleDeleteVoucher}
            />
          )}

          {activeTab === 'persons' && (
            <PersonStatementsView
              state={fullAccountingState}
              onAddContact={(newContact) => setContacts([...contacts, newContact])}
              onRecordBotLog={(log) => setBotLogs([log, ...botLogs])}
              initialContactId={statementInitialContactId}
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
              onResetToBlankDatabase={handleOpenBlankSetupWizard}
              onTriggerImmediateAutoBackup={performAutoBackup}
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

      {/* Sticky Bottom Mobile Navigation Bar for Phone Screens (5 Core Goals) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 backdrop-blur-xl px-1 py-1.5 flex items-center justify-around shadow-xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'dashboard' ? 'text-teal-700 font-extrabold bg-teal-50' : 'text-slate-600'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 text-teal-600" />
          <span className="text-[10px]">میز کار</span>
        </button>

        <button
          onClick={() => setActiveTab('fx_desk')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'fx_desk' ? 'text-amber-800 font-extrabold bg-amber-50' : 'text-slate-600'
          }`}
        >
          <Coins className="w-5 h-5 text-amber-600" />
          <span className="text-[10px]">خرید/فروش ارز</span>
        </button>

        <button
          onClick={() => setActiveTab('persons')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'persons' ? 'text-cyan-800 font-extrabold bg-cyan-50' : 'text-slate-600'
          }`}
        >
          <Users className="w-5 h-5 text-cyan-600" />
          <span className="text-[10px]">بدهکار/بستانکار</span>
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'vouchers' ? 'text-emerald-800 font-extrabold bg-emerald-50' : 'text-slate-600'
          }`}
        >
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px]">دریافت/پرداخت</span>
        </button>

        <button
          onClick={() => setActiveTab('banks')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'banks' ? 'text-indigo-800 font-extrabold bg-indigo-50' : 'text-slate-600'
          }`}
        >
          <Landmark className="w-5 h-5 text-indigo-600" />
          <span className="text-[10px]">بانک و صندوق</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'reports' ? 'text-rose-800 font-extrabold bg-rose-50' : 'text-slate-600'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5 text-rose-600" />
          <span className="text-[10px]">سود ماهانه</span>
        </button>
      </div>
    </div>
  );
}

export default App;
