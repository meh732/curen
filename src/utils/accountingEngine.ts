import {
  Account,
  BankStatementEntry,
  CurrencyCode,
  JournalVoucher,
  VoucherLine,
} from '../types/accounting';

/**
 * Converts a foreign currency amount to Iranian Rials (IRR) using the given exchange rate.
 * Ensures exact integer precision for IRR.
 */
export function convertForeignToIRR(amountForeign: number, exchangeRate: number, currency: CurrencyCode): number {
  if (currency === 'IRR') {
    return Math.round(amountForeign);
  }
  const safeAmount = Number.isFinite(amountForeign) ? amountForeign : 0;
  const safeRate = Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1;
  return Math.round(safeAmount * safeRate);
}

/**
 * Converts an IRR amount to a foreign currency using the given exchange rate (2 decimal precision).
 */
export function convertIRRToForeign(amountIRR: number, exchangeRate: number, currency: CurrencyCode): number {
  if (currency === 'IRR') {
    return Math.round(amountIRR);
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    return 0;
  }
  return Number((amountIRR / exchangeRate).toFixed(2));
}

export interface VoucherBalanceSummary {
  totalDebitIRR: number;
  totalCreditIRR: number;
  differenceIRR: number;
  isBalancedIRR: boolean;
  byCurrency: Record<
    string,
    {
      debitForeign: number;
      creditForeign: number;
      differenceForeign: number;
    }
  >;
}

/**
 * Validates double-entry balance of a journal voucher in both IRR (mandatory) and per-currency breakdown.
 */
export function calculateVoucherBalance(lines: VoucherLine[]): VoucherBalanceSummary {
  let totalDebitIRR = 0;
  let totalCreditIRR = 0;
  const byCurrency: Record<
    string,
    { debitForeign: number; creditForeign: number; differenceForeign: number }
  > = {};

  for (const line of lines) {
    const dIRR = Math.round(line.debitIRR || 0);
    const cIRR = Math.round(line.creditIRR || 0);
    totalDebitIRR += dIRR;
    totalCreditIRR += cIRR;

    const curr = line.currency || 'IRR';
    if (!byCurrency[curr]) {
      byCurrency[curr] = { debitForeign: 0, creditForeign: 0, differenceForeign: 0 };
    }
    byCurrency[curr].debitForeign = Number((byCurrency[curr].debitForeign + (line.debitForeign || 0)).toFixed(2));
    byCurrency[curr].creditForeign = Number((byCurrency[curr].creditForeign + (line.creditForeign || 0)).toFixed(2));
    byCurrency[curr].differenceForeign = Number(
      (byCurrency[curr].debitForeign - byCurrency[curr].creditForeign).toFixed(2)
    );
  }

  const differenceIRR = totalDebitIRR - totalCreditIRR;
  return {
    totalDebitIRR,
    totalCreditIRR,
    differenceIRR,
    isBalancedIRR: totalDebitIRR > 0 && differenceIRR === 0,
    byCurrency,
  };
}

export interface PersonStatementRow {
  lineId: string;
  voucherId: string;
  voucherNumber: number;
  date: string;
  accountCode: string;
  accountName: string;
  description: string;
  currency: CurrencyCode;
  exchangeRate: number;
  debitForeign: number;
  creditForeign: number;
  runningBalanceForeign: number;
  balanceStatusForeign: 'بدهکار' | 'بستانکار' | 'تسویه';
  debitIRR: number;
  creditIRR: number;
  runningBalanceIRR: number;
  balanceStatusIRR: 'بدهکار' | 'بستانکار' | 'تسویه';
  trackingNumber?: string;
}

export interface PersonStatementResult {
  contactId: string;
  currencyFilter: CurrencyCode | 'ALL';
  rows: PersonStatementRow[];
  totalDebitForeign: number;
  totalCreditForeign: number;
  finalBalanceForeign: number;
  finalStatusForeign: 'بدهکار' | 'بستانکار' | 'تسویه';
  totalDebitIRR: number;
  totalCreditIRR: number;
  finalBalanceIRR: number;
  finalStatusIRR: 'بدهکار' | 'بستانکار' | 'تسویه';
  currencyBreakdown: Record<
    string,
    {
      debitForeign: number;
      creditForeign: number;
      balanceForeign: number;
      status: 'بدهکار' | 'بستانکار' | 'تسویه';
    }
  >;
}

