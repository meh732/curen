import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertForeignToIRR,
  convertIRRToForeign,
  calculateVoucherBalance,
  buildPersonStatement,
  reconcileBankTransactions,
  calculateCurrencyVaultPositions,
  buildStandardLedgerReport,
  formatCurrencyAmount,
} from './accountingEngine';
import { JournalVoucher, BankStatementEntry } from '../types/accounting';

test('formatCurrencyAmount formats Rial as 3-by-3 integer and Foreign currency with 2 decimals', () => {
  assert.equal(formatCurrencyAmount(685000000, 'IRR'), '685,000,000');
  assert.equal(formatCurrencyAmount(12500.5, 'USD'), '12,500.50');
  assert.equal(formatCurrencyAmount(8000, 'AED'), '8,000.00');
});

test('buildStandardLedgerReport computes top-to-bottom Debit, Credit, Diagnosis, and Running Balance for expenses and banks', () => {
  const accounts = [
    {
      code: '5202',
      name: 'هزینه کارمزد بانکی و حوالجات ارزی',
      level: 'moein' as const,
      nature: 'debit' as const,
      category: 'expense' as const,
    },
  ];
  const vouchers: JournalVoucher[] = [
    {
      id: 'v1',
      voucherNumber: 1001,
      date: '1404/08/01',
      description: 'کارمزد حواله اول',
      status: 'permanent',
      createdAt: '1404/08/01',
      lines: [
        {
          id: 'l1',
          accountCode: '5202',
          accountName: 'هزینه کارمزد بانکی و حوالجات ارزی',
          description: 'کارمزد سوئیفت دلاری',
          currency: 'USD',
          exchangeRate: 680000,
          debitForeign: 50,
          creditForeign: 0,
          debitIRR: 34000000,
          creditIRR: 0,
        },
      ],
    },
    {
      id: 'v2',
      voucherNumber: 1002,
      date: '1404/08/05',
      description: 'کارمزد حواله دوم',
      status: 'permanent',
      createdAt: '1404/08/05',
      lines: [
        {
          id: 'l2',
          accountCode: '5202',
          accountName: 'هزینه کارمزد بانکی و حوالجات ارزی',
          description: 'کارمزد حواله درهمی',
          currency: 'USD',
          exchangeRate: 685000,
          debitForeign: 25.5,
          creditForeign: 0,
          debitIRR: 17467500,
          creditIRR: 0,
        },
      ],
    },
  ];

  const report = buildStandardLedgerReport({
    vouchers,
    accounts,
    filterType: 'expense',
    targetId: 'ALL_EXPENSES',
    targetLabel: 'گزارش کل هزینه‌ها',
    currencyMode: 'foreign',
    currencyFilter: 'ALL',
  });

  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].runningBalanceIRR, 34000000);
  assert.equal(report.rows[1].runningBalanceIRR, 51467500);
  assert.equal(report.rows[0].runningBalanceForeign, 50);
  assert.equal(report.rows[1].runningBalanceForeign, 75.5);
  assert.equal(report.finalDiagnosisIRR, 'بدهکار');
});

test('calculateCurrencyVaultPositions computes exact buy/sell volume, weighted average rate, and realized profit', () => {
  const currencies = [
    { code: 'IRR', name: 'ریال', symbol: 'ریال', defaultRateToIRR: 1, isBase: true },
    { code: 'USD', name: 'دلار آمریکا', symbol: '$', defaultRateToIRR: 685000 },
  ];
  const deals = [
    {
      type: 'buy' as const,
      currency: 'USD',
      foreignAmount: 10000,
      exchangeRate: 680000,
      totalIRR: 6800000000,
    },
    {
      type: 'sell' as const,
      currency: 'USD',
      foreignAmount: 4000,
      exchangeRate: 686000,
      totalIRR: 2744000000,
    },
  ];
  const [usdPos] = calculateCurrencyVaultPositions(currencies, deals);
  assert.equal(usdPos.totalBoughtForeign, 10000);
  assert.equal(usdPos.totalSoldForeign, 4000);
  assert.equal(usdPos.netVaultBalanceForeign, 6000);
  assert.equal(usdPos.weightedAvgBuyRate, 680000);
  assert.equal(usdPos.weightedAvgSellRate, 686000);
  // 4,000 USD sold with +6,000 IRR spread per USD = 24,000,000 IRR realized profit
  assert.equal(usdPos.realizedProfitIRR, 24000000);
});

