import {
  StandardLedgerReportResult,
  formatCurrencyAmount,
  formatNumber,
} from './accountingEngine';
import { FXDeal, SalesInvoice } from '../types/accounting';

/**
 * Generates a print-ready and PDF-ready A4 Official Accounting Ledger Report
 * with top-to-bottom Debit (بدهکار), Credit (بستانکار), Diagnosis (تشخیص), Running Balance (مانده),
 * Receipt Tracking Number (شماره پیگیری فیش), and full line-by-line Description (توضیحات کامل خط به خط).
 */
export function exportOrPrintStandardLedgerPDF(
  report: StandardLedgerReportResult,
  companyName: string,
  fiscalYear: string,
  mode: 'print' | 'download_pdf_html'
) {
  const isRial = report.currencyMode === 'rial';

  const rowsHtml = report.rows
    .map((r) => {
      if (isRial) {
        const fxBalText =
          r.currency !== 'IRR'
            ? `${formatCurrencyAmount(r.runningBalanceForeign, r.currency)} ${r.currency} (${r.diagnosisForeign})`
            : '—';
        return `
          <tr>
            <td class="center mono">${r.rowNumber}</td>
            <td class="center mono">${r.date}</td>
            <td class="center mono">#${r.voucherNumber}</td>
            <td class="center mono bold" style="color:#0f766e;">${r.trackingNumber || '—'}</td>
            <td>${r.accountCode} - ${r.accountName}</td>
            <td style="line-height:1.65;">${r.description}</td>
            <td class="center mono">${
              r.currency === 'IRR'
                ? 'ریال (IRR)'
                : `${r.currency} (نرخ: ${formatNumber(r.exchangeRate)})`
            }</td>
            <td class="left mono bold">${formatNumber(r.debitIRR)}</td>
            <td class="left mono bold">${formatNumber(r.creditIRR)}</td>
            <td class="center bold ${
              r.diagnosisIRR === 'بدهکار'
                ? 'deb'
                : r.diagnosisIRR === 'بستانکار'
                ? 'cred'
                : ''
            }">${r.diagnosisIRR}</td>
            <td class="left mono bold balance-col">${formatNumber(
              r.runningBalanceIRR
            )}</td>
            <td class="left mono bold" style="background:#f0fdfa; color:#0f766e;">${fxBalText}</td>
          </tr>
        `;
      } else {
        return `
          <tr>
            <td class="center mono">${r.rowNumber}</td>
            <td class="center mono">${r.date}</td>
            <td class="center mono">#${r.voucherNumber}</td>
            <td class="center mono bold" style="color:#0f766e;">${r.trackingNumber || '—'}</td>
            <td style="line-height:1.65;">${r.description}</td>
            <td class="center mono bold">${r.currency}</td>
            <td class="left mono">${formatNumber(r.exchangeRate)}</td>
            <td class="left mono bold">${formatCurrencyAmount(
              r.debitForeign,
              r.currency
            )}</td>
            <td class="left mono bold">${formatCurrencyAmount(
              r.creditForeign,
              r.currency
            )}</td>
            <td class="center bold">${r.diagnosisForeign}</td>
            <td class="left mono bold balance-col">${formatCurrencyAmount(
              r.runningBalanceForeign,
              r.currency
            )} ${r.currency}</td>
            <td class="left mono">${formatNumber(r.runningBalanceIRR)}</td>
          </tr>
        `;
      }
    })
    .join('');

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${report.reportTitle} - ${companyName} | آرکا (ARKA)</title>

  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 18px; background: #fff; color: #0f172a; direction: rtl; font-size: 11.5px; }
    .header-box { border: 2px solid #1e293b; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
    .header-title h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #1d4ed8; }
    .header-title p { margin: 0; font-size: 11px; color: #475569; }
    .header-meta { text-align: left; font-size: 11px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #94a3b8; padding: 7px 8px; font-size: 11px; vertical-align: middle; }
    th { background: #1e293b; color: #ffffff; font-weight: 700; text-align: right; }
    tr:nth-child(even) td { background: #f8fafc; }
    .center { text-align: center; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    .balance-col { background: #eff6ff !important; color: #1e3a8a; }
    .deb { color: #b45309; }
    .cred { color: #047857; }
    tfoot td { background: #e2e8f0 !important; font-weight: 800; font-size: 11.5px; border-top: 2px solid #0f172a; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 24px; text-align: center; font-size: 12px; font-weight: 700; }
    .sig-box { border: 1px dashed #94a3b8; padding: 25px 10px 45px; border-radius: 6px; }
    .toolbar { margin-bottom: 16px; padding: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: #1d4ed8; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <div><strong>پیش‌نمایش رسمی چاپ و خروجی PDF کامل صورتحساب آرکا (ARKA) — همراه با مانده ارزی، شماره پیگیری فیش و شرح خط‌به‌خط:</strong> برای ذخیره به صورت فایل PDF، در پنجره چاپ گزینه <strong>Save as PDF</strong> را انتخاب کنید.</div>
    <button class="btn" onclick="window.print()">چاپ / ذخیره فایل PDF (Ctrl+P)</button>
  </div>

  <div class="header-box">
    <div class="header-title">
      <h1>${companyName} (${fiscalYear}) — سیستم جامع صرافی و حسابداری آرکا (ARKA)</h1>
      <h2>${report.reportTitle}</h2>
      <p>${report.reportSubtitle} — همراه با مانده ریالی و ارزی، شماره پیگیری فیش‌ها و توضیحات کامل خط به خط</p>
    </div>
    <div class="header-meta mono">
      <div><strong>تاریخ گزارش:</strong> 1404/08/12</div>
      <div><strong>تعداد کل ردیف‌ها:</strong> ${report.rows.length} ردیف</div>
      <div><strong>مانده نهایی ریالی:</strong> ${formatNumber(report.finalBalanceIRR)} ریال (${report.finalDiagnosisIRR})</div>
      <div><strong>مانده نهایی ارزی:</strong> ${formatCurrencyAmount(
        report.finalBalanceForeign,
        report.selectedCurrency
      )} ${report.selectedCurrency} (${report.finalDiagnosisForeign})</div>
    </div>
  </div>

  <table>
    <thead>
      ${
        isRial
          ? `<tr>
              <th class="center" style="width:36px">ردیف</th>
              <th class="center" style="width:72px">تاریخ</th>
              <th class="center" style="width:52px">سند</th>
              <th class="center" style="width:105px">شماره فیش / رهگیری</th>
              <th style="width:130px">سرفصل حساب</th>
              <th>شرح و توضیحات کامل خط به خط</th>
              <th class="center" style="width:105px">ارز و نرخ</th>
              <th class="center" style="width:110px">بدهکار (ریال)</th>
              <th class="center" style="width:110px">بستانکار (ریال)</th>
              <th class="center" style="width:60px">تشخیص</th>
              <th class="center" style="width:120px">مانده لحظه‌ای (ریال)</th>
              <th class="center" style="width:120px">مانده لحظه‌ای ارزی</th>
            </tr>`
          : `<tr>
              <th class="center" style="width:38px">ردیف</th>
              <th class="center" style="width:76px">تاریخ</th>
              <th class="center" style="width:55px">سند</th>
              <th class="center" style="width:110px">شماره فیش / رهگیری</th>
              <th>شرح و توضیحات کامل عملیات ارزی (خط به خط)</th>
              <th class="center" style="width:55px">ارز</th>
              <th class="center" style="width:95px">نرخ تبدیل</th>
              <th class="center" style="width:110px">بدهکار ارزی</th>
              <th class="center" style="width:110px">بستانکار ارزی</th>
              <th class="center" style="width:65px">تشخیص</th>
              <th class="center" style="width:125px">مانده لحظه‌ای ارزی</th>
              <th class="center" style="width:120px">معادل مانده (ریال)</th>
            </tr>`
      }
    </thead>
    <tbody>
      ${
        rowsHtml ||
        `<tr><td colspan="12" class="center">هیچ تراکنشی در این حساب ثبت نشده است.</td></tr>`
      }
    </tbody>
    <tfoot>
      ${
        isRial
          ? `<tr>
              <td colspan="7" style="text-align:left">جمع کل گردش و مانده نهایی (ریالی و ارزی):</td>
              <td class="left mono">${formatNumber(report.totalDebitIRR)}</td>
              <td class="left mono">${formatNumber(report.totalCreditIRR)}</td>
              <td class="center">${report.finalDiagnosisIRR}</td>
              <td class="left mono">${formatNumber(report.finalBalanceIRR)} ریال</td>
              <td class="left mono" style="color:#0f766e;">${formatCurrencyAmount(
                report.finalBalanceForeign,
                report.selectedCurrency
              )} ${report.selectedCurrency} (${report.finalDiagnosisForeign})</td>
            </tr>`
          : `<tr>
              <td colspan="7" style="text-align:left">جمع کل گردش ارزی و مانده نهایی:</td>
              <td class="left mono">${formatCurrencyAmount(
                report.totalDebitForeign,
                report.selectedCurrency
              )}</td>
              <td class="left mono">${formatCurrencyAmount(
                report.totalCreditForeign,
                report.selectedCurrency
              )}</td>
              <td class="center">${report.finalDiagnosisForeign}</td>
              <td class="left mono">${formatCurrencyAmount(
                report.finalBalanceForeign,
                report.selectedCurrency
              )} ${report.selectedCurrency}</td>
              <td class="left mono">${formatNumber(report.finalBalanceIRR)} ریال</td>
            </tr>`
      }
    </tfoot>
  </table>

  <div class="signatures">
    <div class="sig-box">مهر و امضای تنظیم‌کننده / حسابدار ارزی</div>
    <div class="sig-box">مهر و امضای مدیر صرافی</div>
    <div class="sig-box">مهر و امضای طرف حساب / مشتری</div>
  </div>
</body>
</html>`;

  triggerHtmlPrintOrDownload(htmlDocument, `Report_${report.reportTitle.replace(/\s+/g, '_').slice(0, 40)}_${report.currencyMode}_1404.html`, mode);
}

/**
 * Generates an A4 Official Currency Delivery Statement (صورتحساب تحویل مرحله‌ای ارز مشتری — تحویل شده و مانده تحویل‌نشده)
 * with complete line-by-line delivery stages, tracking numbers, and notes.
 */
export function exportOrPrintCurrencyDeliveryStatementPDF(params: {
  contactName: string;
  deals: FXDeal[];
  companyName: string;
  fiscalYear: string;
  mode: 'print' | 'download_pdf_html';
}) {
  const { contactName, deals, companyName, fiscalYear, mode } = params;

  const dealSectionsHtml = deals
    .map((d, idx) => {
      const delivered = d.deliveredForeignAmount ?? d.foreignAmount;
      const remaining = d.remainingForeignDelivery ?? Math.max(0, Number((d.foreignAmount - delivered).toFixed(2)));
      const splits = d.deliverySplits || [];

      const splitsRows =
        splits.length > 0
          ? splits
              .map(
                (sp, sIdx) => `
              <tr>
                <td class="center mono">${sIdx + 1}</td>
                <td class="center mono">${sp.date}</td>
                <td class="center mono bold" style="color:#0f766e;">${sp.trackingNumber || '—'}</td>
                <td>${sp.vaultBankName || 'خزانه ارزی'}</td>
                <td class="left mono bold" style="color:#047857;">${formatCurrencyAmount(sp.amountForeign, d.currency)} ${d.currency}</td>
                <td>${sp.notes || 'تحویل مرحله‌ای ارز'}</td>
              </tr>`
              )
              .join('')
          : `<tr><td colspan="6" class="center">هیچ مرحله تحویلی ثبت نشده است (تحویل در انتظار یا یکجا: ${formatCurrencyAmount(delivered, d.currency)} ${d.currency})</td></tr>`;

      return `
        <div class="deal-card">
          <div class="deal-head">
            <div>
              <strong>${idx + 1}. شماره معامله: ${d.dealNumber}</strong> |
              <span>نوع: <strong>${d.type === 'buy' ? 'خرید ارز از مشتری (دریافت ارز)' : 'فروش ارز به مشتری (تحویل ارز به مشتری)'}</strong></span> |
              <span>تاریخ معامله: <span class="mono">${d.date}</span></span> |
              <span>طرف حساب: <strong>${d.contactName}</strong></span>
            </div>
            <div class="mono">
              کل ارز معامله: <strong>${formatCurrencyAmount(d.foreignAmount, d.currency)} ${d.currency}</strong> (نرخ: ${formatNumber(d.exchangeRate)} ریال)
            </div>
          </div>
          ${d.notes ? `<div class="deal-note"><strong>توضیحات کلی معامله:</strong> ${d.notes}</div>` : ''}
          <table>
            <thead>
              <tr>
                <th class="center" style="width:45px">مرحله</th>
                <th class="center" style="width:85px">تاریخ تحویل</th>
                <th class="center" style="width:130px">شماره پیگیری / فیش</th>
                <th style="width:170px">صندوق / حساب ارزی</th>
                <th class="center" style="width:140px">مقدار ارز تحویل‌شده</th>
                <th>شرح و توضیحات خط‌به‌خط مرحله تحویل</th>
              </tr>
            </thead>
            <tbody>
              ${splitsRows}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">خلاصه وضعیت تحویل ارز معامله ${d.dealNumber}:</td>
                <td class="left mono" style="color:#047857;">تحویل‌شده: ${formatCurrencyAmount(delivered, d.currency)} ${d.currency}</td>
                <td style="color:${remaining > 0 ? '#b91c1c' : '#047857'};">
                  ${
                    remaining > 0
                      ? `⚠️ مانده ارز تحویل‌نشده (طلب/تعهد تحویل): ${formatCurrencyAmount(remaining, d.currency)} ${d.currency}`
                      : '✓ کل ارز این معامله به صورت کامل تحویل شده است (مانده تحویل‌نشده: ۰)'
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    })
    .join('');

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>صورتحساب تحویل مرحله‌ای ارز - ${contactName}</title>

  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 18px; background: #fff; color: #0f172a; direction: rtl; font-size: 11.5px; }
    .header-box { border: 2px solid #0f766e; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; }
    .header-title h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0f766e; }
    .header-title p { margin: 0; font-size: 11px; color: #475569; }
    .deal-card { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; page-break-inside: avoid; }
    .deal-head { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 8px; font-size: 12px; }
    .deal-note { background: #fffbeb; border: 1px solid #fde68a; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; font-size: 11px; color: #92400e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; font-size: 11px; }
    th { background: #1e293b; color: #ffffff; font-weight: 700; text-align: right; }
    tfoot td { background: #f1f5f9; font-weight: 800; border-top: 2px solid #0f172a; }
    .center { text-align: center; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    .toolbar { margin-bottom: 16px; padding: 10px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: #0f766e; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 24px; text-align: center; font-size: 12px; font-weight: 700; }
    .sig-box { border: 1px dashed #94a3b8; padding: 25px 10px 45px; border-radius: 6px; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <div><strong>پیش‌نمایش رسمی صورتحساب تحویل مرحله‌ای ارز (تحویل گرفته شده و مانده تحویل‌نشده):</strong></div>
    <button class="btn" onclick="window.print()">چاپ / ذخیره PDF صورتحساب تحویل ارز</button>
  </div>

  <div class="header-box">
    <div class="header-title">
      <h1>${companyName} (${fiscalYear})</h1>
      <h2>صورتحساب اختصاصی تحویل مرحله‌ای ارز (تحویل شده و تحویل نشده) — ${contactName}</h2>
      <p>گزارش خط‌به‌خط مراحل تحویل فیزیکی/حواله‌ای ارز به همراه شماره پیگیری فیش‌ها و مانده تعهد تحویل</p>
    </div>
    <div class="mono" style="text-align:left; font-size:11px; line-height:1.7;">
      <div><strong>تاریخ گزارش:</strong> 1404/08/12</div>
      <div><strong>تعداد معاملات ارزی:</strong> ${deals.length} معامله</div>
    </div>
  </div>

  ${dealSectionsHtml || `<p class="center">هیچ معامله ارزی برای این مشتری ثبت نشده است.</p>`}

  <div class="signatures">
    <div class="sig-box">مهر و امضای تحویل‌دهنده / خزانه‌دار ارزی</div>
    <div class="sig-box">مهر و امضای مدیر صرافی</div>
    <div class="sig-box">مهر و امضای مشتری / تحویل‌گیرنده</div>
  </div>
</body>
</html>`;

  triggerHtmlPrintOrDownload(
    htmlDocument,
    `FX_Delivery_Statement_${contactName.replace(/\s+/g, '_').slice(0, 30)}_1404.html`,
    mode
  );
}
 
/**
 * Official A4 Printable Invoice (فاکتور رسمی خرید یا فروش ارز و کالا)
 */
export function exportOrPrintOfficialInvoicePDF(
  invoice: SalesInvoice,
  companyName: string,
  mode: 'print' | 'download_pdf_html' = 'print'
) {
  const isSales = invoice.type !== 'purchase';
  const rowsHtml = (invoice.items || [])
    .map(
      (item, idx) => `
    <tr>
      <td class="center mono">${idx + 1}</td>
      <td class="bold">${item.productName || item.productSku || 'معامله ارزی'}</td>
      <td class="center mono bold">${formatNumber(item.quantity)} ${invoice.currency}</td>
      <td class="left mono">${formatNumber(item.unitPriceIRR)} ریال</td>
      <td class="left mono bold" style="background:#f8fafc;">${formatNumber(item.totalIRR)} ریال</td>
    </tr>
  `
    )
    .join('');

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>فاکتور ${isSales ? 'فروش' : 'خرید'} - شماره ${invoice.invoiceNumber}</title>

  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 20px; background: #fff; color: #0f172a; direction: rtl; font-size: 12px; line-height: 1.6; }
    .header-box { border: 2px solid #0f766e; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; }
    .header-title h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0; font-size: 13px; font-weight: 700; color: #0f766e; }
    .meta-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #fff; font-size: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #94a3b8; padding: 8px 10px; font-size: 12px; }
    th { background: #1e293b; color: #fff; font-weight: 700; text-align: right; }
    tfoot td { background: #f1f5f9; font-weight: 800; }
    .center { text-align: center; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 40px; text-align: center; font-size: 12px; font-weight: 700; }
    .sig-box { border: 1px dashed #94a3b8; padding: 20px 10px 50px; border-radius: 6px; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">
      <h1>${companyName || 'صرافی و امور ارزی آرکا'}</h1>
      <h2>صورتحساب و فاکتور رسمی معامله ارزی (${isSales ? 'فاکتور فروش' : 'فاکتور خرید'})</h2>
    </div>
    <div class="meta-box mono">
      <div>شماره فاکتور: <strong>${invoice.invoiceNumber}</strong></div>
      <div>تاریخ صدور: <strong>${invoice.date}</strong></div>
    </div>
  </div>

  <div class="info-grid">
    <div>طرف حساب / مشتری: <strong>${invoice.contactName}</strong></div>
    <div>ارز مبنا: <strong>${invoice.currency} (نرخ توافقی: ${formatNumber(invoice.exchangeRate)} ریال)</strong></div>
    <div>وضعیت تسویه: <strong>${invoice.status === 'paid' ? 'تسویه کامل' : invoice.status === 'partial' ? 'تسویه ترکیبی' : 'نسیه (منظور در مانده حساب)'}</strong></div>
    <div>شماره پیگیری فیش / سند: <strong>${invoice.linkedVoucherId || invoice.invoiceNumber}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:50px;">ردیف</th>
        <th>شرح معامله و ارز</th>
        <th class="center" style="width:140px;">مقدار ارز</th>
        <th class="center" style="width:170px;">نرخ ریالی واحد</th>
        <th class="center" style="width:200px;">مبلغ کل (ریال)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="bold" style="text-align:left;">جمع کل فاکتور:</td>
        <td class="left mono bold" style="font-size:14px; color:#0f766e;">${formatNumber(invoice.grandTotalIRR)} ریال</td>
      </tr>
      ${invoice.paidAmountIRR ? `
      <tr>
        <td colspan="4" class="bold" style="text-align:left;">مبلغ پرداخت / تسویه شده:</td>
        <td class="left mono bold" style="color:#047857;">${formatNumber(invoice.paidAmountIRR)} ریال</td>
      </tr>` : ''}
      ${invoice.remainingAmountIRR ? `
      <tr>
        <td colspan="4" class="bold" style="text-align:left;">مانده بدهی / تعهد در حساب شخص:</td>
        <td class="left mono bold" style="color:#b91c1c;">${formatNumber(invoice.remainingAmountIRR)} ریال</td>
      </tr>` : ''}
    </tfoot>
  </table>

  ${invoice.notes ? `<div style="margin-top:14px; padding:8px 12px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; font-size:11.5px;"><strong>توضیحات:</strong> ${invoice.notes}</div>` : ''}

  <div class="signatures">
    <div class="sig-box">مهر و امضای حسابداری صرافی آرکا</div>
    <div class="sig-box">امضا و تایید طرف حساب / مشتری (${invoice.contactName})</div>
  </div>
</body>
</html>`;

  triggerHtmlPrintOrDownload(htmlDocument, `Invoice_${invoice.invoiceNumber}.html`, mode);
}

/**
 * Official Single FX Deal Receipt (رسید رسمی معامله خرید/فروش ارز)
 */
export function exportOrPrintSingleDealReceiptPDF(
  deal: FXDeal,
  companyName: string,
  mode: 'print' | 'download_pdf_html' = 'print'
) {
  const isBuy = deal.type === 'buy';
  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>رسید معامله ارزی - ${deal.dealNumber}</title>

  <style>
    @page { size: A5 landscape; margin: 8mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 16px; background: #fff; color: #0f172a; direction: rtl; font-size: 11.5px; }
    .header-box { border: 2px solid #0f766e; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; }
    .header-title h1 { margin: 0 0 2px 0; font-size: 16px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0; font-size: 12px; font-weight: 700; color: #0f766e; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; background: #f8fafc; font-size: 11.5px; }
    .highlight-box { background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 800; }
    .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; margin-top: 20px; text-align: center; font-size: 11.5px; font-weight: 700; }
    .sig-box { border: 1px dashed #94a3b8; padding: 15px 10px 40px; border-radius: 6px; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">
      <h1>${companyName || 'صرافی و امور ارزی آرکا'}</h1>
      <h2>رسید رسمی معامله ${isBuy ? 'خرید ارز (دریافت ارز از مشتری)' : 'فروش ارز (تحویل ارز به مشتری)'}</h2>
    </div>
    <div class="mono" style="text-align:left;">
      <div>شماره معامله: <strong>${deal.dealNumber}</strong></div>
      <div>تاریخ: <strong>${deal.date}</strong></div>
    </div>
  </div>

  <div class="info-grid">
    <div>طرف حساب: <strong>${deal.contactName}</strong></div>
    <div>نوع عملیات: <strong>${isBuy ? 'خرید ارز از مشتری' : 'فروش ارز به مشتری'}</strong></div>
    <div>شماره پیگیری فیش: <strong>${deal.trackingNumber || deal.dealNumber}</strong></div>
    <div>نرخ توافقی هر واحد: <strong class="mono">${formatNumber(deal.exchangeRate)} ریال</strong></div>
  </div>

  <div class="highlight-box">
    <div>مقدار کل ارز معامله: <span class="mono">${formatCurrencyAmount(deal.foreignAmount, deal.currency)} ${deal.currency}</span></div>
    <div class="left mono" style="color:#047857;">مبلغ کل ریالی: ${formatNumber(deal.totalIRR)} ریال</div>
  </div>

  ${deal.notes ? `<div style="padding:6px 10px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; margin-bottom:10px; font-size:11px;"><strong>توضیحات:</strong> ${deal.notes}</div>` : ''}

  <div class="signatures">
    <div class="sig-box">مهر و امضای صرافی آرکا</div>
    <div class="sig-box">امضای مشتری (${deal.contactName})</div>
  </div>
</body>
</html>`;

  triggerHtmlPrintOrDownload(htmlDocument, `FX_Deal_${deal.dealNumber}.html`, mode);
}

/**
 * Official Deals Summary Report (دفتر معاملات خرید و فروش ارز)
 */
export function exportOrPrintFXDealsSummaryPDF(
  deals: FXDeal[],
  companyName: string,
  fiscalYear: string,
  mode: 'print' | 'download_pdf_html' = 'print'
) {
  const rowsHtml = deals
    .map(
      (d, idx) => `
    <tr>
      <td class="center mono">${idx + 1}</td>
      <td class="center mono">${d.date}</td>
      <td class="center mono bold">${d.dealNumber}</td>
      <td class="center mono bold" style="color:#0f766e;">${d.trackingNumber || '—'}</td>
      <td class="bold">${d.contactName}</td>
      <td class="center bold" style="color:${d.type === 'buy' ? '#047857' : '#d97706'};">${d.type === 'buy' ? 'خرید ارز' : 'فروش ارز'}</td>
      <td class="left mono bold">${formatCurrencyAmount(d.foreignAmount, d.currency)} ${d.currency}</td>
      <td class="left mono">${formatNumber(d.exchangeRate)}</td>
      <td class="left mono bold">${formatNumber(d.totalIRR)}</td>
    </tr>
  `
    )
    .join('');

  const totalBuyIRR = deals.filter((d) => d.type === 'buy').reduce((s, d) => s + d.totalIRR, 0);
  const totalSellIRR = deals.filter((d) => d.type === 'sell').reduce((s, d) => s + d.totalIRR, 0);

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>دفتر معاملات ارز - ${companyName}</title>

  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 16px; background: #fff; color: #0f172a; direction: rtl; font-size: 11px; }
    .header-box { border: 2px solid #0f766e; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; }
    .header-title h1 { margin: 0 0 2px 0; font-size: 17px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0; font-size: 13px; font-weight: 700; color: #0f766e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; font-size: 11px; }
    th { background: #1e293b; color: #fff; font-weight: 700; text-align: right; }
    tfoot td { background: #f1f5f9; font-weight: 800; }
    .center { text-align: center; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">
      <h1>${companyName || 'صرافی آرکا'}</h1>
      <h2>دفتر جامع معاملات خرید و فروش ارز (دوره مالی ${fiscalYear || '۱۴۰۴'})</h2>
    </div>
    <div class="mono" style="text-align:left;">
      <div>تعداد معاملات: <strong>${deals.length}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:40px;">ردیف</th>
        <th class="center" style="width:80px;">تاریخ</th>
        <th class="center" style="width:95px;">شماره معامله</th>
        <th class="center" style="width:110px;">شماره پیگیری فیش</th>
        <th>طرف حساب / مشتری</th>
        <th class="center" style="width:85px;">نوع</th>
        <th class="center" style="width:120px;">مقدار ارز</th>
        <th class="center" style="width:100px;">نرخ ریالی</th>
        <th class="center" style="width:140px;">مبلغ کل (ریال)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="8" class="bold" style="text-align:left;">جمع خرید ارز صرافی به ریال:</td>
        <td class="left mono bold" style="color:#047857;">${formatNumber(totalBuyIRR)} ریال</td>
      </tr>
      <tr>
        <td colspan="8" class="bold" style="text-align:left;">جمع فروش ارز صرافی به ریال:</td>
        <td class="left mono bold" style="color:#d97706;">${formatNumber(totalSellIRR)} ریال</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

  triggerHtmlPrintOrDownload(htmlDocument, `FX_Deals_Report_${fiscalYear || '1404'}.html`, mode);
}

/**
 * Official Customer Balance Summary Report (تراز کامل بدهکاران و بستانکاران)
 */
export function exportOrPrintContactSummaryListPDF(
  contacts: Array<{
    name: string;
    phone?: string;
    balanceIRR: number;
    diagnosisIRR: string;
    balancesForeign?: Array<{ currency: string; amount: number; diagnosis: string }>;
  }>,
  companyName: string,
  fiscalYear: string,
  mode: 'print' | 'download_pdf_html' = 'print'
) {
  const rowsHtml = contacts
    .map((c, idx) => {
      const fxDetails = (c.balancesForeign || [])
        .map((f) => `${formatCurrencyAmount(f.amount, f.currency)} ${f.currency} (${f.diagnosis})`)
        .join(' | ') || '—';

      return `
      <tr>
        <td class="center mono">${idx + 1}</td>
        <td class="bold">${c.name}</td>
        <td class="center mono">${c.phone || '—'}</td>
        <td class="left mono bold">${formatNumber(c.balanceIRR)}</td>
        <td class="center bold ${c.diagnosisIRR === 'بدهکار' ? 'style="color:#047857;"' : c.diagnosisIRR === 'بستانکار' ? 'style="color:#b91c1c;"' : ''}">${c.diagnosisIRR}</td>
        <td class="left mono" style="background:#f0fdfa; color:#0f766e;">${fxDetails}</td>
      </tr>`;
    })
    .join('');

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تراز مشتریان و اشخاص - ${companyName}</title>

  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 16px; background: #fff; color: #0f172a; direction: rtl; font-size: 11px; }
    .header-box { border: 2px solid #0f766e; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; }
    .header-title h1 { margin: 0 0 2px 0; font-size: 17px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0; font-size: 13px; font-weight: 700; color: #0f766e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; font-size: 11px; }
    th { background: #1e293b; color: #fff; font-weight: 700; text-align: right; }
    .center { text-align: center; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">
      <h1>${companyName || 'صرافی آرکا'}</h1>
      <h2>گزارش وضعیت مانده حساب اشخاص و مشتریان (تراز بدهکاران و بستانکاران - دوره مالی ${fiscalYear || '۱۴۰۴'})</h2>
    </div>
    <div class="mono" style="text-align:left;">
      <div>تعداد اشخاص: <strong>${contacts.length}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:45px;">ردیف</th>
        <th>نام طرف حساب / مشتری</th>
        <th class="center" style="width:110px;">تلفن</th>
        <th class="center" style="width:150px;">مانده ریالی (ریال)</th>
        <th class="center" style="width:90px;">تشخیص</th>
        <th>مانده حساب‌های ارزی (دلار، درهم، یورو...)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

  triggerHtmlPrintOrDownload(htmlDocument, `Contacts_Balances_${fiscalYear || '1404'}.html`, mode);
}

/**
 * Official Profit & Loss Statement (صورت رسمی سود و زیان صرافی و بازرگانی)
 */
export function exportOrPrintProfitStatementPDF(params: {
  monthlyProfitBreakdown: Array<{
    monthLabel: string;
    dealsCount: number;
    buyTotalIRR: number;
    sellTotalIRR: number;
    fxProfitIRR: number;
    expensesIRR: number;
    netProfitIRR: number;
  }>;
  currencyVaultPositions: any[];
  antiCheatNetWorth: {
    rialBanksIRR: number;
    foreignVaultsIRR: number;
    receivablesIRR: number;
    payablesIRR: number;
    netWorthIRR: number;
  };
  companyName: string;
  fiscalYear: string;
  mode?: 'print' | 'download_pdf_html';
}) {
  const { monthlyProfitBreakdown, currencyVaultPositions, antiCheatNetWorth, companyName, fiscalYear, mode = 'print' } = params;

  const totalNetProfit = monthlyProfitBreakdown.reduce((s, m) => s + m.netProfitIRR, 0);
  const totalFxProfit = monthlyProfitBreakdown.reduce((s, m) => s + m.fxProfitIRR, 0);
  const totalExpenses = monthlyProfitBreakdown.reduce((s, m) => s + m.expensesIRR, 0);

  const monthsRows = monthlyProfitBreakdown
    .map(
      (m, idx) => `
    <tr>
      <td class="center mono">${idx + 1}</td>
      <td class="bold">${m.monthLabel}</td>
      <td class="center mono">${m.dealsCount}</td>
      <td class="left mono">${formatNumber(m.buyTotalIRR)}</td>
      <td class="left mono">${formatNumber(m.sellTotalIRR)}</td>
      <td class="left mono bold" style="color:#047857;">${formatNumber(m.fxProfitIRR)}</td>
      <td class="left mono" style="color:#b91c1c;">${formatNumber(m.expensesIRR)}</td>
      <td class="left mono bold" style="background:#f0fdfa; color:#0f766e;">${formatNumber(m.netProfitIRR)}</td>
    </tr>
  `
    )
    .join('');

  const currenciesRows = currencyVaultPositions
    .map(
      (c, idx) => `
    <tr>
      <td class="center mono">${idx + 1}</td>
      <td class="bold">${c.currencyName || c.currency} (${c.currency})</td>
      <td class="left mono bold">${formatCurrencyAmount(c.physicalVaultBalance || 0, c.currency)}</td>
      <td class="left mono">${formatNumber(c.weightedAvgBuyRate || 0)}</td>
      <td class="left mono">${formatNumber(c.weightedAvgSellRate || 0)}</td>
      <td class="left mono bold" style="color:#047857;">${formatNumber(c.realizedProfitIRR || 0)} ریال</td>
    </tr>
  `
    )
    .join('');

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>گزارش سود و زیان - ${companyName}</title>

  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 16px; background: #fff; color: #0f172a; direction: rtl; font-size: 11px; }
    .header-box { border: 2px solid #0f766e; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; }
    .header-title h1 { margin: 0 0 2px 0; font-size: 17px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0; font-size: 13px; font-weight: 700; color: #0f766e; }
    .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .card { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center; }
    .card-title { font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .card-val { font-size: 15px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; font-size: 11px; }
    th { background: #1e293b; color: #fff; font-weight: 700; text-align: right; }
    tfoot td { background: #f1f5f9; font-weight: 800; }
    .center { text-align: center; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">
      <h1>${companyName || 'صرافی آرکا'}</h1>
      <h2>صورت سود و زیان و عملکرد مالی (دوره مالی ${fiscalYear || '۱۴۰۴'})</h2>
    </div>
  </div>

  <div class="cards-grid">
    <div class="card" style="border-color:#10b981; background:#ecfdf5;">
      <div class="card-title">سود ناخالص معاملات ارزی</div>
      <div class="card-val mono" style="color:#047857;">${formatNumber(totalFxProfit)} ریال</div>
    </div>
    <div class="card" style="border-color:#f43f5e; background:#fff1f2;">
      <div class="card-title">هزینه‌های جاری و دفتری</div>
      <div class="card-val mono" style="color:#b91c1c;">${formatNumber(totalExpenses)} ریال</div>
    </div>
    <div class="card" style="border-color:#0f766e; background:#f0fdfa;">
      <div class="card-title">سود خالص نهایی کسب‌شده</div>
      <div class="card-val mono" style="color:#0f766e;">${formatNumber(totalNetProfit)} ریال</div>
    </div>
  </div>

  <h3 style="margin:10px 0 6px 0; font-size:12px; font-weight:800;">۱. جدول سود و زیان ماه به ماه</h3>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:35px;">ردیف</th>
        <th>ماه</th>
        <th class="center" style="width:70px;">تعداد معامله</th>
        <th class="center" style="width:110px;">خرید ریالی</th>
        <th class="center" style="width:110px;">فروش ریالی</th>
        <th class="center" style="width:110px;">سود ناخالص ارز</th>
        <th class="center" style="width:90px;">هزینه‌ها</th>
        <th class="center" style="width:120px;">سود خالص ماه</th>
      </tr>
    </thead>
    <tbody>
      ${monthsRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="bold" style="text-align:left;">جمع کل سود دوره مالی:</td>
        <td class="left mono bold" style="color:#047857;">${formatNumber(totalFxProfit)}</td>
        <td class="left mono bold" style="color:#b91c1c;">${formatNumber(totalExpenses)}</td>
        <td class="left mono bold" style="color:#0f766e; font-size:12px;">${formatNumber(totalNetProfit)} ریال</td>
      </tr>
    </tfoot>
  </table>

  <h3 style="margin:10px 0 6px 0; font-size:12px; font-weight:800;">۲. تفکیک سود و موجودی هر ارز</h3>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:35px;">ردیف</th>
        <th>نوع ارز</th>
        <th class="center" style="width:130px;">موجودی واقعی خزانه</th>
        <th class="center" style="width:110px;">میانگین نرخ خرید</th>
        <th class="center" style="width:110px;">میانگین نرخ فروش</th>
        <th class="center" style="width:140px;">سود حاصل از این ارز</th>
      </tr>
    </thead>
    <tbody>
      ${currenciesRows}
    </tbody>
  </table>

  <div style="margin-top:14px; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc; font-size:11.5px;">
    <strong>تراز سرمایه کل صرافی: </strong>
    موجودی نقد و بانک‌ها (${formatNumber(antiCheatNetWorth.rialBanksIRR)} ریال) +
    ارزش ریالی ارزهای موجود (${formatNumber(antiCheatNetWorth.foreignVaultsIRR)} ریال) +
    طلب از مشتریان (${formatNumber(antiCheatNetWorth.receivablesIRR)} ریال) -
    بدهی به مشتریان (${formatNumber(antiCheatNetWorth.payablesIRR)} ریال) =
    <strong class="mono" style="color:#0f766e; font-size:13px;">${formatNumber(antiCheatNetWorth.netWorthIRR)} ریال (ارزش خالص دارایی صرافی)</strong>
  </div>
</body>
</html>`;

  triggerHtmlPrintOrDownload(htmlDocument, `Profit_Report_${fiscalYear || '1404'}.html`, mode);
}

function triggerHtmlPrintOrDownload(
  htmlDocument: string,
  downloadFilename: string,
  mode: 'print' | 'download_pdf_html'
) {
  if (mode === 'download_pdf_html') {
    const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlDocument);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 350);
  }
}
