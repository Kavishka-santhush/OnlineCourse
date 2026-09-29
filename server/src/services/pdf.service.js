import puppeteer from 'puppeteer';
import { env } from '../config/env.js';

/**
 * Puppeteer-based PDF generation (certificates, invoices, reports).
 * A single browser instance is lazily launched and reused. Returns a Buffer.
 * The generated PDF is uploaded to Supabase Storage by the caller.
 */
let browserPromise;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });
  }
  return browserPromise;
}

async function htmlToPdf(html, { landscape = false, width = '1123px', height = '794px' } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    landscape,
    printBackground: true,
    width,
    height,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  await page.close();
  return Buffer.from(pdf);
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function renderCertificatePdf({
  studentName, courseTitle, instructorName, issuedAt, certificateId, logoUrl, template = {},
}) {
  const accent = esc(template.accent_color || '#6366f1');
  const border = esc(template.border_color || '#e0c675');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; }
    body { width: 1123px; height: 794px; background: #fffdf7; }
    .frame { position: relative; width: 100%; height: 100%; padding: 48px; border: 14px double ${border}; }
    .inner { position: absolute; inset: 26px; border: 2px solid ${border}; }
    .content { position: relative; height: 100%; text-align: center; padding: 40px 60px; }
    .logo { height: 60px; margin-bottom: 8px; }
    h1 { font-size: 46px; letter-spacing: 6px; color: ${accent}; margin-top: 8px; }
    .sub { font-size: 18px; color: #555; margin-top: 6px; font-style: italic; }
    .name { font-size: 40px; color: #1f2937; margin: 26px 0 6px; border-bottom: 2px solid ${border}; display: inline-block; padding: 0 40px 6px; }
    .course { font-size: 26px; color: #111827; font-weight: bold; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 60px; }
    .sig { text-align: center; font-size: 15px; color: #374151; }
    .sig .line { border-top: 1px solid #374151; width: 220px; margin: 0 auto 6px; padding-top: 6px; }
    .footer { position: absolute; bottom: 40px; left: 0; right: 0; font-size: 12px; color: #9ca3af; }
  </style></head><body><div class="frame"><div class="inner"></div><div class="content">
    ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" />` : ''}
    <div class="sub">${esc(template.platform_name || 'CourseMarket')} presents</div>
    <h1>CERTIFICATE OF COMPLETION</h1>
    <div class="sub">This is to certify that</div>
    <div class="name">${esc(studentName)}</div>
    <div class="sub">has successfully completed the course</div>
    <div class="course">${esc(courseTitle)}</div>
    <div class="row">
      <div class="sig"><div class="line">${esc(instructorName || 'Instructor')}</div>Instructor</div>
      <div class="sig"><div class="line">${esc(issuedAt)}</div>Date of Completion</div>
    </div>
    <div class="footer">Verify at ${esc(env.frontendUrl)}/verify/${esc(certificateId)} · Certificate ID: ${esc(certificateId)}</div>
  </div></div></body></html>`;
  return htmlToPdf(html, { landscape: true });
}

export async function renderInvoicePdf({ invoiceNumber, buyerName, sellerName, item, amount, tax, total, date, paymentMethod }) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
    body { padding: 48px; }
    h1 { font-size: 28px; } .muted { color: #6b7280; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 32px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    th { background: #f3f4f6; }
    .totals { margin-top: 24px; width: 320px; margin-left: auto; font-size: 14px; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand { font-weight: bold; font-size: 18px; border-top: 2px solid #111827; }
    .head { display: flex; justify-content: space-between; }
  </style></head><body>
    <div class="head"><div><h1>INVOICE</h1><div class="muted"># ${esc(invoiceNumber)}</div></div>
      <div style="text-align:right"><div class="muted">Issued</div><div>${esc(date)}</div></div></div>
    <table><tr><th>From</th><th>Bill To</th></tr>
      <tr><td>${esc(sellerName)}</td><td>${esc(buyerName)}</td></tr></table>
    <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody><tr><td>${esc(item)}</td><td style="text-align:right">${esc(amount)}</td></tr></tbody></table>
    <div class="totals">
      <div><span>Subtotal</span><span>${esc(amount)}</span></div>
      <div><span>Tax</span><span>${esc(tax)}</span></div>
      <div class="grand"><span>Total</span><span>${esc(total)}</span></div>
      <div class="muted"><span>Method</span><span>${esc(paymentMethod)}</span></div>
    </div>
  </body></html>`;
  return htmlToPdf(html, { landscape: false, width: '800px', height: '1000px' });
}

export async function renderReportPdf({ title, generatedAt, columns, rows, summary }) {
  const head = columns.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
  const cards = (summary || []).map((s) => `<div class="card"><div class="k">${esc(s.label)}</div><div class="v">${esc(s.value)}</div></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; font-family: Arial, sans-serif; color: #1f2937; } body { padding: 40px; }
    h1 { font-size: 24px; } .cards { display: flex; gap: 16px; margin: 24px 0; }
    .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
    .card .k { font-size: 12px; color: #6b7280; } .card .v { font-size: 22px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; } th { background: #f3f4f6; }
  </style></head><body>
    <h1>${esc(title)}</h1><div style="color:#6b7280;font-size:13px">Generated ${esc(generatedAt)}</div>
    <div class="cards">${cards}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
  return htmlToPdf(html, { landscape: true });
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
