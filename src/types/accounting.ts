export type CurrencyCode = 'IRR' | 'USD' | 'EUR' | 'CNY' | 'AED' | string;

export interface Currency {
  code: CurrencyCode;
  name: string;
  symbol: string;
  defaultRateToIRR: number; // 1 unit of currency = X Rials
  isBase?: boolean;
  updatedAt: string;
}

export type AccountLevel = 'group' | 'kol' | 'moein';
export type AccountNature = 'debit' | 'credit' | 'both';

export interface Account {
  code: string;
  name: string;
  level: AccountLevel;
  parentCode?: string;
  nature: AccountNature;
  category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  isSystem?: boolean;
}

export type ContactType = 'customer' | 'supplier' | 'both' | 'partner';

export interface Contact {
  id: string;
  code: string;
  name: string;
  type: ContactType;
  phone: string;
  nationalId?: string;
  address?: string;
  baleChatId?: string;
  telegramChatId?: string;
  defaultCurrency: CurrencyCode;
  creditLimitIRR?: number;
}

export interface BankAccount {
  id: string;
  code: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  shebaOrIban: string;
  currency: CurrencyCode;
  moeinCode: string; // Typically '1102' or '1103'
  initialBalanceForeign: number;
  initialBalanceIRR: number;
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stockQty: number;
  minStockAlert: number;
  warehouseLocation: string;
  defaultPriceIRR: number;
  defaultPriceForeign: number;
  defaultCurrency: CurrencyCode;
}

export interface InventoryMovement {
  id: string;
  date: string;
  productId: string;
  productSku: string;
  productName: string;
  type: 'inbound' | 'outbound';
  quantity: number;
  unitPriceForeign: number;
  currency: CurrencyCode;
  exchangeRate: number;
  unitPriceIRR: number;
  referenceDoc: string; // Invoice No or Voucher No
  projectCode?: string;
  warehouseName: string;
  notes?: string;
}

export interface VoucherLine {
  id: string;
  accountCode: string;
  accountName: string;
  contactId?: string;
  contactName?: string;
  bankId?: string;
  bankName?: string;
  description: string;
  currency: CurrencyCode;
  exchangeRate: number; // 1 unit = X IRR (1 for IRR)
  debitForeign: number;
  creditForeign: number;
  debitIRR: number;
  creditIRR: number;
  trackingNumber?: string;
  reconciled?: boolean; // For bank reconciliation
}

export interface JournalVoucher {
  id: string;
  voucherNumber: number;
  date: string; // Shamsi YYYY/MM/DD
  description: string;
  referenceNumber?: string;
  status: 'draft' | 'temporary' | 'permanent';
  lines: VoucherLine[];
  createdAt: string;
  invoiceId?: string;
}

export interface BankStatementEntry {
  id: string;
  bankId: string;
  date: string;
  trackingNumber: string;
  description: string;
  currency: CurrencyCode;
  depositForeign: number; // واریز به بانک (بستانکار در صورتحساب بانک)
  withdrawalForeign: number; // برداشت از بانک (بدهکار در صورتحساب بانک)
  depositIRR: number;
  withdrawalIRR: number;
  matchedVoucherLineId?: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPriceForeign: number;
  unitPriceIRR: number;
  discountForeign: number;
  discountIRR: number;
  taxPercent: number;
  totalForeign: number;
  totalIRR: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  type: 'sales' | 'purchase';
  date: string;
  dueDate: string;
  contactId: string;
  contactName: string;
  currency: CurrencyCode;
  exchangeRate: number;
  convertToIRRInPrint: boolean;
  warehouseName: string;
  projectCode?: string;
  items: InvoiceItem[];
  subtotalForeign: number;
  subtotalIRR: number;
  totalDiscountForeign: number;
  totalDiscountIRR: number;
  totalTaxForeign: number;
  totalTaxIRR: number;
  grandTotalForeign: number;
  grandTotalIRR: number;
  status: 'issued' | 'paid' | 'partial';
  linkedVoucherId?: string;
  notes?: string;
}

export interface BotConfig {
  baleEnabled: boolean;
  baleBotToken: string;
  baleDefaultChatId: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramDefaultChatId: string;
  autoBackupIntervalHours: number;
  autoBackupOnVoucherSave: boolean;
  lastBackupTime?: string;
}

export interface BotDeliveryLog {
  id: string;
  timestamp: string;
  platform: 'bale' | 'telegram';
  recipientChatId: string;
  recipientName: string;
  messageType: 'backup' | 'invoice' | 'statement_rial' | 'statement_foreign';
  status: 'delivered' | 'simulated_local' | 'failed';
  summary: string;
  errorDetail?: string;
}

export interface FXDeal {
  id: string;
  dealNumber: string;
  type: 'buy' | 'sell'; // خرید ارز (ورود به خزانه) | فروش ارز (خروج از خزانه)
  date: string;
  contactId: string;
  contactName: string;
  currency: CurrencyCode; // USD, EUR, CNY, AED
  foreignAmount: number; // مقدار ارز معامله شده
  exchangeRate: number; // نرخ معامله به ریال
  totalIRR: number; // مبلغ کل ریالی معامله
  commissionIRR: number; // کارمزد انتقال / صرافی به ریال
  settlementMethod: 'credit_account' | 'bank_transfer' | 'cash_box';
  targetForeignBankId?: string; // خزانه ارزی مقصد/مبدأ
  targetRialBankId?: string; // بانک ریالی مقصد/مبدأ
  trackingNumber: string; // شماره حواله / سوئیفت / پیگیری
  linkedVoucherId?: string;
  notes?: string;
}

export interface AccountingState {
  companyName: string;
  fiscalYear: string;
  currencies: Currency[];
  accounts: Account[];
  contacts: Contact[];
  banks: BankAccount[];
  products: ProductItem[];
  inventoryMovements: InventoryMovement[];
  vouchers: JournalVoucher[];
  bankStatementEntries: BankStatementEntry[];
  invoices: SalesInvoice[];
  fxDeals: FXDeal[];
  botConfig: BotConfig;
  botLogs: BotDeliveryLog[];
}
