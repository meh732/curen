import React, { useState, useMemo, useEffect } from 'react';
import {
  Account,
  Contact,
  BankAccount,
  Currency,
  JournalVoucher,
  VoucherLine,
  CurrencyCode,
  PaymentSplitLine,
} from '../types/accounting';
import {
  buildPersonStatement,
  formatNumber,
  formatCurrencyAmount,
  parseFormattedNumber,
  getTodayJalaliDate,
} from '../utils/accountingEngine';
import { MultiPaymentSplitsEditor } from './MultiPaymentSplitsEditor';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Receipt,
  TrendingUp,
  CheckCircle2,
  Trash2,
  Landmark,
  User,
  Coins,
  Plus,
  BookOpen,
  Sparkles,
  UserPlus,
  X,
  Search,
  Hash,
  PackageCheck,
  Edit3,
} from 'lucide-react';

interface VoucherEntryViewProps {
  accounts: Account[];
  contacts: Contact[];
  banks: BankAccount[];
  currencies: Currency[];
  vouchers: JournalVoucher[];
  onAddVoucher: (voucher: JournalVoucher) => void;
  onUpdateVoucher?: (voucher: JournalVoucher) => void;
  onDeleteVoucher?: (id: string) => void;
  onAddContact?: (contact: Contact) => void;
}

type AutoFinanceType =
  | 'receive_from_person'
  | 'pay_to_person'
  | 'currency_receive_from_person'
  | 'currency_pay_to_person'
  | 'bank_transfer'
  | 'expense'
  | 'income';

