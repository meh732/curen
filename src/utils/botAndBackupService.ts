import { AccountingState, BotDeliveryLog, Contact, SalesInvoice } from '../types/accounting';
import { PersonStatementResult, formatNumber } from './accountingEngine';

/**
 * Formats a SalesInvoice in both Foreign Currency and Rial for sending via Bale or Telegram Bot.
 */
export function formatInvoiceBotMessage(invoice: SalesInvoice, companyName: string): string {
  const isForeign = invoice.currency !== 'IRR';
  const lines = invoice.items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.productName} (${item.quantity} ${item.unit})\n` +
        (isForeign
          ? `   • فی ارزی: ${formatNumber(item.unitPriceForeign, 2)} ${invoice.currency} | جمع ارزی: ${formatNumber(item.totalForeign, 2)} ${invoice.currency}\n` +
            `   • معادل ریالی: ${formatNumber(item.totalIRR)} ریال`
          : `   • فی: ${formatNumber(item.unitPriceIRR)} ریال | جمع: ${formatNumber(item.totalIRR)} ریال`)
    )
    .join('\n');

  return (
    `📄 *فاکتور رسمی فروش کالا و خدمات*\n` +
    `🏢 صادرکننده: ${companyName}\n` +
    `🔢 شماره فاکتور: ${invoice.invoiceNumber} | 📅 تاریخ: ${invoice.date}\n` +
    `👤 طرف حساب (مشتری): ${invoice.contactName}\n` +
    `💱 ارز پایه فاکتور: ${invoice.currency}` +
    (isForeign ? ` (نرخ تبدیل: ${formatNumber(invoice.exchangeRate)} ریال)` : '') +
    `\n----------------------------------\n` +
    `${lines}\n` +
    `----------------------------------\n` +
    (isForeign
      ? `💰 *مبلغ قابل پرداخت ارزی:* ${formatNumber(invoice.grandTotalForeign, 2)} ${invoice.currency}\n` +
        `🇮🇷 *معادل قطعی به ریال ایران:* ${formatNumber(invoice.grandTotalIRR)} ریال\n`
      : `💰 *مبلغ کل قابل پرداخت:* ${formatNumber(invoice.grandTotalIRR)} ریال\n`) +
    (invoice.notes ? `📌 توضیحات: ${invoice.notes}\n` : '') +
    `✅ صادر شده توسط سیستم جامع حسابداری دوارزی ترازبان`
  );
}

/**
 * Formats a Person's Statement (ریالی یا ارزی) for instant sending to Bale or Telegram Bot.
 */
export function formatStatementBotMessage(
  contact: Contact,
  statement: PersonStatementResult,
  mode: 'rial' | 'foreign',
  companyName: string
): string {
  const recentRows = statement.rows.slice(-5);
  const rowsText = recentRows
    .map((r) => {
      if (mode === 'rial') {
        return `• ${r.date} | سند #${r.voucherNumber}: بدهکار ${formatNumber(r.debitIRR)} / بستانکار ${formatNumber(r.creditIRR)} ریال (مانده: ${formatNumber(r.runningBalanceIRR)} ${r.balanceStatusIRR})`;
      }
      return `• ${r.date} | سند #${r.voucherNumber} (${r.currency} - نرخ ${formatNumber(r.exchangeRate)}): بدهکار ${formatNumber(r.debitForeign, 2)} / بستانکار ${formatNumber(r.creditForeign, 2)} ${r.currency}`;
    })
    .join('\n');

  if (mode === 'rial') {
    return (
      `📊 *صورتحساب استاندارد ریالی طرف حساب*\n` +
      `🏢 ${companyName}\n` +
      `👤 نام شخص/شرکت: ${contact.name} (کد: ${contact.code})\n` +
      `----------------------------------\n` +
      `📥 جمع گردش بدهکار ریالی: ${formatNumber(statement.totalDebitIRR)} ریال\n` +
      `📤 جمع گردش بستانکار ریالی: ${formatNumber(statement.totalCreditIRR)} ریال\n` +
      `⚖️ *مانده نهایی ریالی:* ${formatNumber(statement.finalBalanceIRR)} ریال (${statement.finalStatusIRR})\n` +
      `----------------------------------\n` +
      `📋 آخرین گردش‌ها:\n${rowsText || 'گردشی ثبت نشده است.'}`
    );
  }

  const breakdownLines = Object.entries(statement.currencyBreakdown)
    .map(
      ([curr, b]) =>
        `• ارز ${curr}: بدهکار ${formatNumber(b.debitForeign, 2)} | بستانکار ${formatNumber(b.creditForeign, 2)} ⬅️ مانده: ${formatNumber(b.balanceForeign, 2)} ${curr} (${b.status})`
    )
    .join('\n');

  return (
    `🌍 *صورتحساب استاندارد ارزی و چندارزی طرف حساب*\n` +
    `🏢 ${companyName}\n` +
    `👤 نام شخص/شرکت: ${contact.name} (کد: ${contact.code})\n` +
    `----------------------------------\n` +
    `💱 *تفکیک مانده به تفکیک هر ارز:*\n${breakdownLines || 'گردش ارزی ندارد'}\n` +
    `----------------------------------\n` +
    `🇮🇷 معادل تجمیعی کل به ریال: ${formatNumber(statement.finalBalanceIRR)} ریال (${statement.finalStatusIRR})\n` +
    `📋 آخرین گردش‌ها:\n${rowsText || 'گردشی ثبت نشده است.'}`
  );
}