/**
 * Generates standard accounting statement (صورتحساب شخص) in both Rial (ریالی) and Foreign Currency (ارزی)
 * with running balance (مانده در گردش) and تشخيص (بدهکار / بستانکار / تسویه).
 */
export function buildPersonStatement(
  vouchers: JournalVoucher[],
  contactId: string,
  currencyFilter: CurrencyCode | 'ALL' = 'ALL'
): PersonStatementResult {
  const sortedVouchers = [...vouchers].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.voucherNumber - b.voucherNumber;
  });

  const rows: PersonStatementRow[] = [];
  let runningIRR = 0;
  let runningForeign = 0;
  let totalDebitIRR = 0;
  let totalCreditIRR = 0;
  let totalDebitForeign = 0;
  let totalCreditForeign = 0;

  const currencyBreakdown: Record<
    string,
    {
      debitForeign: number;
      creditForeign: number;
      balanceForeign: number;
      status: 'بدهکار' | 'بستانکار' | 'تسویه';
    }
  > = {};

  const runningByCurrency: Record<string, number> = {};
  let lastActiveForeignCurrency: string | null = null;

  for (const voucher of sortedVouchers) {
    const siblingBankLineWithTrk = voucher.lines.find(
      (l) => l.bankId && l.trackingNumber && l.trackingNumber.trim() !== ''
    );

    for (const line of voucher.lines) {
      if (line.contactId !== contactId) continue;

      const curr = line.currency || 'IRR';
      const isForeignLine = curr !== 'IRR';
      const lineDebitFor = isForeignLine ? Number((line.debitForeign || 0).toFixed(2)) : 0;
      const lineCreditFor = isForeignLine ? Number((line.creditForeign || 0).toFixed(2)) : 0;

      // Track breakdown across all foreign currencies for this person
      if (isForeignLine && (lineDebitFor > 0 || lineCreditFor > 0)) {
        lastActiveForeignCurrency = curr;
        if (!currencyBreakdown[curr]) {
          currencyBreakdown[curr] = {
            debitForeign: 0,
            creditForeign: 0,
            balanceForeign: 0,
            status: 'تسویه',
          };
        }
        currencyBreakdown[curr].debitForeign = Number(
          (currencyBreakdown[curr].debitForeign + lineDebitFor).toFixed(2)
        );
        currencyBreakdown[curr].creditForeign = Number(
          (currencyBreakdown[curr].creditForeign + lineCreditFor).toFixed(2)
        );
        const cBal = Number(
          (currencyBreakdown[curr].debitForeign - currencyBreakdown[curr].creditForeign).toFixed(2)
        );
        currencyBreakdown[curr].balanceForeign = Math.abs(cBal);
        currencyBreakdown[curr].status = cBal > 0 ? 'بدهکار' : cBal < 0 ? 'بستانکار' : 'تسویه';
      }

      if (currencyFilter !== 'ALL' && line.currency !== currencyFilter) {
        continue;
      }

      runningIRR += (line.debitIRR || 0) - (line.creditIRR || 0);
      totalDebitIRR += line.debitIRR || 0;
      totalCreditIRR += line.creditIRR || 0;

      if (isForeignLine) {
        runningByCurrency[curr] = Number(
          ((runningByCurrency[curr] || 0) + (lineDebitFor - lineCreditFor)).toFixed(2)
        );
        runningForeign = Number((runningForeign + (lineDebitFor - lineCreditFor)).toFixed(2));
        totalDebitForeign = Number((totalDebitForeign + lineDebitFor).toFixed(2));
        totalCreditForeign = Number((totalCreditForeign + lineCreditFor).toFixed(2));
      }

      const rowRunningForeign = isForeignLine
        ? runningByCurrency[curr] || 0
        : lastActiveForeignCurrency
        ? runningByCurrency[lastActiveForeignCurrency] || 0
        : runningForeign;

      // Combine line description and voucher description if voucher has extra user notes
      const baseDesc = (line.description || '').trim();
      const vchDesc = (voucher.description || '').trim();
      let fullDescription = baseDesc || vchDesc;
      if (
        baseDesc &&
        vchDesc &&
        !baseDesc.includes(vchDesc) &&
        !vchDesc.startsWith('سند اتوماتیک') &&
        !vchDesc.startsWith('سند فاکتور')
      ) {
        fullDescription = `${baseDesc} | توضیحات: ${vchDesc}`;
      }

      const resolvedTracking =
        (line.trackingNumber || '').trim() ||
        (siblingBankLineWithTrk?.trackingNumber || '').trim() ||
        (voucher.referenceNumber || '').trim() ||
        undefined;

      rows.push({
        lineId: line.id,
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
        date: voucher.date,
        accountCode: line.accountCode,
        accountName: line.accountName,
        description: fullDescription,
        currency: line.currency,
        exchangeRate: line.exchangeRate,
        debitForeign: lineDebitFor,
        creditForeign: lineCreditFor,
        runningBalanceForeign: Math.abs(rowRunningForeign),
        balanceStatusForeign:
          rowRunningForeign > 0 ? 'بدهکار' : rowRunningForeign < 0 ? 'بستانکار' : 'تسویه',
        debitIRR: line.debitIRR,
        creditIRR: line.creditIRR,
        runningBalanceIRR: Math.abs(runningIRR),
        balanceStatusIRR: runningIRR > 0 ? 'بدهکار' : runningIRR < 0 ? 'بستانکار' : 'تسویه',
        trackingNumber: resolvedTracking,
      });
    }
  }

  return {
    contactId,
    currencyFilter,
    rows,
    totalDebitForeign,
    totalCreditForeign,
    finalBalanceForeign: Math.abs(runningForeign),
    finalStatusForeign: runningForeign > 0 ? 'بدهکار' : runningForeign < 0 ? 'بستانکار' : 'تسویه',
    totalDebitIRR,
    totalCreditIRR,
    finalBalanceIRR: Math.abs(runningIRR),
    finalStatusIRR: runningIRR > 0 ? 'بدهکار' : runningIRR < 0 ? 'بستانکار' : 'تسویه',
    currencyBreakdown,
  };
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  level: string;
  category: string;
  turnoverDebitIRR: number;
  turnoverCreditIRR: number;
  balanceDebitIRR: number;
  balanceCreditIRR: number;
}

