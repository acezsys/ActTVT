const PDFDocument = require('pdfkit');
const { amountInWords } = require('./numberToWords');

const SELLER = {
  name: 'ARIECKAL INDUSTRIES',
  address: 'Plot No. 1, Panvel Industrial Co-Op Estate, Panvel, Mumbai-410206',
  gstin: '27AABPA5655N1ZK',
  state: 'Maharashtra',
  stateCode: '27',
  contact: '022-7453584, 9820439656',
  email: 'arieckal.industries@gmail.com',
};

function financialYearLabel(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function fmtMoney(n) {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateInvoicePdf({ invoice, lines }) {
  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  const seqNumber = invoice.invoice_id.replace(/\D/g, ''); // digits from e.g. AIN-0042 -> 0042
  const displayInvoiceNo = `AI-${Number(seqNumber)}/${financialYearLabel(invoice.invoice_date)}`;

  const itemLines = lines.filter((l) => l.line_kind === 'item');
  const chargeLines = lines.filter((l) => l.line_kind !== 'item');

  doc.fontSize(14).text('Tax Invoice', { align: 'center' });
  doc.moveDown(0.5);

  // --- Header block: seller (left) + invoice meta (right) -----------------
  const topY = doc.y;
  doc.fontSize(9).font('Helvetica-Bold').text(`${SELLER.name} - (${financialYearLabel(invoice.invoice_date)})`, 30, topY);
  doc.font('Helvetica').fontSize(8);
  doc.text(SELLER.address, 30, doc.y, { width: 280 });
  doc.text(`GSTIN/UIN: ${SELLER.gstin}`, 30);
  doc.text(`State Name: ${SELLER.state}, Code: ${SELLER.stateCode}`, 30);
  doc.text(`Contact: ${SELLER.contact}`, 30);
  doc.text(`E-Mail: ${SELLER.email}`, 30);

  doc.fontSize(8).text('Invoice No.', 330, topY);
  doc.font('Helvetica-Bold').text(displayInvoiceNo, 330, doc.y);
  doc.font('Helvetica').text('Dated', 330, doc.y + 4);
  doc.text(fmtDate(invoice.invoice_date), 330, doc.y);
  doc.text('Buyer\'s Order No.', 330, doc.y + 4);
  doc.text(invoice.buyers_order_no || '—', 330, doc.y);
  doc.text('Dated', 330, doc.y + 4);
  doc.text(fmtDate(invoice.buyers_order_date), 330, doc.y);

  doc.moveDown(2);
  let y = doc.y + 10;

  // --- Buyer block -----------------------------------------------------------
  doc.fontSize(8).font('Helvetica-Bold').text('Buyer (Bill to)', 30, y);
  doc.font('Helvetica').fontSize(8);
  doc.text(invoice.client_name || '', 30, doc.y + 2, { width: 500 });
  if (invoice.client_address) doc.text(invoice.client_address, 30, doc.y, { width: 500 });
  if (invoice.client_gst) doc.text(`GSTIN/UIN: ${invoice.client_gst}`, 30);

  doc.moveDown(1);
  y = doc.y + 6;

  // --- Line items table --------------------------------------------------
  const tableTop = y;
  const cols = { sl: 30, desc: 55, hsn: 260, gst: 310, qty: 345, rate: 385, per: 430, disc: 455, amt: 480 };
  doc.font('Helvetica-Bold').fontSize(7.5);
  doc.text('Sl', cols.sl, tableTop);
  doc.text('Description', cols.desc, tableTop);
  doc.text('HSN/SAC', cols.hsn, tableTop);
  doc.text('GST%', cols.gst, tableTop);
  doc.text('Qty', cols.qty, tableTop);
  doc.text('Rate', cols.rate, tableTop);
  doc.text('Per', cols.per, tableTop);
  doc.text('Disc%', cols.disc, tableTop);
  doc.text('Amount', cols.amt, tableTop);
  doc.moveTo(30, tableTop + 12).lineTo(565, tableTop + 12).stroke();

  let rowY = tableTop + 18;
  doc.font('Helvetica').fontSize(7.5);
  let sl = 1;
  for (const line of itemLines) {
    const descHeight = doc.heightOfString(line.description, { width: 195 });
    doc.text(String(sl++), cols.sl, rowY);
    doc.text(line.description, cols.desc, rowY, { width: 195 });
    doc.text(line.hsn_sac || '', cols.hsn, rowY);
    doc.text(line.gst_rate ? `${line.gst_rate}%` : '', cols.gst, rowY);
    doc.text(line.quantity || '', cols.qty, rowY);
    doc.text(line.rate ? fmtMoney(line.rate) : '', cols.rate, rowY);
    doc.text(line.unit || '', cols.per, rowY);
    doc.text(line.discount_pct ? `${line.discount_pct}%` : '', cols.disc, rowY);
    doc.text(fmtMoney(line.amount), cols.amt, rowY);
    rowY += Math.max(descHeight, 12) + 6;
  }
  for (const line of chargeLines) {
    doc.text(line.description, cols.desc, rowY, { width: 195 });
    doc.text(line.hsn_sac || '', cols.hsn, rowY);
    doc.text(line.gst_rate ? `${line.gst_rate}%` : '', cols.gst, rowY);
    doc.text(fmtMoney(line.amount), cols.amt, rowY);
    rowY += 14;
  }

  // Tax line(s)
  const taxableValue = Number(invoice.taxable_value);
  const taxAmount = Number(invoice.tax_amount);
  rowY += 4;
  if (invoice.tax_type === 'igst') {
    doc.text(`IGST @ ${invoice.tax_rate}%`, cols.desc, rowY);
    doc.text(fmtMoney(taxAmount), cols.amt, rowY);
    rowY += 14;
  } else {
    const half = taxAmount / 2;
    doc.text(`CGST @ ${invoice.tax_rate / 2}%`, cols.desc, rowY);
    doc.text(fmtMoney(half), cols.amt, rowY);
    rowY += 14;
    doc.text(`SGST @ ${invoice.tax_rate / 2}%`, cols.desc, rowY);
    doc.text(fmtMoney(half), cols.amt, rowY);
    rowY += 14;
  }

  doc.moveTo(30, rowY + 4).lineTo(565, rowY + 4).stroke();
  rowY += 10;
  doc.font('Helvetica-Bold');
  doc.text('Total', cols.desc, rowY);
  doc.text(`₹ ${fmtMoney(invoice.total_amount)}`, cols.amt, rowY);
  doc.font('Helvetica').fontSize(7).text('E & O.E', 500, rowY + 14);

  // --- Amount in words -------------------------------------------------------
  rowY += 34;
  doc.fontSize(8).font('Helvetica-Bold').text('Amount Chargeable (in words)', 30, rowY);
  doc.font('Helvetica').text(amountInWords(invoice.total_amount), 30, doc.y + 2);

  // --- Tax summary table -------------------------------------------------
  rowY = doc.y + 16;
  doc.font('Helvetica-Bold').fontSize(7.5);
  doc.text('HSN/SAC', 30, rowY);
  doc.text('Taxable Value', 150, rowY);
  doc.text('Rate', 260, rowY);
  doc.text('Tax Amount', 310, rowY);
  doc.text('Total Tax', 420, rowY);
  doc.moveTo(30, rowY + 12).lineTo(565, rowY + 12).stroke();

  rowY += 18;
  doc.font('Helvetica').fontSize(7.5);
  const hsnGroups = {};
  for (const l of lines) {
    const key = l.hsn_sac || '—';
    if (!hsnGroups[key]) hsnGroups[key] = 0;
    hsnGroups[key] += Number(l.amount);
  }
  for (const [hsn, val] of Object.entries(hsnGroups)) {
    const taxForGroup = val * (Number(invoice.tax_rate) / 100);
    doc.text(hsn, 30, rowY);
    doc.text(fmtMoney(val), 150, rowY);
    doc.text(`${invoice.tax_rate}%`, 260, rowY);
    doc.text(fmtMoney(taxForGroup), 310, rowY);
    doc.text(fmtMoney(taxForGroup), 420, rowY);
    rowY += 14;
  }
  doc.font('Helvetica-Bold');
  doc.text('Total', 30, rowY);
  doc.text(fmtMoney(taxableValue), 150, rowY);
  doc.text(fmtMoney(taxAmount), 310, rowY);
  doc.text(fmtMoney(taxAmount), 420, rowY);

  rowY += 20;
  doc.font('Helvetica-Bold').fontSize(8).text('Tax Amount (in words)', 30, rowY);
  doc.font('Helvetica').text(amountInWords(taxAmount), 30, doc.y + 2);

  // --- Declaration + signature --------------------------------------------
  rowY = doc.y + 20;
  doc.fontSize(7.5).font('Helvetica-Bold').text('Declaration', 30, rowY);
  doc.font('Helvetica').text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', 30, doc.y + 2, { width: 320 });

  doc.font('Helvetica-Bold').fontSize(8).text(`for ${SELLER.name}`, 400, rowY, { align: 'right', width: 165 });
  doc.font('Helvetica').fontSize(7.5).text('Authorised Signatory', 400, rowY + 50, { align: 'right', width: 165 });

  doc.fontSize(7).font('Helvetica').text('This is a Computer Generated Invoice', 30, 780, { align: 'center', width: 535 });

  doc.end();
  return doc;
}

module.exports = { generateInvoicePdf };