test('convertForeignToIRR and convertIRRToForeign maintain exact multi-currency conversion', () => {
  // 1,500 USD at 685,000 IRR/USD = 1,027,500,000 IRR
  assert.equal(convertForeignToIRR(1500, 685000, 'USD'), 1027500000);
  // Base currency IRR ignores rate and keeps exact integer
  assert.equal(convertForeignToIRR(45000000, 685000, 'IRR'), 45000000);
  // Reverse conversion
  assert.equal(convertIRRToForeign(1027500000, 685000, 'USD'), 1500);
});

test('calculateVoucherBalance validates double-entry balance in IRR and foreign currencies', () => {
  const balancedLines = [
    {
      id: 'l1',
      accountCode: '1103',
      accountName: 'موجودی بانک ارزی',
      description: 'واریز درهمی به صرافی',
      currency: 'AED',
      exchangeRate: 186500,
      debitForeign: 10000,
      creditForeign: 0,
      debitIRR: 1865000000,
      creditIRR: 0,
    },
    {
      id: 'l2',
      accountCode: '1104',
      accountName: 'حساب‌های دریافتنی تجاری',
      contactId: 'c1',
      contactName: 'بازرگانی الفطیم دبی',
      description: 'تسویه فاکتور صادراتی',
      currency: 'AED',
      exchangeRate: 186500,
      debitForeign: 0,
      creditForeign: 10000,
      debitIRR: 0,
      creditIRR: 1865000000,
    },
  ];

  const summary = calculateVoucherBalance(balancedLines);
  assert.equal(summary.isBalancedIRR, true);
  assert.equal(summary.differenceIRR, 0);
  assert.equal(summary.byCurrency['AED'].debitForeign, 10000);
  assert.equal(summary.byCurrency['AED'].creditForeign, 10000);
  assert.equal(summary.byCurrency['AED'].differenceForeign, 0);
});

test('buildPersonStatement calculates accurate Rial and Foreign running balances per person', () => {
  const vouchers: JournalVoucher[] = [
    {
      id: 'v1',
      voucherNumber: 101,
      date: '1404/08/01',
      description: 'فروش کالا به مشتری ارزی',
      status: 'permanent',
      createdAt: '1404/08/01',
      lines: [
        {
          id: 'vl1',
          accountCode: '1104',
          accountName: 'حساب‌های دریافتنی',
          contactId: 'c-100',
          contactName: 'شرکت بازرگانی شانگهای تجارت',
          description: 'فاکتور فروش شماره ۱۰۱',
          currency: 'CNY',
          exchangeRate: 95200,
          debitForeign: 50000,
          creditForeign: 0,
          debitIRR: 4760000000,
          creditIRR: 0,
        },
      ],
    },
    {
      id: 'v2',
      voucherNumber: 102,
      date: '1404/08/05',
      description: 'دریافت حواله یوان',
      status: 'permanent',
      createdAt: '1404/08/05',
      lines: [
        {
          id: 'vl2',
          accountCode: '1104',
          accountName: 'حساب‌های دریافتنی',
          contactId: 'c-100',
          contactName: 'شرکت بازرگانی شانگهای تجارت',
          description: 'حواله بانکی یوان',
          currency: 'CNY',
          exchangeRate: 95200,
          debitForeign: 0,
          creditForeign: 20000,
          debitIRR: 0,
          creditIRR: 1904000000,
        },
      ],
    },
  ];

  const statement = buildPersonStatement(vouchers, 'c-100', 'CNY');
  assert.equal(statement.rows.length, 2);
  assert.equal(statement.finalBalanceForeign, 30000);
  assert.equal(statement.finalStatusForeign, 'بدهکار');
  assert.equal(statement.finalBalanceIRR, 2856000000);
  assert.equal(statement.finalStatusIRR, 'بدهکار');
});