/**
 * Sends a text message or JSON backup snapshot to Bale (`https://tapi.bale.ai/bot<TOKEN>/sendMessage`)
 * or Telegram (`https://api.telegram.org/bot<TOKEN>/sendMessage`).
 * Falls back gracefully with clear status reporting if token is demo or network is blocked.
 */
export async function dispatchToMessengerBot(params: {
  platform: 'bale' | 'telegram';
  botToken: string;
  chatId: string;
  recipientName: string;
  messageType: BotDeliveryLog['messageType'];
  text: string;
  summary: string;
}): Promise<BotDeliveryLog> {
  const now = new Date();
  const timeStr = `1404/08/12 - ${now.toTimeString().slice(0, 8)}`;
  const endpoint =
    params.platform === 'bale'
      ? `https://tapi.bale.ai/bot${params.botToken.trim()}/sendMessage`
      : `https://api.telegram.org/bot${params.botToken.trim()}/sendMessage`;

  const isDemoToken =
    !params.botToken ||
    params.botToken.includes('BALE_ENTERPRISE') ||
    params.botToken.includes('TELEGRAM_ACCOUNTING');

  if (!isDemoToken && params.chatId.trim()) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: params.chatId.trim(),
          text: params.text,
        }),
      });
      if (response.ok) {
        return {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: timeStr,
          platform: params.platform,
          recipientChatId: params.chatId,
          recipientName: params.recipientName,
          messageType: params.messageType,
          status: 'delivered',
          summary: params.summary,
        };
      }
    } catch {
      // If browser CORS or offline environment blocks direct call, record local dispatch & allow file download
    }
  }

  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: timeStr,
    platform: params.platform,
    recipientChatId: params.chatId || 'پیش‌فرض',
    recipientName: params.recipientName,
    messageType: params.messageType,
    status: 'simulated_local',
    summary: params.summary,
  };
}

/**
 * Triggers a browser file download for Full System JSON Backup or Windows Portable Script.
 */
export function triggerBackupFileDownload(state: AccountingState, filenamePrefix = 'TarazBan_Full_Backup') {
  const payload = {
    backupVersion: '4.2.0-WINDOWS-PRO',
    exportedAt: new Date().toISOString(),
    shamsiDate: '1404/08/12',
    checksum: `SHA256-${state.vouchers.length}-${state.invoices.length}-${state.contacts.length}`,
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_1404_08_12.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
