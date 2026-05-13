import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import amiriBase64 from '../assets/fonts/Amiri-base64';
import { getLogoBase64 } from './logoBase64';

/**
 * Register the Amiri font with jsPDF for Urdu/Arabic text rendering
 * Amiri is a high-quality Naskh font that jsPDF can render correctly
 * (Nastaliq fonts require complex OpenType shaping that jsPDF doesn't support)
 */
function registerUrduFont(doc) {
  doc.addFileToVFS('Amiri-Regular.ttf', amiriBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
}

/**
 * Check if text contains Arabic/Urdu characters
 */
function hasUrdu(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Generate a unique short ID for file names (6 chars)
 */
function uniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

/**
 * Generate a timestamp string for unique file names: YYYYMMDD_HHmmss
 */
export function fileTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Safely convert an ArrayBuffer to a base64 string
 * (avoids "Maximum call stack size exceeded" with large buffers)
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Get cell text from jspdf-autotable cell data
 * Works for both head and body sections
 */
function getCellText(data) {
  // data.cell.text is always an array of strings in jspdf-autotable
  if (data.cell.text && Array.isArray(data.cell.text)) {
    return data.cell.text.join(' ');
  }
  // Fallback to raw value
  return String(data.cell.raw ?? '');
}

/**
 * Export report data to PDF with professional formatting
 * Supports bilingual LTR (English) + RTL (Urdu) with embedded Noto Nastaliq Urdu font
 */
export async function exportToPDF({ title, titleUrdu, columns, rows, summary, dateRange, fileName, highlightRows }) {
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  registerUrduFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Header ──
  doc.setFillColor(6, 6, 8);
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Logo in header
  try {
    const logoDataUrl = await getLogoBase64(160);
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 4, 2, 28, 28);
    }
  } catch (e) { /* logo unavailable, continue without it */ }

  const textStartX = 34; // offset text to the right of logo

  // Title (English)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  // Extract only English part of title (before the dash with Urdu)
  const titleParts = title.split('—');
  const englishTitle = titleParts[0].trim();
  doc.text(englishTitle, textStartX, 13);

  // Urdu title (RTL)
  if (titleParts[1] && hasUrdu(titleParts[1])) {
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(180, 200, 220);
    doc.text(titleParts[1].trim(), pageWidth - 14, 13, { align: 'right' });
  }

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Rana Traders — Commission Shop', textStartX, 22);

  // Urdu branding
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('رانا ٹریڈرز', pageWidth - 14, 22, { align: 'right' });

  // Date range (top right)
  if (dateRange) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(dateRange, pageWidth - 14, 28, { align: 'right' });
  }

  // Generated timestamp
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-PK')}`, textStartX, 28);

  let yPos = 38;

  // ── Summary cards ──
  if (summary && summary.length > 0) {
    const cardWidth = (pageWidth - 28 - (summary.length - 1) * 6) / summary.length;
    summary.forEach((item, i) => {
      const x = 14 + i * (cardWidth + 6);
      doc.setFillColor(20, 20, 24);
      doc.roundedRect(x, yPos, cardWidth, 18, 2, 2, 'F');
      // Label - check if it contains Urdu
      if (hasUrdu(item.label)) {
        doc.setFont('Amiri', 'normal');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(item.label, x + 4, yPos + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(241, 245, 249);
      doc.text(item.value, x + 4, yPos + 14);
    });
    yPos += 26;
  }

  // ── Pre-scan columns to find which ones have Urdu headers ──
  const urduColumnIndices = new Set();
  columns.forEach((col, i) => {
    if (hasUrdu(col)) urduColumnIndices.add(i);
  });

  // ── Data Table ──
  if (rows.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [columns],
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [30, 41, 59],
        lineWidth: 0.1,
        textColor: [71, 85, 105],
        font: 'helvetica',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [12, 12, 16],
        textColor: [148, 163, 184],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: generateColumnStyles(columns, rows),
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        const cellText = getCellText(data);

        if (data.section === 'head') {
          // For header cells: if the column heading contains Urdu, use Urdu font
          if (hasUrdu(cellText)) {
            data.cell.styles.font = 'Amiri';
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.fontSize = 9;
          }
        } else if (data.section === 'body') {
          // Highlight category/group header rows (bold + accent color + tinted bg)
          if (highlightRows && highlightRows.has(data.row.index)) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [180, 140, 20];
            data.cell.styles.fillColor = [255, 248, 230];
            data.cell.styles.fontSize = 9;
          }
          // For body cells: check if cell content contains Urdu
          if (hasUrdu(cellText)) {
            data.cell.styles.font = 'Amiri';
            data.cell.styles.fontSize = 9;
          }
        }
      },
      didDrawPage: () => {
        // Footer on each page
        doc.setFillColor(248, 250, 252);
        doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Rana Traders', 14, pageHeight - 4);
        doc.setFont('Amiri', 'normal');
        doc.text('رانا ٹریڈرز', 40, pageHeight - 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 4, { align: 'right' });
      },
    });
  }

  // Generate PDF as arraybuffer and show save dialog
  const pdfOutput = doc.output('arraybuffer');
  const base64 = arrayBufferToBase64(pdfOutput);
  const baseName = fileName ? fileName.replace(/\.pdf$/i, '') : 'report';
  const result = await window.api.saveFileDialog(
    `${baseName}.pdf`,
    [{ name: 'PDF Files', extensions: ['pdf'] }],
    base64
  );
  return result?.success || false;
}