test('reconcileBankTransactions detects matched and unmatched items accurately', () => {
  const vouchers: JournalVoucher[] = [
    {
      id: 'v1',
      voucherNumber: 201,
      date: '1404/08/10',
      description: 'واریز مشتری',
      status: 'permanent',
      createdAt: '1404/08/10',
      lines: [
        {
          id: 'bl1',
          accountCode: '1102',
          accountName: 'بانک ملت ریالی',
          bankId: 'bank-1',
          description: 'واریز شبا',
          currency: 'IRR',
          exchangeRate: 1,
          debitForeign: 100000000,
          creditForeign: 0,
          debitIRR: 100000000,
          creditIRR: 0,
          trackingNumber: 'TRK-9001',
        },
        {
          id: 'bl2',
          accountCode: '1102',
          accountName: 'بانک ملت ریالی',
          bankId: 'bank-1',
          description: 'چک در راه پرداختنی',
          currency: 'IRR',
          exchangeRate: 1,
          debitForeign: 0,
          creditForeign: 25000000,
          debitIRR: 0,
          creditIRR: 25000000,
          trackingNumber: 'CHK-552',
        },
      ],
    },
  ];

  const statements: BankStatementEntry[] = [
    {
      id: 'st1',
      bankId: 'bank-1',
      date: '1404/08/10',
      trackingNumber: 'TRK-9001',
      description: 'واریز ساتنا',
      currency: 'IRR',
      depositForeign: 100000000,
      withdrawalForeign: 0,
      depositIRR: 100000000,
      withdrawalIRR: 0,
    },
    {
      id: 'st2',
      bankId: 'bank-1',
      date: '1404/08/11',
      trackingNumber: 'FEE-101',
      description: 'کارمزد خدمات بانکی ثبت نشده در دفاتر',
      currency: 'IRR',
      depositForeign: 0,
      withdrawalForeign: 500000,
      depositIRR: 0,
      withdrawalIRR: 500000,
    },
  ];

  const rec = reconcileBankTransactions('bank-1', 500000000, 500000000, vouchers, statements);
  assert.equal(rec.matchedPairsCount, 1);
  assert.equal(rec.unmatchedLedgerLines.length, 1);
  assert.equal(rec.unmatchedStatementEntries.length, 1);
  assert.equal(rec.isReconciled, true);
  assert.equal(rec.adjustedLedgerBalanceForeign, 574500000);
  assert.equal(rec.adjustedStatementBalanceForeign, 574500000);
});

test('offlineLicenseEngine enforces V6 Hardware Key derived from Vendor Master Password (ARKA-MASTER-2026)', async () => {
  const {
    generateOfflineActivationKey,
    verifyOfflineActivationKey,
    getOrCreateMachineId,
    verifyMasterPassword,
    saveActivatedLicense,
    VENDOR_MASTER_PASSWORD,
  } = await import('./offlineLicenseEngine');

  const machineId = getOrCreateMachineId();
  assert.match(machineId, /^TB-HW-\d{4}-\d{4}$/);

  // Key generated with official master password
  const generatedKey = generateOfflineActivationKey(machineId, VENDOR_MASTER_PASSWORD);
  assert.match(generatedKey, /^\d{4}-\d{4}-\d{4}-\d{4}$/);
  assert.equal(verifyOfflineActivationKey(machineId, generatedKey), true);

  // Master password verification
  assert.equal(verifyMasterPassword(''), false);
  assert.equal(verifyMasterPassword('WRONG-PASS-1234'), false);
  assert.equal(verifyMasterPassword('ARKA-MASTER-2026'), true);
  assert.equal(verifyMasterPassword('arka-master-2026'), true);

  // Without valid Master Password in keygen, key generation fails or cannot produce valid key
  assert.equal(generateOfflineActivationKey(machineId, 'WRONG-MASTER'), '');
  assert.equal(generateOfflineActivationKey(machineId, ''), '');

  // A key for a different computer's hardware ID must be rejected
  const otherComputerKey = generateOfflineActivationKey('TB-HW-1111-2222', VENDOR_MASTER_PASSWORD);
  assert.equal(verifyOfflineActivationKey(machineId, otherComputerKey), false);

  // Activation succeeds when valid 16-digit key matching the machine ID is provided
  const activated = saveActivatedLicense(machineId, generatedKey);
  assert.notEqual(activated, null);
  assert.equal(activated?.isActivated, true);
});

