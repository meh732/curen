import {
  StandardLedgerReportResult,
  formatCurrencyAmount,
  formatNumber,
} from './accountingEngine';
import { FXDeal } from '../types/accounting';

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
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap" rel="stylesheet" />
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
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap" rel="stylesheet" />
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