export const VoucherEntryView: React.FC<VoucherEntryViewProps> = ({
  accounts,
  contacts,
  banks,
  currencies,
  vouchers,
  onAddVoucher,
  onUpdateVoucher,
  onDeleteVoucher,
  onAddContact,
}) => {
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [entryTab, setEntryTab] = useState<'auto' | 'manual'>('auto');
  const [autoType, setAutoType] = useState<AutoFinanceType>('receive_from_person');
  const [date, setDate] = useState(() => getTodayJalaliDate());
  const [description, setDescription] = useState('');
  const [mainTrackingNumber, setMainTrackingNumber] = useState('');
  const [voucherSearchQuery, setVoucherSearchQuery] = useState('');

  // فیلدهای مشترک حالت اتوماتیک
  const [selectedContactId, setSelectedContactId] = useState<string>(contacts[0]?.id || '');

  // برای دریافت از شخص / پرداخت به شخص (تک‌ردیفی سریع یا چند بانکی ترکیبی)
  const [splits, setSplits] = useState<PaymentSplitLine[]>(() => {
    const firstBank = banks[0];
    return firstBank
      ? [
          {
            id: 'spl-init-1',
            bankId: firstBank.id,
            bankName: firstBank.bankName,
            currency: firstBank.currency,
            amountForeign: 0,
            exchangeRate: 1,
            amountIRR: 0,
            trackingNumber: '',
          },
        ]
      : [];
  });

  // برای تحویل ارز (دریافت/پرداخت مستقیم ارزی با شخص) و انتقال بین بانک‌ها/هزینه/درآمد
  const foreignCurrencies = useMemo(
    () => currencies.filter((c) => c.code !== 'IRR'),
    [currencies]
  );
  const [fxDeliveryCurrency, setFxDeliveryCurrency] = useState<CurrencyCode>(
    foreignCurrencies[0]?.code || 'USD'
  );
  const [fxDeliveryAmount, setFxDeliveryAmount] = useState<number>(0);
  const [fxDeliveryBankId, setFxDeliveryBankId] = useState<string>(
    banks.find((b) => b.currency !== 'IRR')?.id || banks[0]?.id || ''
  );

  // برای انتقال بین دو بانک/صندوق، یا ثبت هزینه و درآمد
  const [sourceBankId, setSourceBankId] = useState<string>(banks[0]?.id || '');
  const [destBankId, setDestBankId] = useState<string>(banks[1]?.id || banks[0]?.id || '');
  const [txCurrency, setTxCurrency] = useState<CurrencyCode>('IRR');
  const [txAmountForeign, setTxAmountForeign] = useState<number>(0);
  const [txExchangeRate, setTxExchangeRate] = useState<number>(1);
  const [expenseAccountCode, setExpenseAccountCode] = useState<string>('5201');
  const [incomeAccountCode, setIncomeAccountCode] = useState<string>('4101');

  // همگام‌سازی خودکار در صورت تعریف اولین مشتری یا اولین بانک پس از خام‌سازی دیتابیس
  useEffect(() => {
    if (contacts.length > 0 && (!selectedContactId || !contacts.some((c) => c.id === selectedContactId))) {
      setSelectedContactId(contacts[0].id);
    }
  }, [contacts, selectedContactId]);

  useEffect(() => {
    if (banks.length > 0) {
      if (!sourceBankId || !banks.some((b) => b.id === sourceBankId)) {
        setSourceBankId(banks[0].id);
      }
      if (!destBankId || !banks.some((b) => b.id === destBankId)) {
        setDestBankId((banks[1] || banks[0]).id);
      }
      if (!fxDeliveryBankId || !banks.some((b) => b.id === fxDeliveryBankId)) {
        const match =
          banks.find((b) => b.currency === fxDeliveryCurrency) ||
          banks.find((b) => b.currency !== 'IRR') ||
          banks[0];
        if (match) setFxDeliveryBankId(match.id);
      }
      if (splits.length === 0) {
        const firstBank = banks[0];
        const defaultRate =
          firstBank.currency === 'IRR'
            ? 1
            : currencies.find((c) => c.code === firstBank.currency)?.defaultRateToIRR || 1;
        setSplits([
          {
            id: `spl-init-${Date.now()}`,
            bankId: firstBank.id,
            bankName: firstBank.bankName,
            currency: firstBank.currency,
            amountForeign: 0,
            exchangeRate: defaultRate,
            amountIRR: 0,
            trackingNumber: '',
          },
        ]);
      }
    }
  }, [banks, sourceBankId, destBankId, fxDeliveryBankId, fxDeliveryCurrency, splits.length, currencies]);

  // تعریف سریع شخص
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // پیام موفقیت و کارت تایید سند
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submittedVoucherSuccess, setSubmittedVoucherSuccess] = useState<JournalVoucher | null>(null);

  // تب سند دستی (پیشرفته)
  const [manualLines, setManualLines] = useState<Partial<VoucherLine>[]>([
    { id: 'ml-1', accountCode: '1102', currency: 'IRR', exchangeRate: 1, debitIRR: 0, creditIRR: 0, debitForeign: 0, creditForeign: 0 },
    { id: 'ml-2', accountCode: '1104', currency: 'IRR', exchangeRate: 1, debitIRR: 0, creditIRR: 0, debitForeign: 0, creditForeign: 0 },
  ]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // محاسبه مانده لحظه‌ای شخص انتخاب‌شده
  const selectedContactStatement = useMemo(() => {
    if (!selectedContactId) return null;
    return buildPersonStatement(vouchers, selectedContactId);
  }, [selectedContactId, vouchers]);

  const getRateForCurrency = (code: CurrencyCode): number => {
    if (code === 'IRR') return 1;
    return currencies.find((c) => c.code === code)?.defaultRateToIRR || 1;
  };

  const getAccountHelperForBank = (bank?: BankAccount, fallbackCurrency?: CurrencyCode) => {
    if (!bank) {
      if (fallbackCurrency && fallbackCurrency !== 'IRR') {
        return { code: '1103', name: 'موجودی بانک‌ها و خزانه‌های ارزی' };
      }
      return { code: '1102', name: 'موجودی بانک‌های ریالی' };
    }
    if (bank.currency !== 'IRR' || (fallbackCurrency && fallbackCurrency !== 'IRR')) {
      return { code: '1103', name: 'موجودی بانک‌ها و خزانه‌های ارزی' };
    }
    if (bank.kind === 'cash_box') {
      return { code: '1101', name: 'موجودی نقد و صندوق‌ها (ریالی و ارزی)' };
    }
    return { code: '1102', name: 'موجودی بانک‌های ریالی' };
  };

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
      defaultCurrency: 'IRR',
      creditLimitIRR: 0,
    };
    onAddContact(newC);
    setSelectedContactId(newC.id);
    setNewContactName('');
    setNewContactPhone('');
    setShowQuickContact(false);
  };

  const handleSourceBankChange = (bId: string) => {
    setSourceBankId(bId);
    const b = banks.find((x) => x.id === bId);
    if (b) {
      setTxCurrency(b.currency);
      setTxExchangeRate(getRateForCurrency(b.currency));
    }
  };

  const txComputedIRR =
    txCurrency === 'IRR'
      ? Math.round(txAmountForeign)
      : Math.round(txAmountForeign * txExchangeRate);

  // تحویل یا دریافت مستقیم مانده ارزی شخص با یک کلیک
  const handleSettleCurrencyBalance = (
    curr: string,
    balanceForeign: number,
    status: 'بدهکار' | 'بستانکار' | 'تسویه'
  ) => {
    if (balanceForeign <= 0 || status === 'تسویه') return;

    // اگر شخص بستانکار ارزی است، یعنی ما باید به او ارز تحویل دهیم (پرداخت/تحویل ارز به شخص)
    // اگر شخص بدهکار ارزی است، یعنی او باید به ما ارز تحویل دهد (دریافت ارز از شخص)
    const newAutoType: AutoFinanceType =
      status === 'بستانکار' ? 'currency_pay_to_person' : 'currency_receive_from_person';
    setAutoType(newAutoType);
    setFxDeliveryCurrency(curr as CurrencyCode);
    setFxDeliveryAmount(balanceForeign);

    const matchingBank =
      banks.find((b) => b.currency === curr) ||
      banks.find((b) => b.currency !== 'IRR') ||
      banks[0];
    if (matchingBank) {
      setFxDeliveryBankId(matchingBank.id);
    }

    setMainTrackingNumber(`DLV-${Date.now().toString().slice(-4)}`);
    setDescription(
      `${status === 'بستانکار' ? 'تحویل و پرداخت' : 'دریافت و تحویل گرفتن'} ${formatNumber(
        balanceForeign
      )} ${curr} ${status === 'بستانکار' ? 'به' : 'از'} ${selectedContact?.name || ''}`
    );
  };

  const handleAutoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const existingVoucher = editingVoucherId
      ? vouchers.find((v) => v.id === editingVoucherId)
      : undefined;
    const voucherNumber =
      existingVoucher?.voucherNumber ||
      Math.max(1003, ...vouchers.map((v) => v.voucherNumber || 0)) + 1;
    const lines: VoucherLine[] = [];
    let autoTitle = '';

    if (autoType === 'receive_from_person' || autoType === 'pay_to_person') {
      const validSplits = splits.filter((s) => s.bankId && s.amountIRR > 0);
      if (!selectedContact || validSplits.length === 0) return;

      const isReceipt = autoType === 'receive_from_person';
      const totalIRR = validSplits.reduce((s, x) => s + x.amountIRR, 0);

      const personAccCode = selectedContact.type === 'supplier' ? '2101' : '1104';
      const personAccName =
        personAccCode === '2101'
          ? 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)'
          : 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)';

      validSplits.forEach((sp, idx) => {
        const bank = banks.find((b) => b.id === sp.bankId);
        const bankAcc = getAccountHelperForBank(bank, sp.currency);
        const baseActionDesc = isReceipt
          ? `دریافت از ${selectedContact.name} و واریز به ${bank?.bankName || 'بانک/صندوق'}`
          : `پرداخت به ${selectedContact.name} از ${bank?.bankName || 'بانک/صندوق'}`;

        const extraNotes = [description.trim(), (sp.description || '').trim()]
          .filter(Boolean)
          .join(' — ');
        const trk =
          (sp.trackingNumber || '').trim() ||
          mainTrackingNumber.trim() ||
          `AUTO-${voucherNumber}-${idx + 1}`;
        const lineDesc = extraNotes
          ? `${baseActionDesc} | توضیحات: ${extraNotes}`
          : baseActionDesc;

        // ردیف بانک / صندوق
        lines.push({
          id: `ln-auto-b-${Date.now()}-${idx}`,
          accountCode: bankAcc.code,
          accountName: bankAcc.name,
          bankId: sp.bankId,
          bankName: bank?.bankName,
          description: `${lineDesc} (شماره فیش/رهگیری: ${trk})`,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isReceipt ? sp.amountForeign : 0,
          creditForeign: isReceipt ? 0 : sp.amountForeign,
          debitIRR: isReceipt ? sp.amountIRR : 0,
          creditIRR: isReceipt ? 0 : sp.amountIRR,
          trackingNumber: trk,
          reconciled: true,
        });

        // ردیف طرف حساب (شخص)
        lines.push({
          id: `ln-auto-p-${Date.now()}-${idx}`,
          accountCode: personAccCode,
          accountName: personAccName,
          contactId: selectedContact.id,
          contactName: selectedContact.name,
          description: `${lineDesc} (${
            sp.currency !== 'IRR'
              ? `${formatNumber(sp.amountForeign)} ${sp.currency} به ارزش هر واحد ${formatNumber(
                  sp.exchangeRate
                )} ریال`
              : `${formatNumber(sp.amountIRR)} ریال`
          }) [شماره فیش/رهگیری: ${trk}]`,
          currency: sp.currency,
          exchangeRate: sp.exchangeRate,
          debitForeign: isReceipt ? 0 : sp.amountForeign,
          creditForeign: isReceipt ? sp.amountForeign : 0,
          debitIRR: isReceipt ? 0 : sp.amountIRR,
          creditIRR: isReceipt ? sp.amountIRR : 0,
          trackingNumber: trk,
        });
      });

      autoTitle =
        description.trim() ||
        (isReceipt
          ? `سند اتوماتیک دریافت از ${selectedContact.name} (${formatNumber(totalIRR)} ریال)`
          : `سند اتوماتیک پرداخت به ${selectedContact.name} (${formatNumber(totalIRR)} ریال)`);
    } else if (
      autoType === 'currency_receive_from_person' ||
      autoType === 'currency_pay_to_person'
    ) {
      if (!selectedContact || fxDeliveryAmount <= 0) return;
      const isCurrencyReceipt = autoType === 'currency_receive_from_person';
      const vaultBank = banks.find((b) => b.id === fxDeliveryBankId) || banks[0];
      const bankAcc = getAccountHelperForBank(vaultBank, fxDeliveryCurrency);
      const personAccCode = selectedContact.type === 'supplier' ? '2101' : '1104';
      const personAccName =
        personAccCode === '2101'
          ? 'حساب اشخاص و فروشندگان (بستانکاران / بدهی ما)'
          : 'حساب اشخاص و مشتریان (بدهکاران / طلب ما)';

      const trk = mainTrackingNumber.trim() || `DLV-${voucherNumber}`;
      const rate = getRateForCurrency(fxDeliveryCurrency);

      const baseDesc = isCurrencyReceipt
        ? `دریافت ارز (${formatNumber(fxDeliveryAmount)} ${fxDeliveryCurrency}) از ${
            selectedContact.name
          } و ورود به ${vaultBank?.bankName || `صندوق ارزی (${fxDeliveryCurrency})`}`
        : `تحویل / پرداخت ارز (${formatNumber(fxDeliveryAmount)} ${fxDeliveryCurrency}) به ${
            selectedContact.name
          } از ${vaultBank?.bankName || `صندوق ارزی (${fxDeliveryCurrency})`}`;

      const fullDesc = description.trim()
        ? `${baseDesc} | توضیحات: ${description.trim()}`
        : baseDesc;

      autoTitle =
        description.trim() ||
        (isCurrencyReceipt
          ? `دریافت ارز از ${selectedContact.name} (${formatNumber(fxDeliveryAmount)} ${fxDeliveryCurrency})`
          : `تحویل / پرداخت ارز به ${selectedContact.name} (${formatNumber(fxDeliveryAmount)} ${fxDeliveryCurrency})`);

      // ردیف اول: صندوق / حساب ارزی
      lines.push({
        id: `ln-fx-dlv-b-${Date.now()}`,
        accountCode: bankAcc.code,
        accountName: bankAcc.name,
        bankId: vaultBank?.id,
        bankName: vaultBank?.bankName || `صندوق ارزی (${fxDeliveryCurrency})`,
        description: `${fullDesc} [شماره فیش/رهگیری: ${trk}]`,
        currency: fxDeliveryCurrency,
        exchangeRate: rate,
        debitForeign: isCurrencyReceipt ? fxDeliveryAmount : 0,
        creditForeign: isCurrencyReceipt ? 0 : fxDeliveryAmount,
        debitIRR: 0,
        creditIRR: 0,
        trackingNumber: trk,
        reconciled: true,
      });

      // ردیف دوم: صورتحساب ارزی شخص (بدون تغییر مانده ریالی شخص)
      lines.push({
        id: `ln-fx-dlv-p-${Date.now()}`,
        accountCode: personAccCode,
        accountName: personAccName,
        contactId: selectedContact.id,
        contactName: selectedContact.name,
        description: `${fullDesc} [شماره فیش/رهگیری: ${trk}]`,
        currency: fxDeliveryCurrency,
        exchangeRate: rate,
        debitForeign: isCurrencyReceipt ? 0 : fxDeliveryAmount,
        creditForeign: isCurrencyReceipt ? fxDeliveryAmount : 0,
        debitIRR: 0,
        creditIRR: 0,
        trackingNumber: trk,
      });
    } else if (autoType === 'bank_transfer') {
      if (txComputedIRR <= 0 || !sourceBankId || !destBankId) return;
      const srcBank = banks.find((b) => b.id === sourceBankId);
      const dstBank = banks.find((b) => b.id === destBankId);
      const srcAcc = getAccountHelperForBank(srcBank);
      const dstAcc = getAccountHelperForBank(dstBank);
      const trk = mainTrackingNumber.trim() || `TRF-${voucherNumber}`;

      autoTitle =
        description.trim() ||
        `انتقال وجه از ${srcBank?.bankName || 'مبدأ'} به ${dstBank?.bankName || 'مقصد'}`;

      lines.push({
        id: `ln-tr-in-${Date.now()}`,
        accountCode: dstAcc.code,
        accountName: dstAcc.name,
        bankId: destBankId,
        bankName: dstBank?.bankName,
        description: `ورود وجه انتقالی از ${srcBank?.bankName} - ${autoTitle} (شماره فیش/رهگیری: ${trk})`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: txAmountForeign,
        creditForeign: 0,
        debitIRR: txComputedIRR,
        creditIRR: 0,
        trackingNumber: trk,
        reconciled: true,
      });

      lines.push({
        id: `ln-tr-out-${Date.now()}`,
        accountCode: srcAcc.code,
        accountName: srcAcc.name,
        bankId: sourceBankId,
        bankName: srcBank?.bankName,
        description: `خروج وجه انتقالی به ${dstBank?.bankName} - ${autoTitle} (شماره فیش/رهگیری: ${trk})`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: 0,
        creditForeign: txAmountForeign,
        debitIRR: 0,
        creditIRR: txComputedIRR,
        trackingNumber: trk,
        reconciled: true,
      });
    } else if (autoType === 'expense') {
      if (txComputedIRR <= 0 || !sourceBankId) return;
      const srcBank = banks.find((b) => b.id === sourceBankId);
      const srcAcc = getAccountHelperForBank(srcBank);
      const expNode = accounts.find((a) => a.code === expenseAccountCode);
      const trk = mainTrackingNumber.trim() || `EXP-${voucherNumber}`;

      autoTitle =
        description.trim() ||
        `پرداخت هزینه (${expNode?.name || 'هزینه'}) از ${srcBank?.bankName || 'بانک/صندوق'}`;

      lines.push({
        id: `ln-exp-d-${Date.now()}`,
        accountCode: expNode?.code || '5201',
        accountName: expNode?.name || 'هزینه‌های شخصی، حقوق و دستمزد',
        description: `${autoTitle} (شماره فیش/رهگیری: ${trk})`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: txAmountForeign,
        creditForeign: 0,
        debitIRR: txComputedIRR,
        creditIRR: 0,
        trackingNumber: trk,
      });

      lines.push({
        id: `ln-exp-c-${Date.now()}`,
        accountCode: srcAcc.code,
        accountName: srcAcc.name,
        bankId: sourceBankId,
        bankName: srcBank?.bankName,
        description: `${autoTitle} (شماره فیش/رهگیری: ${trk})`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: 0,
        creditForeign: txAmountForeign,
        debitIRR: 0,
        creditIRR: txComputedIRR,
        trackingNumber: trk,
        reconciled: true,
      });
    } else if (autoType === 'income') {
      if (txComputedIRR <= 0 || !sourceBankId) return;
      const dstBank = banks.find((b) => b.id === sourceBankId);
      const dstAcc = getAccountHelperForBank(dstBank);
      const incNode = accounts.find((a) => a.code === incomeAccountCode);
      const trk = mainTrackingNumber.trim() || `INC-${voucherNumber}`;

      autoTitle =
        description.trim() ||
        `واریز به ${dstBank?.bankName || 'بانک/صندوق'} بابت ${
          incNode?.name || 'درآمد / شارژ حساب'
        }`;

      lines.push({
        id: `ln-inc-d-${Date.now()}`,
        accountCode: dstAcc.code,
        accountName: dstAcc.name,
        bankId: sourceBankId,
        bankName: dstBank?.bankName,
        description: `${autoTitle} (شماره فیش/رهگیری: ${trk})`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: txAmountForeign,
        creditForeign: 0,
        debitIRR: txComputedIRR,
        creditIRR: 0,
        trackingNumber: trk,
        reconciled: true,
      });

      lines.push({
        id: `ln-inc-c-${Date.now()}`,
        accountCode: incNode?.code || '4101',
        accountName: incNode?.name || 'درآمد فروش ریالی',
        description: `${autoTitle} (شماره فیش/رهگیری: ${trk})`,
        currency: txCurrency,
        exchangeRate: txExchangeRate,
        debitForeign: 0,
        creditForeign: txAmountForeign,
        debitIRR: 0,
        creditIRR: txComputedIRR,
        trackingNumber: trk,
      });
    }

    if (lines.length === 0) return;

    const resolvedRef =
      lines.find((l) => l.trackingNumber)?.trackingNumber ||
      mainTrackingNumber.trim() ||
      `VCH-${voucherNumber}`;

    const newVoucher: JournalVoucher = {
      id: editingVoucherId || `vch-auto-${Date.now()}`,
      voucherNumber,
      date,
      description: autoTitle,
      referenceNumber: resolvedRef,
      status: 'permanent',
      createdAt: date,
      autoType,
      lines,
    };

    if (editingVoucherId && onUpdateVoucher) {
      onUpdateVoucher(newVoucher);
      setEditingVoucherId(null);
      setSuccessMsg(`سند شماره ${voucherNumber} با موفقیت ویرایش و به‌روزرسانی شد.`);
    } else {
      onAddVoucher(newVoucher);
      setSuccessMsg(
        `سند شماره ${voucherNumber} با موفقیت ثبت شد و موجودی بانک/صندوق و صورتحساب شخص به‌روز گردید.`
      );
    }

    setSubmittedVoucherSuccess(newVoucher);
    setDescription('');
    setMainTrackingNumber('');
    setTxAmountForeign(0);
    setFxDeliveryAmount(0);
    if (splits.length > 0) {
      setSplits([
        {
          ...splits[0],
          id: `spl-${Date.now()}`,
          amountForeign: 0,
          amountIRR: 0,
          trackingNumber: '',
          description: '',
        },
      ]);
    }
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleStartEditVoucher = (v: JournalVoucher) => {
    setEditingVoucherId(v.id);
    setDate(v.date);
    setDescription(v.description);
    setMainTrackingNumber(
      v.referenceNumber || v.lines.find((l) => l.trackingNumber)?.trackingNumber || ''
    );

    const firstContact = v.lines.find((l) => l.contactId);
    if (firstContact && firstContact.contactId) {
      setSelectedContactId(firstContact.contactId);
    }

    // Check if it's a pure foreign currency delivery voucher
    const isPureCurrencyDelivery =
      v.autoType === 'currency_receive_from_person' ||
      v.autoType === 'currency_pay_to_person' ||
      (v.lines.length === 2 &&
        v.lines.every((l) => l.debitIRR === 0 && l.creditIRR === 0 && l.currency !== 'IRR'));

    if (isPureCurrencyDelivery) {
      setEntryTab('auto');
      const bankLine = v.lines.find((l) => l.bankId) || v.lines[0];
      const isRec = (bankLine.debitForeign || 0) > 0;
      setAutoType(isRec ? 'currency_receive_from_person' : 'currency_pay_to_person');
      setFxDeliveryCurrency(bankLine.currency);
      setFxDeliveryAmount(bankLine.debitForeign || bankLine.creditForeign || 0);
      if (bankLine.bankId) setFxDeliveryBankId(bankLine.bankId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (
      v.autoType === 'receive_from_person' ||
      v.autoType === 'pay_to_person'
    ) {
      setEntryTab('auto');
      setAutoType(v.autoType);
      const bankLines = v.lines.filter((l) => l.bankId);
      if (bankLines.length > 0) {
        const loadedSplits: PaymentSplitLine[] = bankLines.map((bl, i) => ({
          id: `spl-edit-${i}`,
          bankId: bl.bankId || '',
          bankName: bl.bankName || '',
          currency: bl.currency,
          amountForeign: bl.debitForeign || bl.creditForeign,
          exchangeRate: bl.exchangeRate,
          amountIRR: bl.debitIRR || bl.creditIRR,
          trackingNumber: bl.trackingNumber || '',
          description: bl.description,
        }));
        setSplits(loadedSplits);
      }
    } else if (
      v.autoType === 'bank_transfer' ||
      v.autoType === 'expense' ||
      v.autoType === 'income'
    ) {
      setEntryTab('auto');
      setAutoType(v.autoType);
      const bankLines = v.lines.filter((l) => l.bankId);
      if (v.autoType === 'bank_transfer' && bankLines.length >= 2) {
        const dst = bankLines.find((l) => l.debitIRR > 0 || l.debitForeign > 0) || bankLines[0];
        const src = bankLines.find((l) => l.creditIRR > 0 || l.creditForeign > 0) || bankLines[1];
        if (src?.bankId) setSourceBankId(src.bankId);
        if (dst?.bankId) setDestBankId(dst.bankId);
        setTxCurrency(src.currency || 'IRR');
        setTxExchangeRate(src.exchangeRate || 1);
        setTxAmountForeign(src.creditForeign || src.creditIRR || 0);
      } else if (bankLines.length >= 1) {
        const bl = bankLines[0];
        if (bl.bankId) setSourceBankId(bl.bankId);
        setTxCurrency(bl.currency || 'IRR');
        setTxExchangeRate(bl.exchangeRate || 1);
        setTxAmountForeign(
          bl.debitForeign || bl.creditForeign || bl.debitIRR || bl.creditIRR || 0
        );
      }
    } else {
      setEntryTab('manual');
      setManualLines(v.lines);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditVoucher = () => {
    setEditingVoucherId(null);
    setDescription('');
    setMainTrackingNumber('');
    setFxDeliveryAmount(0);
    setTxAmountForeign(0);
  };

  // ثبت سند دستی
  const totalManualDebit = manualLines.reduce((s, l) => s + (l.debitIRR || 0), 0);
  const totalManualCredit = manualLines.reduce((s, l) => s + (l.creditIRR || 0), 0);
  const totalManualForeignDebit = manualLines.reduce((s, l) => s + (l.debitForeign || 0), 0);
  const totalManualForeignCredit = manualLines.reduce((s, l) => s + (l.creditForeign || 0), 0);
  const isManualBalanced =
    (totalManualDebit > 0 && totalManualDebit === totalManualCredit) ||
    (totalManualForeignDebit > 0 && totalManualForeignDebit === totalManualForeignCredit);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManualBalanced) return;

    const existingVoucher = editingVoucherId
      ? vouchers.find((v) => v.id === editingVoucherId)
      : undefined;

    const voucherLines: VoucherLine[] = manualLines.map((ml, i) => {
      const acc = accounts.find((a) => a.code === ml.accountCode);
      const bnk = ml.bankId ? banks.find((b) => b.id === ml.bankId) : undefined;
      const cnt = ml.contactId ? contacts.find((c) => c.id === ml.contactId) : undefined;
      const curr = (ml.currency as CurrencyCode) || 'IRR';
      return {
        id: ml.id || `ml-${Date.now()}-${i}`,
        accountCode: ml.accountCode || '1102',
        accountName: acc?.name || 'حساب',
        contactId: ml.contactId || undefined,
        contactName: cnt?.name,
        bankId: ml.bankId || undefined,
        bankName: bnk?.bankName,
        description: ml.description || description || 'ثبت سند',
        currency: curr,
        exchangeRate: ml.exchangeRate || 1,
        debitForeign: curr === 'IRR' ? ml.debitIRR || 0 : ml.debitForeign || 0,
        creditForeign: curr === 'IRR' ? ml.creditIRR || 0 : ml.creditForeign || 0,
        debitIRR: ml.debitIRR || 0,
        creditIRR: ml.creditIRR || 0,
        trackingNumber: ml.trackingNumber || mainTrackingNumber.trim() || undefined,
      };
    });

    const nextManualVoucherNumber =
      existingVoucher?.voucherNumber ||
      Math.max(1003, ...vouchers.map((v) => v.voucherNumber || 0)) + 1;

    const targetVoucher: JournalVoucher = {
      id: editingVoucherId || `vch-man-${Date.now()}`,
      voucherNumber: nextManualVoucherNumber,
      date,
      description: description || 'سند حسابداری',
      referenceNumber: mainTrackingNumber.trim() || existingVoucher?.referenceNumber,
      status: 'permanent',
      createdAt: date,
      autoType: existingVoucher?.autoType || 'manual',
      lines: voucherLines,
    };

    if (editingVoucherId && onUpdateVoucher) {
      onUpdateVoucher(targetVoucher);
      setEditingVoucherId(null);
      setSuccessMsg(`سند شماره ${nextManualVoucherNumber} با موفقیت ویرایش و ذخیره شد.`);
    } else {
      onAddVoucher(targetVoucher);
      setSuccessMsg(`سند شماره ${nextManualVoucherNumber} با موفقیت ثبت شد.`);
    }
    setDescription('');
    setMainTrackingNumber('');
  };

  const moeinAccounts = accounts.filter((a) => a.level === 'moein');

  return (
    <div className="space-y-6">
      {/* نوار انتخاب حالت اتوماتیک (شخصی و راحت) یا سند دستی */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              دریافت و پرداخت ریالی + تحویل ارز (دریافت و پرداخت ارزی اشخاص)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              شخص را انتخاب کنید و مبلغ ریالی یا ارزی (دلار، یورو، درهم، یوان...) را به هر میزان ثبت کنید تا مستقیماً در صورتحساب شخص و موجودی بانک/صندوق بنشیند.
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setEntryTab('auto')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                entryTab === 'auto'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ثبت اتوماتیک و آسان (پیشنهادی)
            </button>
            <button
              type="button"
              onClick={() => setEntryTab('manual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                entryTab === 'manual'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              ثبت سند دستی (حرفه‌ای)
            </button>
          </div>
        </div>

        {editingVoucherId && (
          <div className="mb-4 bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-950 font-bold">
            <span className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-700" />
              در حال ویرایش و اصلاح سند شماره: #{vouchers.find((v) => v.id === editingVoucherId)?.voucherNumber}
            </span>
            <button
              type="button"
              onClick={handleCancelEditVoucher}
              className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-xs text-rose-700 hover:bg-rose-50 font-extrabold cursor-pointer"
            >
              انصراف از ویرایش
            </button>
          </div>
        )}

        {/* SUCCESS CONFIRMATION CARD ON VOUCHER SUBMIT */}
        {submittedVoucherSuccess && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-emerald-950 text-sm sm:text-base">
                    سند مالی شماره #{submittedVoucherSuccess.voucherNumber} با موفقیت ثبت شد!
                  </h3>
                  <p className="text-xs text-emerald-800">
                    مانده حساب بانک، صندوق و صورتحساب ریالی/ارزی شخص به‌روز گردید.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSubmittedVoucherSuccess(null)}
                className="p-1 rounded-xl text-emerald-700 hover:bg-emerald-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-emerald-200 text-xs font-mono-num">
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">شماره سند:</span>
                <span className="font-extrabold text-teal-800 text-sm">#{submittedVoucherSuccess.voucherNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">تاریخ سند:</span>
                <span className="font-extrabold text-slate-900 text-sm">{submittedVoucherSuccess.date}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">شرح سند:</span>
                <span className="font-extrabold text-slate-900 text-xs font-sans truncate block">{submittedVoucherSuccess.description}</span>
              </div>
            </div>
          </div>
        )}

        {successMsg && !submittedVoucherSuccess && (
          <div className="mb-5 bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {entryTab === 'auto' ? (
          <form onSubmit={handleAutoSubmit} className="space-y-6">
            {/* کارت‌های انتخاب نوع عملیات: دریافت/پرداخت ریالی + تحویل ارز (دریافت/پرداخت ارزی) + انتقال/هزینه */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setAutoType('receive_from_person')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'receive_from_person'
                    ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    دریافت ریالی
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900">
                  ۱. دریافت وجه (ریال) از شخص
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  مشتری یا شخص پول به بانک یا صندوق شما واریز کرده است
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutoType('pay_to_person')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'pay_to_person'
                    ? 'bg-rose-50 border-2 border-rose-600 text-rose-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <ArrowUpRight className="w-5 h-5 text-rose-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                    پرداخت ریالی
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900">
                  ۲. پرداخت وجه (ریال) به شخص
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  از بانک یا صندوق خودتان به شخص پول پرداخت کرده‌اید
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutoType('currency_receive_from_person')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'currency_receive_from_person'
                    ? 'bg-teal-50 border-2 border-teal-600 text-teal-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <PackageCheck className="w-5 h-5 text-teal-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                    ورود ارز به صندوق
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900">
                  ۳. دریافت ارز از شخص (تحویل گرفتن ارز)
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  شخص ارز (دلار، درهم، یورو...) به شما تحویل داده و در صورتحساب ارزی او ثبت می‌شود
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAutoType('currency_pay_to_person')}
                className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                  autoType === 'currency_pay_to_person'
                    ? 'bg-amber-50 border-2 border-amber-600 text-amber-950 font-bold shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Coins className="w-5 h-5 text-amber-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                    خروج ارز از صندوق
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900">
                  ۴. پرداخت / تحویل ارز به شخص
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  شما ارز (دلار، درهم، یورو...) به شخص تحویل داده‌اید و در صورتحساب ارزی او ثبت می‌شود
                </p>
              </button>
            </div>

            {/* دکمه‌های عملیات داخلی بانک، هزینه و درآمد */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-500">سایر عملیات مالی:</span>
              <button
                type="button"
                onClick={() => setAutoType('bank_transfer')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  autoType === 'bank_transfer'
                    ? 'bg-sky-600 text-white border-sky-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                انتقال بین بانک‌ها و صندوق‌ها
              </button>
              <button
                type="button"
                onClick={() => setAutoType('expense')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  autoType === 'expense'
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                ثبت هزینه شخصی / کاری
              </button>
              <button
                type="button"
                onClick={() => setAutoType('income')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  autoType === 'income'
                    ? 'bg-teal-600 text-white border-teal-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                درآمد متفرقه / شارژ بانک
              </button>
            </div>

            {/* بخش مشترک انتخاب شخص برای عملیات‌های طرف حساب (ریالی و تحویل ارز) */}
            {(autoType === 'receive_from_person' ||
              autoType === 'pay_to_person' ||
              autoType === 'currency_receive_from_person' ||
              autoType === 'currency_pay_to_person') && (
              <div className="space-y-5 bg-slate-50/70 border border-slate-200 rounded-xl p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-teal-600" />
                        {autoType === 'receive_from_person'
                          ? 'دریافت وجه ریالی از کدام شخص؟'
                          : autoType === 'pay_to_person'
                          ? 'پرداخت وجه ریالی به کدام شخص؟'
                          : autoType === 'currency_receive_from_person'
                          ? 'دریافت / تحویل گرفتن ارز از کدام شخص؟'
                          : 'پرداخت / تحویل دادن ارز به کدام شخص؟'}
                      </label>
                      {onAddContact && (
                        <button
                          type="button"
                          onClick={() => setShowQuickContact(!showQuickContact)}
                          className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          + شخص جدید
                        </button>
                      )}
                    </div>
                    <select
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || 'بدون تلفن'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">تاریخ عملیات</label>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num font-bold focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  {/* نمایش مانده لحظه‌ای ریالی و ارزی شخص انتخاب شده */}
                  {selectedContactStatement && (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">مانده ریالی فعلی:</span>
                        <span
                          className={`text-xs font-extrabold font-mono-num ${
                            selectedContactStatement.finalStatusIRR === 'بدهکار'
                              ? 'text-emerald-700'
                              : selectedContactStatement.finalStatusIRR === 'بستانکار'
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {selectedContactStatement.finalStatusIRR === 'تسویه'
                            ? 'تسویه (۰ ریال)'
                            : `${formatNumber(selectedContactStatement.finalBalanceIRR)} ریال (${
                                selectedContactStatement.finalStatusIRR === 'بدهکار'
                                  ? 'طلب ما از شخص'
                                  : 'بدهی ما به شخص'
                              })`}
                        </span>
                      </div>
                      {Object.entries(selectedContactStatement.currencyBreakdown)
                        .filter(([c]) => c !== 'IRR')
                        .map(([curr, b]) => (
                          <div
                            key={curr}
                            className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-num border-t border-slate-100 pt-1.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-sans text-teal-800 font-bold">
                                مانده ارزی ({curr}):
                              </span>
                              <span className="font-extrabold text-teal-950">
                                {formatCurrencyAmount(b.balanceForeign, curr)} {curr} (
                                {b.status === 'بدهکار'
                                  ? 'بدهکار به ما — باید تحویل دهد'
                                  : b.status === 'بستانکار'
                                  ? 'طلبکار از ما — باید تحویل دهیم'
                                  : 'تسویه'}
                                )
                              </span>
                            </div>
                            {b.balanceForeign > 0 && b.status !== 'تسویه' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSettleCurrencyBalance(curr, b.balanceForeign, b.status)
                                }
                                className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-xs"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>
                                  {b.status === 'بستانکار'
                                    ? `تحویل ${formatNumber(b.balanceForeign)} ${curr} به شخص`
                                    : `دریافت ${formatNumber(b.balanceForeign)} ${curr} از شخص`}
                                </span>
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {showQuickContact && (
                  <div className="bg-white border border-teal-300 rounded-xl p-3 flex flex-wrap items-end gap-3 shadow-xs">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-bold text-teal-800 mb-1">نام شخص</label>
                      <input
                        type="text"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="مثلاً: رضا محمدی"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                      />
                    </div>
                    <div className="w-48">
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">شماره تماس</label>
                      <input
                        type="text"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickCreateContact}
                      className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                    >
                      ذخیره شخص
                    </button>
                  </div>
                )}

                {/* فرم دریافت/پرداخت ریالی */}
                {(autoType === 'receive_from_person' || autoType === 'pay_to_person') && (
                  <MultiPaymentSplitsEditor
                    title={
                      autoType === 'receive_from_person'
                        ? `انتخاب بانک یا صندوق مقصد (واریز دریافتی از ${
                            selectedContact?.name || 'شخص'
                          })`
                        : `انتخاب بانک یا صندوق مبدأ (برداشت جهت پرداخت به ${
                            selectedContact?.name || 'شخص'
                          })`
                    }
                    subtitle="می‌توانید یک یا چند بانک و صندوق را انتخاب کنید."
                    totalTargetIRR={0}
                    splits={splits}
                    onChange={setSplits}
                    banks={banks}
                    currencies={currencies}
                    mode={autoType === 'receive_from_person' ? 'receipt' : 'payment'}
                    contactName={selectedContact?.name}
                  />
                )}

                {/* فرم مستقیم تحویل ارز (دریافت و پرداخت ارزی با هر شخصی و با هر مبلغی) */}
                {(autoType === 'currency_receive_from_person' ||
                  autoType === 'currency_pay_to_person') && (
                  <div
                    className={`rounded-2xl border-2 p-4 space-y-4 ${
                      autoType === 'currency_receive_from_person'
                        ? 'bg-teal-50/70 border-teal-400'
                        : 'bg-amber-50/70 border-amber-400'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-teal-700" />
                        {autoType === 'currency_receive_from_person'
                          ? `دریافت مستقیم ارز از «${selectedContact?.name || 'شخص'}» (ورود ارز به صندوق/حساب ما)`
                          : `پرداخت / تحویل مستقیم ارز به «${selectedContact?.name || 'شخص'}» (خروج ارز از صندوق/حساب ما)`}
                      </h4>
                      <span className="text-[11px] font-bold text-slate-600">
                        ثبت مستقیم در ستون ارزی صورتحساب شخص (امکان ثبت هر مبلغ کمتر، برابر یا بیشتر)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-extrabold text-slate-800 mb-1">
                          نوع ارز تحویلی / دریافتی:
                        </label>
                        <select
                          value={fxDeliveryCurrency}
                          onChange={(e) => {
                            const c = e.target.value as CurrencyCode;
                            setFxDeliveryCurrency(c);
                            const matchBank = banks.find((b) => b.currency === c);
                            if (matchBank) setFxDeliveryBankId(matchBank.id);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-900 focus:border-teal-600 focus:outline-none"
                        >
                          {foreignCurrencies.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-slate-800 mb-1">
                          مقدار ارز ({fxDeliveryCurrency}) — هر مبلغ دلخواه:
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={fxDeliveryAmount ? formatNumber(fxDeliveryAmount) : ''}
                          onChange={(e) =>
                            setFxDeliveryAmount(parseFormattedNumber(e.target.value))
                          }
                          placeholder={`مثلاً 500 یا 1,200 ${fxDeliveryCurrency}`}
                          className="w-full bg-white border-2 border-teal-500 rounded-xl px-3 py-2.5 text-sm font-extrabold font-mono-num text-slate-900 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-slate-800 mb-1">
                          {autoType === 'currency_receive_from_person'
                            ? 'ورود ارز به کدام صندوق / حساب؟'
                            : 'خروج ارز از کدام صندوق / حساب؟'}
                        </label>
                        <select
                          value={fxDeliveryBankId}
                          onChange={(e) => setFxDeliveryBankId(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                        >
                          {banks.length === 0 ? (
                            <option value="">صندوق ارزی پیش‌فرض ({fxDeliveryCurrency})</option>
                          ) : (
                            banks.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                                {b.bankName} ({b.currency})
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* حالت انتقال بین بانک‌ها، ثبت هزینه، یا ثبت درآمد */}
            {(autoType === 'bank_transfer' ||
              autoType === 'expense' ||
              autoType === 'income') && (
              <div className="space-y-4 bg-slate-50/70 border border-slate-200 rounded-xl p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {autoType === 'bank_transfer'
                        ? 'از بانک یا صندوق مبدأ (برداشت)'
                        : autoType === 'expense'
                        ? 'پرداخت از کدام بانک یا صندوق؟'
                        : 'واریز به کدام بانک یا صندوق؟'}
                    </label>
                    <select
                      value={sourceBankId}
                      onChange={(e) => handleSourceBankChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                          {b.bankName} ({b.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {autoType === 'bank_transfer' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        به بانک یا صندوق مقصد (واریز)
                      </label>
                      <select
                        value={destBankId}
                        onChange={(e) => setDestBankId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                      >
                        {banks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.kind === 'cash_box' ? '📦 ' : '🏦 '}
                            {b.bankName} ({b.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {autoType === 'expense' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">نوع هزینه</label>
                      <select
                        value={expenseAccountCode}
                        onChange={(e) => setExpenseAccountCode(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                      >
                        {moeinAccounts
                          .filter((a) => a.category === 'expense')
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {autoType === 'income' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">منبع واریز / شارژ</label>
                      <select
                        value={incomeAccountCode}
                        onChange={(e) => setIncomeAccountCode(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                      >
                        {moeinAccounts
                          .filter((a) => a.category === 'revenue' || a.category === 'equity')
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">تاریخ</label>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                </div>

                {/* مبلغ و تعیین ارزش ارز در صورت ارزی بودن */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">نوع پول / ارز</label>
                    <select
                      value={txCurrency}
                      onChange={(e) => {
                        const c = e.target.value as CurrencyCode;
                        setTxCurrency(c);
                        setTxExchangeRate(getRateForCurrency(c));
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      <option value="IRR">ریال ایران (IRR)</option>
                      {currencies
                        .filter((c) => c.code !== 'IRR')
                        .map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {txCurrency === 'IRR' ? 'مبلغ (ریال)' : `مبلغ ارزی (${txCurrency})`}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={txAmountForeign ? formatNumber(txAmountForeign) : ''}
                      onChange={(e) => setTxAmountForeign(parseFormattedNumber(e.target.value))}
                      placeholder="مثلاً 10,000,000"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  {txCurrency !== 'IRR' && (
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-amber-600" />
                        تعیین ارزش هر ۱ {txCurrency} (به ریال)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={txExchangeRate ? formatNumber(txExchangeRate) : ''}
                        onChange={(e) => setTxExchangeRate(parseFormattedNumber(e.target.value))}
                        className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-900 font-mono-num focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                      />
                    </div>
                  )}

                  <div className="bg-white border border-teal-300 rounded-lg px-3.5 py-2 flex items-center justify-between shadow-xs">
                    <span className="text-xs text-slate-600">معادل ریالی سند:</span>
                    <span className="text-sm font-extrabold text-teal-700 font-mono-num">
                      {formatNumber(txComputedIRR)} ریال
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* یک فیلد واحد برای شماره فیش / کد رهگیری + توضیحات کامل */}
            <div className="bg-teal-50/70 border-2 border-teal-300 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
                <div>
                  <label className="block text-xs font-extrabold text-teal-900 mb-1 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-teal-700" />
                    شماره فیش / کد رهگیری / شماره رسید (در صورتحساب می‌آید):
                  </label>
                  <input
                    type="text"
                    value={
                      (autoType === 'receive_from_person' || autoType === 'pay_to_person') &&
                      splits.length === 1 &&
                      splits[0].trackingNumber
                        ? splits[0].trackingNumber
                        : mainTrackingNumber
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setMainTrackingNumber(val);
                      if (
                        (autoType === 'receive_from_person' || autoType === 'pay_to_person') &&
                        splits.length === 1
                      ) {
                        setSplits([{ ...splits[0], trackingNumber: val }]);
                      }
                    }}
                    placeholder="مثلاً: 8941203 یا DLV-101"
                    className="w-full bg-white border-2 border-teal-400 rounded-xl px-3.5 py-2.5 text-xs font-extrabold font-mono-num text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    توضیحات کامل فیش و سند (دقیقاً خط به خط در صورتحساب مشتری نمایش داده می‌شود):
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="توضیحات یا بابت را اینجا بنویسید (مثلاً: تحویل نقدی ۵۰۰ دلار / واریز پایا)..."
                    className="w-full bg-white border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {editingVoucherId && (
                  <button
                    type="button"
                    onClick={handleCancelEditVoucher}
                    className="px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    انصراف از ویرایش
                  </button>
                )}
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-teal-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingVoucherId
                    ? 'ذخیره تغییرات سند مالی و به‌روزرسانی حساب'
                    : 'ثبت سند مالی و به‌روزرسانی بانک/صورتحساب شخص'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* فرم سند دستی برای کاربران حرفه‌ای */
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">تاریخ سند</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">شرح کلی سند</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="شرح سند..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              {manualLines.map((line, idx) => (
                <div
                  key={line.id || idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 items-center"
                >
                  <div className="md:col-span-3">
                    <select
                      value={line.accountCode}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = { ...next[idx], accountCode: e.target.value };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                    >
                      {moeinAccounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={line.contactId || ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = { ...next[idx], contactId: e.target.value || undefined };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                    >
                      <option value="">-- بدون شخص --</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={line.bankId || ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = { ...next[idx], bankId: e.target.value || undefined };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 focus:border-teal-600"
                    >
                      <option value="">-- بدون بانک/صندوق --</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="بدهکار (ریال)"
                      value={line.debitIRR ? formatNumber(line.debitIRR) : ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = {
                          ...next[idx],
                          debitIRR: parseFormattedNumber(e.target.value),
                          creditIRR: 0,
                        };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="بستانکار (ریال)"
                      value={line.creditIRR ? formatNumber(line.creditIRR) : ''}
                      onChange={(e) => {
                        const next = [...manualLines];
                        next[idx] = {
                          ...next[idx],
                          creditIRR: parseFormattedNumber(e.target.value),
                          debitIRR: 0,
                        };
                        setManualLines(next);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600"
                    />
                  </div>
                  <div className="md:col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        manualLines.length > 2 &&
                        setManualLines(manualLines.filter((_, i) => i !== idx))
                      }
                      className="text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() =>
                  setManualLines([
                    ...manualLines,
                    {
                      id: `ml-${Date.now()}`,
                      accountCode: '1102',
                      currency: 'IRR',
                      exchangeRate: 1,
                      debitIRR: 0,
                      creditIRR: 0,
                      debitForeign: 0,
                      creditForeign: 0,
                    },
                  ])
                }
                className="text-xs bg-slate-100 hover:bg-slate-200 text-teal-800 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                افزودن آرتیکل
              </button>

              <button
                type="submit"
                disabled={!isManualBalanced}
                className="px-5 py-2 rounded-xl bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs cursor-pointer shadow-xs"
              >
                {editingVoucherId ? 'ذخیره تغییرات سند' : 'ثبت سند دستی'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* فهرست اسناد مالی ثبت‌شده (اتوماتیک و دستی) + جستجو، ویرایش و حذف */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-teal-600" />
            تاریخچه اسناد دریافت، پرداخت، تحویل ارز و تراکنش‌های مالی ({formatNumber(vouchers.length)} سند)
          </h3>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-teal-600 absolute right-3 top-2.5" />
            <input
              type="text"
              value={voucherSearchQuery}
              onChange={(e) => setVoucherSearchQuery(e.target.value)}
              placeholder="🔍 جستجوی شماره فیش، کد رهگیری، نام شخص یا مبلغ..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-teal-50/70 border-2 border-teal-400 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-none font-bold text-slate-900"
            />
          </div>
        </div>

        <div className="space-y-3">
          {vouchers
            .filter((v) => {
              const q = voucherSearchQuery.trim().toLowerCase();
              if (!q) return true;
              if (
                String(v.voucherNumber).includes(q) ||
                (v.referenceNumber || '').toLowerCase().includes(q) ||
                v.description.toLowerCase().includes(q) ||
                v.date.toLowerCase().includes(q)
              ) {
                return true;
              }
              return v.lines.some(
                (ln) =>
                  (ln.trackingNumber || '').toLowerCase().includes(q) ||
                  (ln.contactName || '').toLowerCase().includes(q) ||
                  (ln.bankName || '').toLowerCase().includes(q) ||
                  (ln.description || '').toLowerCase().includes(q) ||
                  String(ln.debitIRR).includes(q) ||
                  String(ln.creditIRR).includes(q) ||
                  String(ln.debitForeign).includes(q) ||
                  String(ln.creditForeign).includes(q)
              );
            })
            .map((v) => {
              const sumIRR = v.lines.reduce((s, l) => s + l.debitIRR, 0);
              const firstForeignLine = v.lines.find(
                (l) => l.currency !== 'IRR' && ((l.debitForeign || 0) > 0 || (l.creditForeign || 0) > 0)
              );
              const sumForeign = v.lines.reduce((s, l) => s + (l.debitForeign || 0), 0);
              const voucherTrackingNumbers = Array.from(
                new Set(
                  v.lines
                    .map((l) => l.trackingNumber)
                    .filter((t): t is string => Boolean(t && t.trim()))
                )
              );

              return (
                <div
                  key={v.id}
                  className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-mono-num text-xs font-bold border border-teal-200">
                        سند #{v.voucherNumber}
                      </span>
                      <span className="text-xs text-slate-500 font-mono-num">{v.date}</span>
                      {voucherTrackingNumbers.map((trk) => (
                        <span
                          key={trk}
                          className="px-2.5 py-0.5 rounded-lg bg-teal-700 text-white font-mono-num text-xs font-extrabold flex items-center gap-1"
                        >
                          <Hash className="w-3 h-3" />
                          فیش/رهگیری: {trk}
                        </span>
                      ))}
                      <span className="text-sm font-bold text-slate-900">{v.description}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {sumIRR > 0 ? (
                        <span className="text-xs font-extrabold text-emerald-700 font-mono-num">
                          جمع سند: {formatNumber(sumIRR)} ریال
                        </span>
                      ) : firstForeignLine ? (
                        <span className="text-xs font-extrabold text-teal-800 font-mono-num">
                          مقدار ارز: {formatNumber(sumForeign)} {firstForeignLine.currency}
                        </span>
                      ) : null}
                      {onUpdateVoucher && (
                        <button
                          type="button"
                          onClick={() => handleStartEditVoucher(v)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer text-xs flex items-center gap-1 font-bold transition"
                          title="ویرایش و اصلاح این سند"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ویرایش</span>
                        </button>
                      )}
                      {onDeleteVoucher && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `آیا از حذف سند مالی شماره #${v.voucherNumber} اطمینان دارید؟\nبا حذف این سند، مانده حساب شخص و بانک مربوطه به‌روز خواهد شد.`
                              )
                            ) {
                              onDeleteVoucher(v.id);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer text-xs flex items-center gap-1 font-bold transition"
                          title="حذف این سند"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {v.lines.map((ln) => {
                      const bankObj = ln.bankId ? banks.find((b) => b.id === ln.bankId) : undefined;
                      const contactObj = ln.contactId
                        ? contacts.find((c) => c.id === ln.contactId)
                        : undefined;
                      const isDebit = ln.debitIRR > 0 || (ln.debitIRR === 0 && ln.creditIRR === 0 && ln.debitForeign > 0);
                      return (
                        <div
                          key={ln.id}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 shadow-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900">{ln.accountName}</span>
                              {bankObj && (
                                <span className="text-teal-700 font-bold">({bankObj.bankName})</span>
                              )}
                              {contactObj && (
                                <span className="text-amber-800 font-bold">({contactObj.name})</span>
                              )}
                              {ln.trackingNumber && (
                                <span className="px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono font-bold text-teal-800 text-[10px]">
                                  رهگیری: {ln.trackingNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-700 mt-1 leading-relaxed break-words">
                              {ln.description}
                            </p>
                          </div>
                          <div className="text-left shrink-0 font-mono-num">
                            {ln.debitIRR > 0 || ln.creditIRR > 0 ? (
                              isDebit ? (
                                <span className="text-emerald-700 font-bold">
                                  بدهکار: {formatNumber(ln.debitIRR)} ریال
                                </span>
                              ) : (
                                <span className="text-rose-700 font-bold">
                                  بستانکار: {formatNumber(ln.creditIRR)} ریال
                                </span>
                              )
                            ) : (
                              isDebit ? (
                                <span className="text-emerald-700 font-bold">
                                  بدهکار ارزی: {formatNumber(ln.debitForeign)} {ln.currency}
                                </span>
                              ) : (
                                <span className="text-rose-700 font-bold">
                                  بستانکار ارزی: {formatNumber(ln.creditForeign)} {ln.currency}
                                </span>
                              )
                            )}
                            {ln.currency !== 'IRR' && (ln.debitIRR > 0 || ln.creditIRR > 0) && (ln.debitForeign > 0 || ln.creditForeign > 0) && (
                              <div className="text-[10px] text-amber-800 font-semibold">
                                ({formatNumber(ln.debitForeign || ln.creditForeign)} {ln.currency} ×{' '}
                                {formatNumber(ln.exchangeRate)})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