/**
 * Export DayBook as a split T-Account PDF with Inflow (left) and Outflow (right)
 */
export async function exportDayBookPDF({ title, inflowRows, outflowRows, inflowColumns, outflowColumns, inflowTotals, outflowTotals, summary, dateRange, fileName }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  registerUrduFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const halfWidth = (pageWidth - 28 - 6) / 2; // 14px margin each side, 6px gap

  // ── Header (same as standard) ──
  doc.setFillColor(6, 6, 8);
  doc.rect(0, 0, pageWidth, 32, 'F');

  try {
    const logoDataUrl = await getLogoBase64(160);
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 4, 2, 28, 28);
  } catch (e) { }

  const textStartX = 34;
  const titleParts = title.split('—');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(titleParts[0].trim(), textStartX, 13);

  if (titleParts[1] && hasUrdu(titleParts[1])) {
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(180, 200, 220);
    doc.text(titleParts[1].trim(), pageWidth - 14, 13, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Rana Traders — Commission Shop', textStartX, 22);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(10);
  doc.text('رانا ٹریڈرز', pageWidth - 14, 22, { align: 'right' });

  if (dateRange) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(dateRange, pageWidth - 14, 28, { align: 'right' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-PK')}`, textStartX, 28);

  let yPos = 38;

  // ── Summary cards ──
  if (summary && summary.length > 0) {
    const cardWidth = (pageWidth - 28 - (summary.length - 1) * 6) / summary.length;
    summary.forEach((item, i) => {
      const x = 14 + i * (cardWidth + 6);
      doc.setFillColor(20, 20, 24);
      doc.roundedRect(x, yPos, cardWidth, 18, 2, 2, 'F');
      if (hasUrdu(item.label)) { doc.setFont('Amiri', 'normal'); } else { doc.setFont('helvetica', 'normal'); }
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(item.label, x + 4, yPos + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(241, 245, 249);
      doc.text(item.value, x + 4, yPos + 14);
    });
    yPos += 26;
  }

  // ── Section Headers ──
  const leftX = 14;
  const rightX = 14 + halfWidth + 6;

  // Left header — CREDIT / INFLOW (green)
  doc.setFillColor(20, 60, 40);
  doc.roundedRect(leftX, yPos, halfWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(52, 211, 153);
  doc.text('CREDIT / INFLOW — Sale & Payment In', leftX + 4, yPos + 7);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(8);
  doc.text('فروخت اور وصولی', leftX + halfWidth - 4, yPos + 7, { align: 'right' });

  // Right header — DEBIT / OUTFLOW (red)
  doc.setFillColor(60, 20, 20);
  doc.roundedRect(rightX, yPos, halfWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(248, 113, 113);
  doc.text('DEBIT / OUTFLOW — Purchase & Payment Out', rightX + 4, yPos + 7);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(8);
  doc.text('خریداری اور ادائیگی', rightX + halfWidth - 4, yPos + 7, { align: 'right' });

  yPos += 14;

  // ── Left Table (Inflow) ──
  const tableStyles = {
    fontSize: 7.5,
    cellPadding: 2.5,
    lineColor: [30, 41, 59],
    lineWidth: 0.1,
    textColor: [71, 85, 105],
    font: 'helvetica',
    overflow: 'linebreak',
  };

  const leftRows = inflowRows.length > 0 ? inflowRows : [['', '', '', '', 'No inflow entries']];
  autoTable(doc, {
    startY: yPos,
    head: [inflowColumns],
    body: leftRows,
    styles: { ...tableStyles },
    headStyles: { fillColor: [15, 40, 30], textColor: [52, 211, 153], fontSize: 7, fontStyle: 'bold', cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 253, 250] },
    margin: { left: leftX, right: pageWidth - leftX - halfWidth },
    tableWidth: halfWidth,
    didParseCell: (data) => {
      const cellText = getCellText(data);
      if (hasUrdu(cellText)) { data.cell.styles.font = 'Amiri'; data.cell.styles.fontSize = 8.5; }
      // Right-align amount column (last column)
      if (data.column.index === inflowColumns.length - 1 && data.section === 'body') {
        data.cell.styles.halign = 'right';
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [16, 150, 100];
      }
    },
  });

  const leftFinalY = doc.lastAutoTable.finalY;

  // ── Right Table (Outflow) ──
  const rightRows = outflowRows.length > 0 ? outflowRows : [['', '', '', '', 'No outflow entries']];
  autoTable(doc, {
    startY: yPos,
    head: [outflowColumns],
    body: rightRows,
    styles: { ...tableStyles },
    headStyles: { fillColor: [50, 15, 15], textColor: [248, 113, 113], fontSize: 7, fontStyle: 'bold', cellPadding: 3 },
    alternateRowStyles: { fillColor: [253, 248, 248] },
    margin: { left: rightX, right: 14 },
    tableWidth: halfWidth,
    didParseCell: (data) => {
      const cellText = getCellText(data);
      if (hasUrdu(cellText)) { data.cell.styles.font = 'Amiri'; data.cell.styles.fontSize = 8.5; }
      if (data.column.index === outflowColumns.length - 1 && data.section === 'body') {
        data.cell.styles.halign = 'right';
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [200, 50, 50];
      }
    },
  });

  const rightFinalY = doc.lastAutoTable.finalY;
  const maxY = Math.max(leftFinalY, rightFinalY);

  // ── Vertical Divider Line (gold) ──
  const dividerX = leftX + halfWidth + 3;
  doc.setDrawColor(212, 160, 23);
  doc.setLineWidth(0.6);
  doc.line(dividerX, yPos - 14, dividerX, maxY + 2);

  // ── Footer Totals ──
  const footerY = maxY + 4;

  // Left footer — Total Credit
  doc.setFillColor(20, 60, 40);
  doc.roundedRect(leftX, footerY, halfWidth, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(52, 211, 153);
  doc.text('Total Credit:', leftX + 4, footerY + 5);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(7.5);
  doc.text('کل جمع', leftX + 4, footerY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(inflowTotals.total, leftX + halfWidth - 4, footerY + 8, { align: 'right' });

  // Right footer — Total Debit
  doc.setFillColor(60, 20, 20);
  doc.roundedRect(rightX, footerY, halfWidth, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(248, 113, 113);
  doc.text('Total Debit:', rightX + 4, footerY + 5);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(7.5);
  doc.text('کل بنام', rightX + 4, footerY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(outflowTotals.total, rightX + halfWidth - 4, footerY + 8, { align: 'right' });

  // Sub-totals row
  const subY = footerY + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Sale: ${inflowTotals.sale}  |  Payment In: ${inflowTotals.paymentIn}`, leftX + 4, subY);
  doc.text(`Purchase: ${outflowTotals.purchase}  |  Payment Out: ${outflowTotals.paymentOut}`, rightX + 4, subY);

  // Page footer
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Rana Traders', 14, pageHeight - 4);
  doc.setFont('Amiri', 'normal');
  doc.text('رانا ٹریڈرز', 40, pageHeight - 4);
  doc.setFont('helvetica', 'normal');
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 4, { align: 'right' });

  const pdfOutput = doc.output('arraybuffer');
  const base64 = arrayBufferToBase64(pdfOutput);
  const baseName = fileName ? fileName.replace(/\.pdf$/i, '') : 'DayBook';
  const result = await window.api.saveFileDialog(
    `${baseName}.pdf`,
    [{ name: 'PDF Files', extensions: ['pdf'] }],
    base64
  );
  return result?.success || false;
}

/**
 * Auto-detect which columns contain numbers and right-align them
 */
function generateColumnStyles(columns, rows) {
  const styles = {};
  if (rows.length === 0) return styles;
  columns.forEach((col, i) => {
    const colLower = col.toLowerCase();
    const isAmount = colLower.includes('amount') || colLower.includes('total') || colLower.includes('balance') ||
      colLower.includes('paid') || colLower.includes('sale') || colLower.includes('purchase') ||
      colLower.includes('commission') || colLower.includes('rate') || colLower.includes('stock') ||
      colLower.includes('purchased') || colLower.includes('sold') || colLower.includes('opening');
    if (isAmount) {
      styles[i] = { halign: 'right', fontStyle: 'bold' };
    }
  });
  return styles;
}

/**
 * Export report data to XLSX (Excel) with professional formatting
 */
export async function exportToXLSX({ title, columns, rows, summary, dateRange, fileName }) {
  const wb = XLSX.utils.book_new();
  const wsData = [];

  // Title row
  wsData.push([title]);
  if (dateRange) wsData.push([dateRange]);
  wsData.push([]);

  // Summary
  if (summary && summary.length > 0) {
    summary.forEach(item => wsData.push([item.label, item.value]));
    wsData.push([]);
  }

  // Column headers
  wsData.push(columns);

  // Data rows
  rows.forEach(row => wsData.push(row));

  if (rows.length > 0) {
    wsData.push([]);
    wsData.push([`Total Rows: ${rows.length}`]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns
  const colWidths = columns.map((col, i) => {
    let maxLen = col.length;
    rows.forEach(row => {
      const cellLen = String(row[i] ?? '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    });
    return { wch: Math.min(Math.max(maxLen + 2, 10), 35) };
  });
  ws['!cols'] = colWidths;

  // Merge title cell
  if (columns.length > 1) {
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  // Generate XLSX as arraybuffer and show save dialog
  const xlsxOutput = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const base64 = arrayBufferToBase64(xlsxOutput);
  const baseName = fileName ? fileName.replace(/\.xlsx$/i, '') : 'report';
  const result = await window.api.saveFileDialog(
    `${baseName}.xlsx`,
    [{ name: 'Excel Files', extensions: ['xlsx'] }],
    base64
  );
  return result?.success || false;
}

/**
 * Export report data to CSV
 */
export async function exportToCSV({ columns, rows, fileName }) {
  const wb = XLSX.utils.book_new();
  const wsData = [columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  // Generate CSV as arraybuffer and show save dialog
  const csvOutput = XLSX.write(wb, { type: 'array', bookType: 'csv' });
  const base64 = arrayBufferToBase64(csvOutput);
  const baseName = fileName ? fileName.replace(/\.csv$/i, '') : 'report';
  const result = await window.api.saveFileDialog(
    `${baseName}.csv`,
    [{ name: 'CSV Files', extensions: ['csv'] }],
    base64
  );
  return result?.success || false;
}