/**
 * Generates standard 4-column Trial Balance (تراز آزمایشی ۴ ستونی استاندارد حسابداری)
 */
export function buildTrialBalance(accounts: Account[], vouchers: JournalVoucher[]): TrialBalanceRow[] {
  const map = new Map<string, { debit: number; credit: number }>();

  for (const v of vouchers) {
    for (const line of v.lines) {
      const prev = map.get(line.accountCode) || { debit: 0, credit: 0 };
      prev.debit += line.debitIRR;
      prev.credit += line.creditIRR;
      map.set(line.accountCode, prev);
    }
  }

  const moeinAccounts = accounts.filter((a) => a.level === 'moein');
  const rows: TrialBalanceRow[] = [];

  for (const acc of moeinAccounts) {
    const totals = map.get(acc.code) || { debit: 0, credit: 0 };
    if (totals.debit === 0 && totals.credit === 0) continue;
    const net = totals.debit - totals.credit;
    rows.push({
      accountCode: acc.code,
      accountName: acc.name,
      level: acc.level,
      category: acc.category,
      turnoverDebitIRR: totals.debit,
      turnoverCreditIRR: totals.credit,
      balanceDebitIRR: net > 0 ? net : 0,
      balanceCreditIRR: net < 0 ? Math.abs(net) : 0,
    });
  }

  return rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

export interface BankReconciliationSummary {
  bankId: string;
  ledgerBalanceForeign: number;
  ledgerBalanceIRR: number;
  statementBalanceForeign: number;
  statementBalanceIRR: number;
  unmatchedLedgerLines: (VoucherLine & { voucherNumber: number; voucherDate: string })[];
  unmatchedStatementEntries: BankStatementEntry[];
  matchedPairsCount: number;
  adjustedLedgerBalanceForeign: number;
  adjustedStatementBalanceForeign: number;
  discrepancyForeign: number;
  isReconciled: boolean;
}

/**
 * Performs automatic & manual Bank Reconciliation (مغایرت‌گیری بانکی)
 * comparing ledger entries for a bank against uploaded/recorded bank statement rows.
 */
export function reconcileBankTransactions(
  bankId: string,
  initialBalanceForeign: number,
  initialBalanceIRR: number,
  vouchers: JournalVoucher[],
  statementEntries: BankStatementEntry[]
): BankReconciliationSummary {
  const bankLedgerLines: (VoucherLine & { voucherNumber: number; voucherDate: string })[] = [];
  let ledgerBalanceForeign = initialBalanceForeign;
  let ledgerBalanceIRR = initialBalanceIRR;

  for (const v of vouchers) {
    for (const line of v.lines) {
      if (line.bankId === bankId) {
        bankLedgerLines.push({
          ...line,
          voucherNumber: v.voucherNumber,
          voucherDate: v.date,
        });
        ledgerBalanceForeign = Number(
          (ledgerBalanceForeign + line.debitForeign - line.creditForeign).toFixed(2)
        );
        ledgerBalanceIRR += line.debitIRR - line.creditIRR;
      }
    }
  }

  const bankStatements = statementEntries.filter((s) => s.bankId === bankId);
  let statementBalanceForeign = initialBalanceForeign;
  let statementBalanceIRR = initialBalanceIRR;

  for (const st of bankStatements) {
    statementBalanceForeign = Number(
      (statementBalanceForeign + st.depositForeign - st.withdrawalForeign).toFixed(2)
    );
    statementBalanceIRR += st.depositIRR - st.withdrawalIRR;
  }

  const matchedStatementIds = new Set<string>();
  const matchedLedgerIds = new Set<string>();

  // Match explicitly linked or matching tracking number + exact amount
  for (const line of bankLedgerLines) {
    if (line.reconciled) {
      matchedLedgerIds.add(line.id);
    }
    for (const st of bankStatements) {
      if (matchedStatementIds.has(st.id)) continue;
      const sameTracking =
        line.trackingNumber &&
        st.trackingNumber &&
        line.trackingNumber.trim() === st.trackingNumber.trim();
      const sameAmount =
        Math.abs(line.debitForeign - st.depositForeign) < 0.01 &&
        Math.abs(line.creditForeign - st.withdrawalForeign) < 0.01;

      if (st.matchedVoucherLineId === line.id || (sameTracking && sameAmount)) {
        matchedLedgerIds.add(line.id);
        matchedStatementIds.add(st.id);
        break;
      }
    }
  }

  const unmatchedLedgerLines = bankLedgerLines.filter((l) => !matchedLedgerIds.has(l.id));
  const unmatchedStatementEntries = bankStatements.filter((s) => !matchedStatementIds.has(s.id));

  // Deposits in transit (در راه) = in ledger debit, not yet in bank statement
  const depositsInTransit = unmatchedLedgerLines.reduce((sum, l) => sum + l.debitForeign, 0);
  // Outstanding checks/withdrawals (چک‌های معوق) = in ledger credit, not yet in bank statement
  const outstandingWithdrawals = unmatchedLedgerLines.reduce((sum, l) => sum + l.creditForeign, 0);

  // Bank credits not recorded in books (واریزی ثبت نشده در دفاتر)
  const unrecordedDeposits = unmatchedStatementEntries.reduce((sum, s) => sum + s.depositForeign, 0);
  // Bank charges/withdrawals not recorded in books (کارمزد و برداشت ثبت نشده در دفاتر)
  const unrecordedWithdrawals = unmatchedStatementEntries.reduce((sum, s) => sum + s.withdrawalForeign, 0);

  const adjustedStatementBalanceForeign = Number(
    (statementBalanceForeign + depositsInTransit - outstandingWithdrawals).toFixed(2)
  );
  const adjustedLedgerBalanceForeign = Number(
    (ledgerBalanceForeign + unrecordedDeposits - unrecordedWithdrawals).toFixed(2)
  );

  const discrepancyForeign = Number(
    Math.abs(adjustedLedgerBalanceForeign - adjustedStatementBalanceForeign).toFixed(2)
  );

  return {
    bankId,
    ledgerBalanceForeign,
    ledgerBalanceIRR,
    statementBalanceForeign,
    statementBalanceIRR,
    unmatchedLedgerLines,
    unmatchedStatementEntries,
    matchedPairsCount: matchedLedgerIds.size,
    adjustedLedgerBalanceForeign,
    adjustedStatementBalanceForeign,
    discrepancyForeign,
    isReconciled: discrepancyForeign < 0.01,
  };
}

export interface CurrencyVaultPosition {
  currency: CurrencyCode;
  currencyName: string;
  symbol: string;
  currentMarketRate: number;
  totalBoughtForeign: number;
  totalBoughtIRR: number;
  weightedAvgBuyRate: number;
  totalSoldForeign: number;
  totalSoldIRR: number;
  weightedAvgSellRate: number;
  netVaultBalanceForeign: number;
  realizedProfitIRR: number;
  unrealizedValuationIRR: number;
}

/**
 * Calculates real-time Foreign Currency Vault Position (موجودی خزانه ارزی، میانگین نرخ خرید/فروش و سود/زیان معاملات ارز)
 */
export function calculateCurrencyVaultPositions(
  currencies: { code: CurrencyCode; name: string; symbol: string; defaultRateToIRR: number; isBase?: boolean }[],
  fxDeals: {
    type: 'buy' | 'sell';
    currency: CurrencyCode;
    foreignAmount: number;
    exchangeRate: number;
    totalIRR: number;
  }[]
): CurrencyVaultPosition[] {
  return currencies
    .filter((c) => !c.isBase)
    .map((curr) => {
      const deals = fxDeals.filter((d) => d.currency === curr.code);
      let totalBoughtForeign = 0;
      let totalBoughtIRR = 0;
      let totalSoldForeign = 0;
      let totalSoldIRR = 0;

      for (const d of deals) {
        if (d.type === 'buy') {
          totalBoughtForeign = Number((totalBoughtForeign + d.foreignAmount).toFixed(2));
          totalBoughtIRR += Math.round(d.totalIRR);
        } else {
          totalSoldForeign = Number((totalSoldForeign + d.foreignAmount).toFixed(2));
          totalSoldIRR += Math.round(d.totalIRR);
        }
      }

      const weightedAvgBuyRate =
        totalBoughtForeign > 0 ? Math.round(totalBoughtIRR / totalBoughtForeign) : curr.defaultRateToIRR;
      const weightedAvgSellRate =
        totalSoldForeign > 0 ? Math.round(totalSoldIRR / totalSoldForeign) : curr.defaultRateToIRR;

      const netVaultBalanceForeign = Number((totalBoughtForeign - totalSoldForeign).toFixed(2));
      const matchedSoldVolume = Math.min(totalBoughtForeign, totalSoldForeign);
      const realizedProfitIRR = Math.round(
        matchedSoldVolume * (weightedAvgSellRate - weightedAvgBuyRate)
      );
      const unrealizedValuationIRR = Math.round(
        Math.max(0, netVaultBalanceForeign) * curr.defaultRateToIRR
      );

      return {
        currency: curr.code,
        currencyName: curr.name,
        symbol: curr.symbol,
        currentMarketRate: curr.defaultRateToIRR,
        totalBoughtForeign,
        totalBoughtIRR,
        weightedAvgBuyRate,
        totalSoldForeign,
        totalSoldIRR,
        weightedAvgSellRate,
        netVaultBalanceForeign,
        realizedProfitIRR,
        unrealizedValuationIRR,
      };
    });
}

export interface StandardLedgerReportRow {
  rowNumber: number;
  lineId: string;
  voucherId: string;
  voucherNumber: number;
  date: string;
  accountCode: string;
  accountName: string;
  subLedgerName: string; // نام شخص یا بانک یا سرفصل
  description: string;
  trackingNumber: string;
  currency: CurrencyCode;
  exchangeRate: number;
  debitForeign: number;
  creditForeign: number;
  runningBalanceForeign: number;
  diagnosisForeign: 'بدهکار' | 'بستانکار' | 'تسویه';
  debitIRR: number;
  creditIRR: number;
  runningBalanceIRR: number;
  diagnosisIRR: 'بدهکار' | 'بستانکار' | 'تسویه';
}

export interface StandardLedgerReportResult {
  reportTitle: string;
  reportSubtitle: string;
  currencyMode: 'rial' | 'foreign';
  selectedCurrency: CurrencyCode;
  rows: StandardLedgerReportRow[];
  totalDebitForeign: number;
  totalCreditForeign: number;
  finalBalanceForeign: number;
  finalDiagnosisForeign: 'بدهکار' | 'بستانکار' | 'تسویه';
  totalDebitIRR: number;
  totalCreditIRR: number;
  finalBalanceIRR: number;
  finalDiagnosisIRR: 'بدهکار' | 'بستانکار' | 'تسویه';
}

/**
 * Builds a top-to-bottom chronological Standard Accounting Ledger (گردش حساب استاندارد از بالا به پایین)
 * with Debit (بدهکار), Credit (بستانکار), Diagnosis (تشخیص), and Running Balance (مانده از بالا به پایین)
 * for any Bank, Person (Contact), Expense Account, or Moein Account.
 */
export function buildStandardLedgerReport(params: {
  vouchers: JournalVoucher[];
  accounts: Account[];
  filterType: 'bank' | 'contact' | 'expense' | 'account';
  targetId: string; // bankId, contactId, accountCode, or 'ALL_EXPENSES'
  targetLabel: string;
  currencyMode: 'rial' | 'foreign';
  currencyFilter?: CurrencyCode | 'ALL';
}): StandardLedgerReportResult {
  const sortedVouchers = [...params.vouchers].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.voucherNumber - b.voucherNumber;
  });

  const expenseCodes = new Set(
    params.accounts
      .filter((a) => a.category === 'expense' || a.code.startsWith('5'))
      .map((a) => a.code)
  );

  const rows: StandardLedgerReportRow[] = [];
  let runningIRR = 0;
  let runningForeign = 0;
  let totalDebitIRR = 0;
  let totalCreditIRR = 0;
  let totalDebitForeign = 0;
  let totalCreditForeign = 0;
  let detectedCurrency: CurrencyCode =
    params.currencyFilter && params.currencyFilter !== 'ALL'
      ? params.currencyFilter
      : 'USD';

  for (const v of sortedVouchers) {
    const siblingBankLineWithTrk = v.lines.find(
      (l) => l.bankId && l.trackingNumber && l.trackingNumber.trim() !== ''
    );

    for (const line of v.lines) {
      let matches = false;
      if (params.filterType === 'bank') {
        matches = line.bankId === params.targetId;
      } else if (params.filterType === 'contact') {
        matches = line.contactId === params.targetId;
      } else if (params.filterType === 'expense') {
        if (params.targetId === 'ALL_EXPENSES') {
          matches = expenseCodes.has(line.accountCode);
        } else {
          matches = line.accountCode === params.targetId;
        }
      } else if (params.filterType === 'account') {
        matches = line.accountCode === params.targetId;
      }

      if (!matches) continue;

      if (
        params.currencyFilter &&
        params.currencyFilter !== 'ALL' &&
        line.currency !== params.currencyFilter
      ) {
        continue;
      }

      if (line.currency !== 'IRR') {
        detectedCurrency = line.currency;
      }

      const dIRR = Math.round(line.debitIRR || 0);
      const cIRR = Math.round(line.creditIRR || 0);
      const isForeignRow = line.currency !== 'IRR' || params.filterType === 'bank';
      const dFor = isForeignRow ? Number((line.debitForeign || 0).toFixed(2)) : 0;
      const cFor = isForeignRow ? Number((line.creditForeign || 0).toFixed(2)) : 0;

      runningIRR += dIRR - cIRR;
      runningForeign = Number((runningForeign + (dFor - cFor)).toFixed(2));

      totalDebitIRR += dIRR;
      totalCreditIRR += cIRR;
      totalDebitForeign = Number((totalDebitForeign + dFor).toFixed(2));
      totalCreditForeign = Number((totalCreditForeign + cFor).toFixed(2));

      const baseDesc = (line.description || '').trim();
      const vchDesc = (v.description || '').trim();
      let fullDescription = baseDesc || vchDesc;
      if (
        baseDesc &&
        vchDesc &&
        !baseDesc.includes(vchDesc) &&
        !vchDesc.startsWith('سند اتوماتیک') &&
        !vchDesc.startsWith('سند فاکتور')
      ) {
        fullDescription = `${baseDesc} | توضیحات: ${vchDesc}`;
      }

      const resolvedTrk =
        (line.trackingNumber || '').trim() ||
        (siblingBankLineWithTrk?.trackingNumber || '').trim() ||
        (v.referenceNumber || '').trim() ||
        '—';

      rows.push({
        rowNumber: rows.length + 1,
        lineId: line.id,
        voucherId: v.id,
        voucherNumber: v.voucherNumber,
        date: v.date,
        accountCode: line.accountCode,
        accountName: line.accountName,
        subLedgerName: line.contactName || line.bankName || line.accountName,
        description: fullDescription,
        trackingNumber: resolvedTrk,
        currency: line.currency,
        exchangeRate: line.exchangeRate,
        debitForeign: dFor,
        creditForeign: cFor,
        runningBalanceForeign: Math.abs(runningForeign),
        diagnosisForeign:
          runningForeign > 0 ? 'بدهکار' : runningForeign < 0 ? 'بستانکار' : 'تسویه',
        debitIRR: dIRR,
        creditIRR: cIRR,
        runningBalanceIRR: Math.abs(runningIRR),
        diagnosisIRR:
          runningIRR > 0 ? 'بدهکار' : runningIRR < 0 ? 'بستانکار' : 'تسویه',
      });
    }
  }

  return {
    reportTitle: params.targetLabel,
    reportSubtitle:
      params.currencyMode === 'rial'
        ? 'گزارش استاندارد حسابداری (بدهکار، بستانکار و مانده در گردش از بالا به پایین — ریالی)'
        : 'گزارش استاندارد حسابداری (بدهکار، بستانکار و مانده در گردش از بالا به پایین — ارزی با دو رقم اعشار)',
    currencyMode: params.currencyMode,
    selectedCurrency: detectedCurrency,
    rows,
    totalDebitForeign,
    totalCreditForeign,
    finalBalanceForeign: Math.abs(runningForeign),
    finalDiagnosisForeign:
      runningForeign > 0 ? 'بدهکار' : runningForeign < 0 ? 'بستانکار' : 'تسویه',
    totalDebitIRR,
    totalCreditIRR,
    finalBalanceIRR: Math.abs(runningIRR),
    finalDiagnosisIRR:
      runningIRR > 0 ? 'بدهکار' : runningIRR < 0 ? 'بستانکار' : 'تسویه',
  };
}

