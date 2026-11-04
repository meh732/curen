import {
  StandardLedgerReportResult,
  formatCurrencyAmount,
  formatNumber,
} from './accountingEngine';
import { SalesInvoice, FXDeal } from '../types/accounting';

/**
 * Generates a print-ready and PDF-ready A4 Official Accounting Ledger Report
 * with top-to-bottom Debit (بدهکار), Credit (بستانکار), Diagnosis (تشخیص), and Running Balance (مانده).
 * Also triggers direct HTML/PDF download or browser print dialog.
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
        return `
          <tr>
            <td class="center mono">${r.rowNumber}</td>
            <td class="center mono">${r.date}</td>
            <td class="center mono">#${r.voucherNumber}</td>
            <td>${r.accountCode} - ${r.accountName}</td>
            <td>${r.description}</td>
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
          </tr>
        `;
      } else {
        return `
          <tr>
            <td class="center mono">${r.rowNumber}</td>
            <td class="center mono">${r.date}</td>
            <td class="center mono">#${r.voucherNumber}</td>
            <td>${r.description}</td>
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
  <title>${report.reportTitle} - ${companyName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { margin: 0; padding: 20px; background: #fff; color: #0f172a; direction: rtl; font-size: 12px; }
    .header-box { border: 2px solid #1e293b; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
    .header-title h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #0f172a; }
    .header-title h2 { margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #1d4ed8; }
    .header-title p { margin: 0; font-size: 11px; color: #475569; }
    .header-meta { text-align: left; font-size: 11px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #94a3b8; padding: 7px 8px; font-size: 11.5px; }
    th { background: #1e293b; color: #ffffff; font-weight: 700; text-align: right; }
    tr:nth-child(even) td { background: #f8fafc; }
    .center { text-align: center; }
    .left { text-align: left; direction: ltr; }
    .mono { font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    .balance-col { background: #eff6ff !important; color: #1e3a8a; }
    .deb { color: #b45309; }
    .cred { color: #047857; }
    tfoot td { background: #e2e8f0 !important; font-weight: 800; font-size: 12px; border-top: 2px solid #0f172a; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; text-align: center; font-size: 12px; font-weight: 700; }
    .sig-box { border: 1px dashed #94a3b8; padding: 25px 10px 45px; border-radius: 6px; }
    .toolbar { margin-bottom: 16px; padding: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: #1d4ed8; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <div><strong>پیش‌نمایش رسمی چاپ و خروجی PDF استاندارد حسابداری:</strong> برای ذخیره به صورت فایل PDF، در پنجره چاپ گزینه <strong>Save as PDF</strong> را انتخاب کنید.</div>
    <button class="btn" onclick="window.print()">چاپ / ذخیره فایل PDF (Ctrl+P)</button>
  </div>

  <div class="header-box">
    <div class="header-title">
      <h1>${companyName} (${fiscalYear})</h1>
      <h2>${report.reportTitle}</h2>
      <p>${report.reportSubtitle}</p>
    </div>
    <div class="header-meta mono">
      <div><strong>تاریخ گزارش:</strong> 1404/08/12</div>
      <div><strong>تعداد کل آرتیکل‌ها:</strong> ${report.rows.length} ردیف</div>
      <div><strong>مانده نهایی:</strong> ${
        isRial
          ? `${formatNumber(report.finalBalanceIRR)} ریال (${report.finalDiagnosisIRR})`
          : `${formatCurrencyAmount(
              report.finalBalanceForeign,
              report.selectedCurrency
            )} ${report.selectedCurrency} (${report.finalDiagnosisForeign})`
      }</div>
    </div>
  </div>

  <table>
    <thead>
      ${
        isRial
          ? `<tr>
              <th class="center" style="width:42px">ردیف</th>
              <th class="center" style="width:82px">تاریخ</th>
              <th class="center" style="width:65px">سند</th>
              <th style="width:170px">سرفصل حساب</th>
              <th>شرح کامل عملیات حسابداری</th>
              <th class="center" style="width:120px">ارز و نرخ</th>
              <th class="center" style="width:125px">بدهکار (ریال)</th>
              <th class="center" style="width:125px">بستانکار (ریال)</th>
              <th class="center" style="width:70px">تشخیص</th>
              <th class="center" style="width:140px">مانده از بالا به پایین (ریال)</th>
            </tr>`
          : `<tr>
              <th class="center" style="width:42px">ردیف</th>
              <th class="center" style="width:82px">تاریخ</th>
              <th class="center" style="width:65px">سند</th>
              <th>شرح کامل عملیات ارزی</th>
              <th class="center" style="width:60px">ارز</th>
              <th class="center" style="width:100px">نرخ تبدیل</th>
              <th class="center" style="width:120px">بدهکار ارزی</th>
              <th class="center" style="width:120px">بستانکار ارزی</th>
              <th class="center" style="width:70px">تشخیص</th>
              <th class="center" style="width:135px">مانده از بالا به پایین ارزی</th>
              <th class="center" style="width:130px">معادل مانده (ریال)</th>
            </tr>`
      }
    </thead>
    <tbody>
      ${
        rowsHtml ||
        `<tr><td colspan="11" class="center">هیچ تراکنشی در این حساب ثبت نشده است.</td></tr>`
      }
    </tbody>
    <tfoot>
      ${
        isRial
          ? `<tr>
              <td colspan="6" style="text-align:left">جمع کل گردش و مانده نهایی از بالا به پایین:</td>
              <td class="left mono">${formatNumber(report.totalDebitIRR)}</td>
              <td class="left mono">${formatNumber(report.totalCreditIRR)}</td>
              <td class="center">${report.finalDiagnosisIRR}</td>
              <td class="left mono">${formatNumber(report.finalBalanceIRR)} ریال</td>
            </tr>`
          : `<tr>
              <td colspan="6" style="text-align:left">جمع کل گردش ارزی و مانده نهایی:</td>
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
    <div class="sig-box">مهر و امضای مدیر مالی</div>
    <div class="sig-box">مهر و امضای طرف حساب / تأییدیه</div>
  </div>
</body>
</html>`;

  if (mode === 'download_pdf_html') {
    const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = report.reportTitle.replace(/\s+/g, '_').slice(0, 40);
    a.download = `Report_${safeName}_${report.currencyMode}_1404.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Also trigger clean print via hidden iframe so it works inside sandboxed environments without window.open
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