/**
 * Formats numbers cleanly with 3-digit comma separators (سه رقم سه رقم).
 */
export function formatNumber(num: number, decimals = 0): string {
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats any amount based on its currency:
 * - If IRR (ریال): 3-digit comma separated with 0 decimals (e.g., 685,000,000)
 * - If Foreign Currency (USD, EUR, CNY, AED): 3-digit comma separated with explicit 2 decimals (e.g., 12,500.50)
 */
export function formatCurrencyAmount(num: number, currency: CurrencyCode): string {
  if (!Number.isFinite(num)) return currency === 'IRR' ? '0' : '0.00';
  const isRial = currency === 'IRR';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: isRial ? 0 : 2,
    maximumFractionDigits: isRial ? 0 : 2,
  });
}

/**
 * Formats a raw string or number input with 3-digit commas while preserving user typing of decimals for foreign currencies.
 */
export function formatLiveNumericInput(raw: string | number, allowDecimals: boolean): string {
  if (raw === '' || raw === null || raw === undefined) return '';
  const str = String(raw).replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!str) return '';
  const parts = str.split('.');
  const intPart = parts[0] ? Number(parts[0]).toLocaleString('en-US') : '0';
  if (allowDecimals && parts.length > 1) {
    return `${intPart}.${parts[1].slice(0, 2)}`;
  }
  return intPart;
}

/**
 * Parses a comma-separated string back into a clean JavaScript number.
 */
export function parseFormattedNumber(formatted: string): number {
  if (!formatted) return 0;
  const cleaned = formatted.replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Returns today's real Solar Hijri (Jalali) date in YYYY/MM/DD format with Latin digits (e.g. "1405/08/17").
 */
export function getTodayJalaliDate(): string {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value || '1404';
    const m = (parts.find((p) => p.type === 'month')?.value || '01').padStart(2, '0');
    const d = (parts.find((p) => p.type === 'day')?.value || '01').padStart(2, '0');
    return `${y}/${m}/${d}`;
  } catch {
    return '1404/01/01';
  }
}

/**
 * Returns the current Solar Hijri (Jalali) year as a 4-digit string (e.g. "1405").
 */
export function getCurrentJalaliYear(): string {
  return getTodayJalaliDate().split('/')[0] || '1404';
}

