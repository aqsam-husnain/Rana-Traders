import React, { useState } from 'react';
import { formatPKR, formatNumber, formatDate, todayISO } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV, exportRokarPDF, exportGeneralLedgerPDF, exportProfitLossPDF, exportReceivablePayablePDF, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import SearchableSelect from '../components/SearchableSelect';
import { useToast } from '../components/Toast';
import { MdAccountBalance, MdBalance, MdInventory, MdAccountBalanceWallet, MdTrendingDown, MdTrendingUp, MdMoneyOff, MdMenuBook } from 'react-icons/md';
import { useShortcuts } from '../context/ShortcutContext';

const reportTypes = [
  { id: 'daily-sales',         name: 'Daily Sale Report',       urdu: 'یومیہ فروخت رپورٹ',   needsDate: true },
  { id: 'daily-purchases',     name: 'Daily Purchase Report',   urdu: 'یومیہ خریداری رپورٹ', needsDate: true },
  { id: 'commission',          name: 'Commission Report',       urdu: 'آڑت رپورٹ',       needsDate: true },
  { id: 'rokar-khata',         name: 'Rokar Khata Report',      urdu: 'روکڑ کھاتہ رپورٹ',  needsDate: true, custom: true },
  { id: 'stock',               name: 'Stock Report',            urdu: 'اسٹاک رپورٹ',        needsDate: false },
  { id: 'buyer-outstanding',   name: 'Receivable Report',       urdu: 'وصول رپورٹ',       needsAsOn: true },
  { id: 'supplier-outstanding',name: 'Payable Report',          urdu: 'واجبات رپورٹ',     needsAsOn: true },
  { id: 'profit-loss',         name: 'Profit & Loss',           urdu: 'نفع و نقصان',       needsDate: true, custom: true },
  { id: 'general-ledger',      name: 'General Ledger',          urdu: 'جنرل لیجر',         needsDate: true, custom: true, needsParty: true },
  { id: 'stock-valuation',     name: 'Daily Stock Valuation',   urdu: 'یومیہ اسٹاک قدر',   needsDate: true, custom: true, needsProduct: true },
  { id: 'balance-sheet',       name: 'Balance Sheet',           urdu: 'بیلنس شیٹ',         needsAsOn: true, custom: true },
  { id: 'trial-balance',       name: 'Trial Balance',           urdu: 'ٹرائل بیلنس',       needsAsOn: true, custom: true },
];

// Column configs for each report type — clean labels, proper alignment
const reportColumns = {
  'daily-sales': {
    columns: ['#', 'Date', 'Buyer', 'Product', 'Qty', 'Rate', 'Total', 'Commission', 'Net Amount', 'Mode'],
    extract: (data) => data.map((r, i) => [
      i + 1, formatDate(r.date), (r.buyer_name || '—') + (r.buyer_name_urdu ? '\n' + r.buyer_name_urdu : ''), r.product_name + (r.product_name_urdu ? '\n' + r.product_name_urdu : ''),
      formatNumber(r.quantity), formatPKR(r.rate), formatPKR(r.total),
      formatPKR(r.commission), formatPKR(r.net_amount), r.payment_mode
    ]),
    summary: (data) => [
      { label: 'Total Sales', value: formatPKR(data.reduce((s, r) => s + (r.net_amount || 0), 0)) },
      { label: 'Total Commission', value: formatPKR(data.reduce((s, r) => s + (r.commission || 0), 0)) },
      { label: 'Entries', value: String(data.length) },
    ],
    amountCols: [5, 6, 7, 8],
  },
  'daily-purchases': {
    columns: ['#', 'Date', 'Supplier', 'Product', 'Qty', 'Rate', 'Total', 'Commission', 'Net Amount', 'Mode'],
    extract: (data) => data.map((r, i) => [
      i + 1, formatDate(r.date), (r.supplier_name || '—') + (r.supplier_name_urdu ? '\n' + r.supplier_name_urdu : ''), r.product_name + (r.product_name_urdu ? '\n' + r.product_name_urdu : ''),
      formatNumber(r.quantity), formatPKR(r.rate), formatPKR(r.total),
      formatPKR(r.commission), formatPKR(r.net_amount), r.payment_mode
    ]),
    summary: (data) => [
      { label: 'Total Purchases', value: formatPKR(data.reduce((s, r) => s + (r.net_amount || 0), 0)) },
      { label: 'Total Commission', value: formatPKR(data.reduce((s, r) => s + (r.commission || 0), 0)) },
      { label: 'Entries', value: String(data.length) },
    ],
    amountCols: [5, 6, 7, 8],
  },
  'commission': {
    columns: ['#', 'Date', 'Type', 'Party', 'Product', 'Qty', 'Total', 'Commission'],
    extract: (data) => data.map((r, i) => [
      i + 1, formatDate(r.date), r.type, (r.party_name || '—') + (r.party_name_urdu ? '\n' + r.party_name_urdu : ''), r.product_name + (r.product_name_urdu ? '\n' + r.product_name_urdu : ''),
      formatNumber(r.quantity), formatPKR(r.total), formatPKR(r.commission)
    ]),
    summary: (data) => {
      const saleComm = data.filter(r => r.type === 'Sale').reduce((s, r) => s + (r.commission || 0), 0);
      const purchComm = data.filter(r => r.type === 'Purchase').reduce((s, r) => s + (r.commission || 0), 0);
      return [
        { label: 'Sale Commission', value: formatPKR(saleComm) },
        { label: 'Purchase Commission', value: formatPKR(purchComm) },
        { label: 'Total Commission', value: formatPKR(saleComm + purchComm) },
      ];
    },
    amountCols: [6, 7],
  },
  'stock': {
    columns: ['#', 'Product', 'Product (Urdu)', 'Unit', 'Opening Stock', 'Purchased', 'Sold', 'Available Stock'],
    extract: (data) => data.map((r, i) => [
      i + 1, r.name, r.name_urdu || '—', r.unit,
      formatNumber(r.opening_stock || 0), formatNumber(r.purchased), formatNumber(r.sold), formatNumber(r.stock)
    ]),
    summary: (data) => [
      { label: 'Total Products', value: String(data.length) },
      { label: 'Total Stock', value: formatNumber(data.reduce((s, r) => s + (r.stock || 0), 0)) },
    ],
    amountCols: [4, 5, 6, 7],
  },
  'buyer-outstanding': {
    columns: ['#', 'Buyer', 'Phone', 'Opening Bal.', 'Total Sales', 'Total Paid', 'Balance Due'],
    extract: (data) => data.map((r, i) => [
      i + 1, r.name + (r.name_urdu ? '\n' + r.name_urdu : ''), r.phone || '—', formatPKR(r.opening_balance),
      formatPKR(r.total_sales), formatPKR(r.total_paid), formatPKR(r.balance)
    ]),
    summary: (data) => [
      { label: 'Total Outstanding', value: formatPKR(data.reduce((s, r) => s + (r.balance || 0), 0)) },
      { label: 'Buyers', value: String(data.length) },
    ],
    amountCols: [3, 4, 5, 6],
  },
  'supplier-outstanding': {
    columns: ['#', 'Supplier', 'Phone', 'Opening Bal.', 'Total Purchases', 'Total Paid', 'Balance Due'],
    extract: (data) => data.map((r, i) => [
      i + 1, r.name + (r.name_urdu ? '\n' + r.name_urdu : ''), r.phone || '—', formatPKR(r.opening_balance),
      formatPKR(r.total_purchases), formatPKR(r.total_paid), formatPKR(r.balance)
    ]),
    summary: (data) => [
      { label: 'Total Payable', value: formatPKR(data.reduce((s, r) => s + (r.balance || 0), 0)) },
      { label: 'Suppliers', value: String(data.length) },
    ],
    amountCols: [3, 4, 5, 6],
  },
  'stock-valuation': {
    columns: ['#', 'Product', 'Unit', 'Open Kgs', 'Open Rate', 'Open Amt', 'Purch Kgs', 'Purch Rate', 'Purch Amt', 'Sale Kgs', 'Sale Rate', 'Sale Amt', 'Close Kgs', 'Close Rate', 'Close Amt'],
    extract: (data) => data.map((r, i) => [
      i + 1, r.name + (r.name_urdu ? '\n' + r.name_urdu : ''), r.unit,
      formatNumber(r.opening_qty), formatPKR(r.opening_rate), formatPKR(r.opening_value),
      formatNumber(r.purchased_qty), formatPKR(r.purchase_rate), formatPKR(r.purchased_value),
      formatNumber(r.sold_qty), formatPKR(r.sale_rate), formatPKR(r.sold_value),
      formatNumber(r.closing_qty), formatPKR(r.closing_rate), formatPKR(r.closing_value),
    ]),
    summary: (data) => [
      { label: 'Products', value: String(data.length) },
      { label: 'Total Closing Kgs', value: formatNumber(data.reduce((s, r) => s + (r.closing_qty || 0), 0)) },
      { label: 'Total Closing Value', value: formatPKR(data.reduce((s, r) => s + (r.closing_value || 0), 0)) },
    ],
    amountCols: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
};


export default function Reports() {
  const [selectedReport, setSelectedReport] = useState('');
  const [dateFrom, setDateFrom] = useState(todayISO().slice(0, 10));
  const [dateTo, setDateTo] = useState(todayISO().slice(0, 10));
  const [data, setData] = useState(null);
  const [partyType, setPartyType] = useState('Buyer');
  const [partyId, setPartyId] = useState('');
  const [buyers, setBuyers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const toast = useToast();
  const { registerPageHandlers, unregisterPageHandlers } = useShortcuts();

  // Register keyboard shortcuts for this page
  React.useEffect(() => {
    registerPageHandlers({
      'page.generate': () => generate(),
      'page.exportPdf': () => handleExport('pdf'),
      'page.exportXlsx': () => handleExport('xlsx'),
    });
    return () => unregisterPageHandlers();
  }, [selectedReport, data, dateFrom, dateTo, partyType, partyId, productId]);

  // Load buyers/suppliers/products for pickers
  React.useEffect(() => {
    window.api.getBuyers().then(b => setBuyers(b.filter(x => x.status === 'Active')));
    window.api.getSuppliers().then(s => setSuppliers(s.filter(x => x.status === 'Active')));
    window.api.getProducts().then(p => setProducts(p.filter(x => x.status === 'Active')));
  }, []);

  const generate = async () => {
    if (!selectedReport) return;
    if (selectedReport === 'rokar-khata') {
      const result = await window.api.getRokarReport({ dateFrom, dateTo });
      setData(result);
    } else if (selectedReport === 'general-ledger') {
      if (!partyId) { toast.error('Please select a party'); return; }
      const result = await window.api.getGeneralLedger(partyType, parseInt(partyId), { dateFrom, dateTo });
      setData(result);
    } else {
      const filters = { dateFrom, dateTo };
      if (selectedReport === 'stock-valuation' && productId) filters.productId = parseInt(productId);
      const result = await window.api.getReport(selectedReport, filters);
      setData(result);
    }
  };

  const currentType = reportTypes.find(r => r.id === selectedReport);
  const config = reportColumns[selectedReport];
  const isRokar = selectedReport === 'rokar-khata';
  const isLedger = selectedReport === 'general-ledger';

  const handleExport = async (format) => {
    if (!data || !currentType) return;
    const ts = fileTimestamp();
    const isArray = Array.isArray(data);
    const rows = isArray && config ? config.extract(data) : [];
    const summary = isArray && config?.summary ? config.summary(data) : [];
    let dateRange = currentType.needsDate ? `${formatDate(dateFrom)} — ${formatDate(dateTo)}` : (currentType.needsAsOn ? `As On: ${formatDate(dateTo)}` : '');
    const fileBase = `${currentType.name.replace(/[^a-zA-Z0-9]/g, '_')}_${ts}`;
    let title = `${currentType.name} — ${currentType.urdu}`;
    let exportRows = rows, exportCols = config?.columns || [], exportSummary = summary, highlightSet = null;

    // Build custom export for Rokar Khata
    if (isRokar && data?.entries) {
      const jama   = data.entries.filter(e => e.type === 'Walk-in Sale'     || e.type === 'Cash Received');
      const kharch = data.entries.filter(e => e.type === 'Walk-in Purchase' || e.type === 'Cash Paid' || e.type === 'Expense');
      const inflowCols  = ['#', 'Date', 'Type', 'Party / Detail', 'Amount'];
      const outflowCols = ['#', 'Date', 'Type', 'Party / Detail', 'Amount'];
      const inflowR  = jama.map((e, i)   => [i + 1,               formatDate(e.date), e.type, e.party_name || e.product_name || '—', formatPKR(e.amount)]);
      const outflowR = kharch.map((e, i) => [i + 1,               formatDate(e.date), e.type, e.party_name || e.product_name || '—', formatPKR(e.amount)]);

      if (format === 'pdf') {
        const saved = await exportRokarPDF({
          title: 'Rokar Khata Report — روکڑ کھاتہ رپورٹ',
          inflowColumns: inflowCols,
          outflowColumns: outflowCols,
          inflowRows: inflowR,
          outflowRows: outflowR,
          inflowTotal:  formatPKR(data.periodTotalIn),
          outflowTotal: formatPKR(data.periodTotalOut),
          openingBalance: formatPKR(data.periodOpeningBalance),
          closingBalance: formatPKR(data.periodClosingBalance),
          summary: [
            { label: 'ابتدائی بیلنس — Opening', value: formatPKR(data.periodOpeningBalance) },
            { label: 'کل جمع — Cash In',         value: formatPKR(data.periodTotalIn) },
            { label: 'کل خرچ — Cash Out',        value: formatPKR(data.periodTotalOut) },
            { label: 'اختتامی بیلنس — Closing',  value: formatPKR(data.periodClosingBalance) },
          ],
          dateRange: `${formatDate(dateFrom)} — ${formatDate(dateTo)}`,
          fileName: `RokarKhata_Report_${ts}.pdf`,
        });
        if (saved) toast.success('File exported successfully!');
      } else {
        const cols = ['#', 'Date', 'Flow', 'Type', 'Party / Detail', 'Amount'];
        const allRows = [
          ...inflowR.map(r  => [r[0], r[1], 'جمع (In)',   r[2], r[3], r[4]]),
          ...outflowR.map(r => [r[0], r[1], 'خرچ (Out)', r[2], r[3], r[4]]),
        ];
        const expData = {
          title: 'Rokar Khata Report — روکڑ کھاتہ رپورٹ',
          columns: cols, rows: allRows,
          summary: [
            { label: 'Opening Balance', value: formatPKR(data.periodOpeningBalance) },
            { label: 'Total Cash In',   value: formatPKR(data.periodTotalIn) },
            { label: 'Total Cash Out',  value: formatPKR(data.periodTotalOut) },
            { label: 'Closing Balance', value: formatPKR(data.periodClosingBalance) },
          ],
          dateRange: `${formatDate(dateFrom)} — ${formatDate(dateTo)}`,
        };
        let saved = false;
        if (format === 'xlsx') saved = await exportToXLSX({ ...expData, fileName: `RokarKhata_Report_${ts}.xlsx` });
        else if (format === 'csv') saved = await exportToCSV({ ...expData, fileName: `RokarKhata_Report_${ts}.csv` });
        if (saved) toast.success('File exported successfully!');
      }
      return;
    }

    // Build custom export rows for non-array reports
    if (selectedReport === 'profit-loss' && data.revenue) {
      exportCols = ['Account Description / اکاؤنٹ', 'Amount / رقم'];
      const hl = new Set();
      exportRows = []; hl.add(0); exportRows.push(['Revenue — آمدنی', '']);
      if (data.revenue.items.length) {
        hl.add(exportRows.length); exportRows.push(['  Products Sale A/c', '']);
        data.revenue.items.forEach(r => exportRows.push(['    ' + r.name + (r.name_urdu ? ' / ' + r.name_urdu : ''), formatPKR(r.amount)]));
        exportRows.push(['', formatPKR(data.revenue.total)]);
      }
      hl.add(exportRows.length); exportRows.push(['Revenue', formatPKR(data.revenue.total)]);
      exportRows.push(['', '']);
      hl.add(exportRows.length); exportRows.push(['Expense — اخراجات', '']);
      if (data.businessExpenses.items.length) {
        hl.add(exportRows.length); exportRows.push(['  Business Expenses — کاروباری اخراجات', '']);
        data.businessExpenses.items.forEach(e => exportRows.push(['    ' + e.name, formatPKR(e.amount)]));
        exportRows.push(['', formatPKR(data.businessExpenses.total)]);
      }
      if (data.cogs.items.length) {
        hl.add(exportRows.length); exportRows.push(['  Products COGs A/c — لاگت کھاتے', '']);
        data.cogs.items.forEach(c => exportRows.push(['    ' + c.name + (c.name_urdu ? ' / ' + c.name_urdu : ''), formatPKR(c.amount)]));
        exportRows.push(['', formatPKR(data.cogs.total)]);
      }
      hl.add(exportRows.length); exportRows.push(['Expense', formatPKR(data.totalExpense)]);
      exportRows.push(['', '']);
      hl.add(exportRows.length); exportRows.push([data.netProfit >= 0 ? 'Net Profit — خالص نفع' : 'Net Loss — خالص نقصان', formatPKR(Math.abs(data.netProfit))]);
      highlightSet = hl;
      exportSummary = [
        { label: 'Revenue', value: formatPKR(data.revenue.total) },
        { label: 'Expense', value: formatPKR(data.totalExpense) },
        { label: 'Net Profit', value: formatPKR(data.netProfit) },
      ];
    } else if (selectedReport === 'general-ledger' && data.party) {
      const s = data.summary;
      exportCols = ['Date', 'Voucher #', 'Particulars', 'Debit / بنام', 'Credit / جمع', 'Balance / بقایا'];
      exportRows = [['', '', 'Opening Balance', s.openingDr > 0 ? formatPKR(s.openingDr) : '0', s.openingCr > 0 ? formatPKR(s.openingCr) : '0', formatPKR(Math.abs(s.openingDr - s.openingCr)) + ' ' + (s.openingDr >= s.openingCr ? 'Dr' : 'Cr')]];
      data.entries.forEach(e => exportRows.push([formatDate(e.date), e.voucher, e.particulars, e.debit > 0 ? formatPKR(e.debit) : '0', e.credit > 0 ? formatPKR(e.credit) : '0', formatPKR(e.balance) + ' ' + e.balanceType]));
      exportRows.push(['', '', 'Total', formatPKR(s.totalDr), formatPKR(s.totalCr), formatPKR(s.closingBalance) + ' ' + s.closingType]);
      highlightSet = new Set([0, exportRows.length - 1]);
      exportSummary = [
        { label: 'Opening Dr', value: formatPKR(s.openingDr) },
        { label: 'Opening Cr', value: formatPKR(s.openingCr) },
        { label: 'Transaction Dr', value: formatPKR(s.transactionDr) },
        { label: 'Transaction Cr', value: formatPKR(s.transactionCr) },
        { label: 'Balance', value: formatPKR(s.closingBalance) + ' ' + s.closingType },
      ];
      const partyName = data.party.name + (data.party.name_urdu ? ' — ' + data.party.name_urdu : '');
      title = `General Ledger — ${partyName}`;
      dateRange = `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;
    } else if (selectedReport === 'balance-sheet' && data.assets) {
      exportCols = ['Account Description / اکاؤنٹ', 'Amount / رقم'];
      const hl = new Set();
      exportRows = [['— ASSETS —', '']]; hl.add(0);
      if (data.assets.customers.length) {
        hl.add(exportRows.length); exportRows.push(['  Customers', '']);
        data.assets.customers.forEach(c => exportRows.push(['    ' + c.name, formatPKR(c.amount)]));
        exportRows.push(['  Sub-Total :', formatPKR(data.assets.customerTotal)]);
      }
      hl.add(exportRows.length); exportRows.push(['  Cash A/c', '']);
      data.assets.cash.forEach(c => exportRows.push(['    ' + c.name, formatPKR(c.amount)]));
      exportRows.push(['  Sub-Total :', formatPKR(data.assets.cashTotal)]);
      if (data.assets.stocks.length) {
        hl.add(exportRows.length); exportRows.push(['  Products Stock A/c', '']);
        data.assets.stocks.forEach(s => exportRows.push(['    ' + s.name, formatPKR(s.value)]));
        exportRows.push(['  Sub-Total :', formatPKR(data.assets.stockTotal)]);
      }
      hl.add(exportRows.length); exportRows.push(['Total Assets', formatPKR(data.assets.total)]);
      exportRows.push(['', '']);
      hl.add(exportRows.length); exportRows.push(['— LIABILITIES —', '']);
      if (data.liabilities.customers.length) {
        hl.add(exportRows.length); exportRows.push(['  Customers', '']);
        data.liabilities.customers.forEach(c => exportRows.push(['    ' + c.name, formatPKR(c.amount)]));
        exportRows.push(['  Sub-Total :', formatPKR(data.liabilities.customerTotal)]);
      }
      if (data.liabilities.stocks.length) {
        hl.add(exportRows.length); exportRows.push(['  Products Stock A/c', '']);
        data.liabilities.stocks.forEach(s => exportRows.push(['    ' + s.name, formatPKR(Math.abs(s.value))]));
        exportRows.push(['  Sub-Total :', formatPKR(data.liabilities.stockTotal)]);
      }
      hl.add(exportRows.length); exportRows.push(["  Equity Capital", '']);
      exportRows.push(["    Owner's Equity", formatPKR(data.liabilities.equity)]);
      hl.add(exportRows.length); exportRows.push(['  Profit / Loss', formatPKR(data.liabilities.profitLoss)]);
      hl.add(exportRows.length); exportRows.push(['Total Liabilities', formatPKR(data.liabilities.total)]);
      highlightSet = hl;
      exportSummary = [
        { label: 'Total Assets', value: formatPKR(data.assets.total) },
        { label: 'Total Liabilities', value: formatPKR(data.liabilities.total) },
      ];
    } else if (selectedReport === 'trial-balance' && data.groups) {
      exportCols = ['#', 'Account', 'Closing Dr', 'Closing Cr'];
      const hl = new Set();
      let num = 0;
      data.groups.forEach(g => {
        hl.add(exportRows.length); exportRows.push(['', g.group, '', '']);
        g.accounts.forEach(a => { num++; exportRows.push([num, a.name, a.debit > 0 ? formatPKR(a.debit) : '0', a.credit > 0 ? formatPKR(a.credit) : '0']); });
        exportRows.push(['', '', formatPKR(g.subtotalDebit), formatPKR(g.subtotalCredit)]);
      });
      hl.add(exportRows.length); exportRows.push(['', '*** Grand Total ***', formatPKR(data.totalDebit), formatPKR(data.totalCredit)]);
      highlightSet = hl;
      exportSummary = [
        { label: 'Total Debit', value: formatPKR(data.totalDebit) },
        { label: 'Total Credit', value: formatPKR(data.totalCredit) },
        { label: 'Difference', value: formatPKR(Math.abs(data.totalDebit - data.totalCredit)) },
      ];
    }

    const exportData = { title, titleUrdu: currentType.urdu, columns: exportCols, rows: exportRows, summary: exportSummary, dateRange };
    let saved = false;
    if (format === 'pdf') {
      // Use specialized PDF export for specific report types
      if (selectedReport === 'general-ledger' && data.party) {
        saved = await exportGeneralLedgerPDF({ party: data.party, entries: data.entries, summary: data.summary, dateRange: `${formatDate(dateFrom)} To: ${formatDate(dateTo)}`, fileName: `${fileBase}` });
      } else if (selectedReport === 'profit-loss' && data.revenue) {
        saved = await exportProfitLossPDF({ data, dateRange: `${formatDate(dateFrom)} To: ${formatDate(dateTo)}`, fileName: `${fileBase}` });
      } else if ((selectedReport === 'buyer-outstanding' || selectedReport === 'supplier-outstanding') && Array.isArray(data)) {
        saved = await exportReceivablePayablePDF({ data, reportType: selectedReport, asOnDate: formatDate(dateTo), fileName: `${fileBase}` });
      } else {
        saved = await exportToPDF({ ...exportData, fileName: `${fileBase}.pdf`, highlightRows: highlightSet });
      }
    }
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `${fileBase}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `${fileBase}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  const renderRokarReport = () => {
    if (!data || !data.entries) return null;

    const getTypeBadge = (type) => {
      if (type === 'Walk-in Sale')     return { label: 'Walk-in Sale',     color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)' };
      if (type === 'Cash Received')    return { label: 'Cash Received',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)' };
      if (type === 'Walk-in Purchase') return { label: 'Walk-in Purchase', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' };
      if (type === 'Cash Paid')        return { label: 'Cash Paid',        color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)' };
      if (type === 'Expense')          return { label: 'Expense',          color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' };
      return { label: type, color: 'var(--text-muted)', bg: 'transparent', border: 'var(--border)' };
    };

    const jama   = data.entries.filter(e => e.type === 'Walk-in Sale'     || e.type === 'Cash Received');
    const kharch = data.entries.filter(e => e.type === 'Walk-in Purchase' || e.type === 'Cash Paid' || e.type === 'Expense');
    const balance = data.periodClosingBalance;

    const entryRow = (e, i) => {
      const b = getTypeBadge(e.type);
      return (
        <tr key={i}>
          <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{i + 1}</td>
          <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{formatDate(e.date)}</td>
          <td>
            <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 5, fontSize: '0.65rem', fontWeight: 600, color: b.color, background: b.bg, border: `1px solid ${b.border}` }}>
              {b.label}
            </span>
          </td>
          <td style={{ fontSize: '0.82rem' }}>
            {e.party_name || '—'}
            {e.product_name && e.product_name !== e.party_name && (
              <><br /><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e.product_name}</span></>
            )}
          </td>
          <td className="amount" style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(e.amount)}</td>
        </tr>
      );
    };

    return (
      <>
        {/* Summary Cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(212,160,23,0.12)', color: 'var(--accent)' }}><MdAccountBalanceWallet /></div>
            <div className="stat-info">
              <h3>ابتدائی بیلنس — Opening</h3>
              <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1rem' }}>{formatPKR(data.periodOpeningBalance)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><MdTrendingDown /></div>
            <div className="stat-info">
              <h3>کل جمع — Cash In</h3>
              <div className="stat-value" style={{ color: 'var(--green)', fontSize: '1rem' }}>{formatPKR(data.periodTotalIn)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><MdTrendingUp /></div>
            <div className="stat-info">
              <h3>کل خرچ — Cash Out</h3>
              <div className="stat-value" style={{ color: 'var(--red)', fontSize: '1rem' }}>{formatPKR(data.periodTotalOut)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: balance >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>💰</div>
            <div className="stat-info">
              <h3>اختتامی بیلنس — Closing</h3>
              <div className="stat-value" style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '1rem' }}>{formatPKR(Math.abs(balance))}{balance < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Deficit)</span>}</div>
            </div>
          </div>
        </div>

        {/* T-Account Table */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, marginBottom: 20 }}>
          {/* ── جمع (Cash In) ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRight: 'none', borderRadius: '12px 0 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdTrendingDown style={{ color: 'var(--green)', fontSize: '1.1rem' }} />
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--green)' }}>جمع — Cash In</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--green)' }}>{formatPKR(data.periodTotalIn)}</span>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid rgba(52,211,153,0.15)', borderRight: 'none', borderTop: 'none', borderRadius: '0 0 0 12px', overflow: 'auto' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Party / Detail</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {jama.length > 0 ? jama.map((e, i) => entryRow(e, i)) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No cash inflow — کوئی جمع نہیں</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 3, background: 'linear-gradient(to bottom, rgba(212,160,23,0.05), rgba(212,160,23,0.5), rgba(212,160,23,0.05))', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: 10, height: 10, background: 'var(--accent)', borderRadius: 2 }} />
          </div>

          {/* ── خرچ (Cash Out) ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderLeft: 'none', borderRadius: '0 12px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdTrendingUp style={{ color: 'var(--red)', fontSize: '1.1rem' }} />
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--red)' }}>خرچ — Cash Out</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--red)' }}>{formatPKR(data.periodTotalOut)}</span>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid rgba(248,113,113,0.15)', borderLeft: 'none', borderTop: 'none', borderRadius: '0 0 12px 0', overflow: 'auto' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Party / Detail</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {kharch.length > 0 ? kharch.map((e, i) => entryRow(e, i)) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No cash outflow — کوئی خرچ نہیں</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Closing Balance Banner */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', borderRadius: 14,
          background: balance >= 0 ? 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.04))' : 'linear-gradient(135deg, rgba(248,113,113,0.1), rgba(248,113,113,0.04))',
          border: `1px solid ${balance >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.8rem' }}>💰</span>
            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 2 }}>اختتامی بیلنس — Period Closing Balance</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {balance < 0 ? '−' : ''}{formatPKR(Math.abs(balance))}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 2 }}>
            <div>Opening: <strong style={{ color: 'var(--accent)' }}>{formatPKR(data.periodOpeningBalance)}</strong></div>
            <div>+ Cash In: <strong style={{ color: 'var(--green)' }}>{formatPKR(data.periodTotalIn)}</strong></div>
            <div>− Cash Out: <strong style={{ color: 'var(--red)' }}>{formatPKR(data.periodTotalOut)}</strong></div>
          </div>
        </div>

        {data.entries.length === 0 && (
          <div className="empty-state" style={{ padding: '40px 20px', marginTop: 16 }}>
            <p>No cash transactions in this date range</p>
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Try adjusting the date range</p>
          </div>
        )}
      </>
    );
  };

  const renderProfitLoss = () => {
    if (!data || Array.isArray(data) || !data.revenue) return null;
    const sectionStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 0, overflow: 'hidden', marginBottom: 20 };
    const sectionHeader = (label, isExpense) => (
      <div style={{ padding: '12px 20px', fontWeight: 800, fontSize: '0.95rem', textDecoration: 'underline', color: isExpense ? 'var(--red)' : 'var(--green)', background: isExpense ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)', borderBottom: '1px solid var(--border)' }}>{label}</div>
    );
    const subHeader = (label) => (
      <div style={{ padding: '8px 20px 4px 30px', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'underline', color: 'var(--text-primary)' }}>{label}</div>
    );
    const itemRow = (item) => (
      <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 20px 4px 50px', fontSize: '0.84rem', borderBottom: '1px solid var(--border-light)' }}>
        <span>{item.name}{item.name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.name_urdu}</span></> : ''}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatPKR(item.amount)}</span>
      </div>
    );
    const subtotalRow = (val) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 20px', fontWeight: 700, fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--text-muted)', paddingTop: 2 }}>{formatPKR(val)}</span>
      </div>
    );
    const totalBar = (label, val, color) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontWeight: 800, fontSize: '0.9rem', background: 'var(--glass)', borderTop: '2px solid var(--border)', color }}>
        <span>{label}</span><span>{formatPKR(val)}</span>
      </div>
    );
    const np = data.netProfit;
    return (
      <>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-icon green">₨</div><div className="stat-info"><h3>Revenue — آمدنی</h3><div className="stat-value" style={{ color: 'var(--green)' }}>{formatPKR(data.revenue.total)}</div></div></div>
          <div className="stat-card"><div className="stat-icon red">₨</div><div className="stat-info"><h3>Expense — اخراجات</h3><div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(data.totalExpense)}</div></div></div>
          <div className="stat-card"><div className={`stat-icon ${np >= 0 ? 'green' : 'red'}`}>±</div><div className="stat-info"><h3>Net Profit — خالص نفع</h3><div className="stat-value" style={{ color: np >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPKR(np)}</div></div></div>
        </div>
        <div style={sectionStyle}>
          {sectionHeader('Revenue — آمدنی', false)}
          {data.revenue.items.length > 0 && subHeader('Products Sale A/c — فروخت کھاتے')}
          {data.revenue.items.map(r => itemRow(r))}
          {data.revenue.items.length > 0 && subtotalRow(data.revenue.total)}
          {totalBar('Revenue — آمدنی', data.revenue.total, 'var(--green)')}
        </div>
        <div style={sectionStyle}>
          {sectionHeader('Expense — اخراجات', true)}
          {data.businessExpenses.items.length > 0 && subHeader('Business Expenses — کاروباری اخراجات')}
          {data.businessExpenses.items.map(e => itemRow(e))}
          {data.businessExpenses.items.length > 0 && subtotalRow(data.businessExpenses.total)}
          {data.cogs.items.length > 0 && subHeader('Products COGs A/c — لاگت کھاتے')}
          {data.cogs.items.map(c => itemRow(c))}
          {data.cogs.items.length > 0 && subtotalRow(data.cogs.total)}
          {totalBar('Expense — اخراجات', data.totalExpense, 'var(--red)')}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '16px 22px', borderRadius: 14,
          background: np >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
          border: `1px solid ${np >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
          fontWeight: 800, fontSize: '1.1rem', color: np >= 0 ? 'var(--green)' : 'var(--red)'
        }}>
          <span>{np >= 0 ? 'Net Profit — خالص نفع' : 'Net Loss — خالص نقصان'}</span>
          <span>{formatPKR(Math.abs(np))}</span>
        </div>
      </>
    );
  };

  /* ═══ Balance Sheet Renderer ═══ */
  const renderBalanceSheet = () => {
    if (!data || !data.assets) return null;
    const balanced = Math.abs(data.assets.total - data.liabilities.total) < 0.01;
    const sectionStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 0, overflow: 'hidden' };
    const catHeader = (label) => (<div style={{ padding: '10px 20px', fontWeight: 800, fontSize: '0.88rem', background: 'linear-gradient(90deg, rgba(212,160,23,0.12), transparent)', borderBottom: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', color: 'var(--accent)', textDecoration: 'underline', letterSpacing: '0.02em' }}>{label}</div>);
    const itemRow = (item) => (<div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 20px 6px 40px', fontSize: '0.84rem', borderBottom: '1px solid var(--border-light)' }}><span>{item.name}{item.name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.name_urdu}</span></> : ''}</span><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatPKR(item.amount || item.value)}</span></div>);
    const subTotalRow = (val) => (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px', fontWeight: 700, fontSize: '0.85rem', background: 'var(--glass)', borderBottom: '1px solid var(--border)' }}><span>Sub-Total :</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPKR(val)}</span></div>);
    const totalRow = (label, val, color) => (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', fontWeight: 800, fontSize: '0.95rem', color, background: 'var(--glass)', borderTop: '2px solid var(--border)' }}><span>{label}</span><span>{formatPKR(val)}</span></div>);

    return (
      <>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-icon green"><MdAccountBalance /></div><div className="stat-info"><h3>Total Assets — کل اثاثے</h3><div className="stat-value" style={{ color: 'var(--green)' }}>{formatPKR(data.assets.total)}</div></div></div>
          <div className="stat-card"><div className="stat-icon red"><MdBalance /></div><div className="stat-info"><h3>Total Liabilities — کل واجبات</h3><div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(data.liabilities.total)}</div></div></div>
          <div className="stat-card"><div className="stat-icon amber">%</div><div className="stat-info"><h3>Commission — آڑت</h3><div className="stat-value">{formatPKR(data.commissionEarned)}</div></div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, marginBottom: 24 }}>
          {/* ASSETS */}
          <div style={sectionStyle}>
            <div style={{ padding: '14px 20px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--green)', background: 'rgba(52,211,153,0.08)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
              <MdAccountBalance style={{ fontSize: '1.2rem' }} /> ASSETS — <span className="urdu" style={{ fontSize: '0.85rem' }}>اثاثے</span>
            </div>
            {data.assets.customers.length > 0 && catHeader('Customers — گاہک')}
            {data.assets.customers.map(c => itemRow(c))}
            {data.assets.customers.length > 0 && subTotalRow(data.assets.customerTotal)}
            {catHeader('Cash A/c — نقد')}
            {data.assets.cash.map(c => itemRow(c))}
            {subTotalRow(data.assets.cashTotal)}
            {data.assets.stocks.length > 0 && catHeader('Products Stock A/c — اسٹاک')}
            {data.assets.stocks.map(s => itemRow(s))}
            {data.assets.stocks.length > 0 && subTotalRow(data.assets.stockTotal)}
            {totalRow('Total Assets — کل اثاثے', data.assets.total, 'var(--green)')}
          </div>
          <div style={{ width: 3, background: 'linear-gradient(to bottom, rgba(212,160,23,0.05), rgba(212,160,23,0.4), rgba(212,160,23,0.05))', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: 12, height: 12, background: 'var(--accent)', borderRadius: 2, boxShadow: '0 0 12px rgba(212,160,23,0.4)' }} />
          </div>
          {/* LIABILITIES */}
          <div style={sectionStyle}>
            <div style={{ padding: '14px 20px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--red)', background: 'rgba(248,113,113,0.08)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
              <MdBalance style={{ fontSize: '1.2rem' }} /> LIABILITIES — <span className="urdu" style={{ fontSize: '0.85rem' }}>واجبات</span>
            </div>
            {data.liabilities.customers.length > 0 && catHeader('Customers — گاہک')}
            {data.liabilities.customers.map(c => itemRow(c))}
            {data.liabilities.customers.length > 0 && subTotalRow(data.liabilities.customerTotal)}
            {data.liabilities.stocks.length > 0 && catHeader('Products Stock A/c — اسٹاک')}
            {data.liabilities.stocks.map(s => itemRow(s))}
            {data.liabilities.stocks.length > 0 && subTotalRow(data.liabilities.stockTotal)}
            {catHeader('Equity Capital — ایکویٹی سرمایہ')}
            {itemRow({ name: "Owner's Equity", name_urdu: 'مالک کی ایکویٹی', amount: data.liabilities.equity })}
            {subTotalRow(data.liabilities.equity)}
            {catHeader('Profit / Loss — نفع نقصان')}
            {itemRow({ name: 'Profit / Loss', name_urdu: 'نفع نقصان', amount: data.liabilities.profitLoss })}
            {subTotalRow(data.liabilities.profitLoss)}
            {totalRow('Total Liabilities — کل واجبات', data.liabilities.total, 'var(--red)')}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 10, background: balanced ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${balanced ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: balanced ? 'var(--green)' : 'var(--red)' }}>
            {balanced ? '✓ Balance Sheet is Balanced — بیلنس شیٹ متوازن ہے' : '✗ Balance Sheet is NOT Balanced — بیلنس شیٹ غیر متوازن ہے'}
          </span>
        </div>
      </>
    );
  };

  /* ═══ Trial Balance Renderer (grouped) ═══ */
  const renderTrialBalance = () => {
    if (!data || !data.groups) return null;
    const diff = Math.abs(data.totalDebit - data.totalCredit);
    const balanced = diff < 0.01;
    let rowNum = 0;
    return (
      <>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-icon green">Dr</div><div className="stat-info"><h3>Total Debit — کل ڈیبٹ</h3><div className="stat-value" style={{ color: 'var(--green)' }}>{formatPKR(data.totalDebit)}</div></div></div>
          <div className="stat-card"><div className="stat-icon red">Cr</div><div className="stat-info"><h3>Total Credit — کل کریڈٹ</h3><div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(data.totalCredit)}</div></div></div>
          <div className="stat-card"><div className={`stat-icon ${balanced ? 'green' : 'red'}`}>Δ</div><div className="stat-info"><h3>Difference — فرق</h3><div className="stat-value" style={{ color: balanced ? 'var(--green)' : 'var(--red)' }}>{balanced ? 'Balanced ✓' : formatPKR(diff)}</div></div></div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Account Name — <span className="urdu">اکاؤنٹ</span></th>
                <th style={{ textAlign: 'right' }}>Closing Dr</th>
                <th style={{ textAlign: 'right' }}>Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g, gi) => (
                <React.Fragment key={gi}>
                  <tr><td colSpan={4} style={{ fontWeight: 800, fontSize: '0.9rem', background: 'linear-gradient(90deg, rgba(212,160,23,0.12), transparent)', padding: '10px 16px', borderBottom: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', color: 'var(--accent)', letterSpacing: '0.02em' }}>{g.group} — <span className="urdu">{g.group_urdu}</span></td></tr>
                  {g.accounts.map((a, ai) => { rowNum++; return (
                    <tr key={ai}>
                      <td style={{ color: 'var(--text-muted)', paddingLeft: 20 }}>{rowNum}</td>
                      <td style={{ paddingLeft: 30 }}>{a.name}{a.name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.name_urdu}</span></> : ''}</td>
                      <td className="amount" style={{ textAlign: 'right', fontWeight: 600, color: a.debit > 0 ? 'var(--green)' : 'var(--text-muted)' }}>{a.debit > 0 ? formatPKR(a.debit) : '0'}</td>
                      <td className="amount" style={{ textAlign: 'right', fontWeight: 600, color: a.credit > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{a.credit > 0 ? formatPKR(a.credit) : '0'}</td>
                    </tr>
                  );})}
                  <tr style={{ background: 'var(--glass)' }}>
                    <td></td><td style={{ fontWeight: 700, fontSize: '0.84rem' }}></td>
                    <td className="amount" style={{ textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)', color: 'var(--green)' }}>{formatPKR(g.subtotalDebit)}</td>
                    <td className="amount" style={{ textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)', color: 'var(--red)' }}>{formatPKR(g.subtotalCredit)}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--glass)' }}>
                <td></td>
                <td style={{ fontWeight: 800, fontSize: '0.9rem' }}>*** Grand Total *** — <span className="urdu">کل</span></td>
                <td className="amount" style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: 'var(--green)', borderTop: '2px solid var(--border)' }}>{formatPKR(data.totalDebit)}</td>
                <td className="amount" style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: 'var(--red)', borderTop: '2px solid var(--border)' }}>{formatPKR(data.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 10, marginTop: 16, background: balanced ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${balanced ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: balanced ? 'var(--green)' : 'var(--red)' }}>
            {balanced ? '✓ Trial Balance Matches — ٹرائل بیلنس متوازن ہے' : `✗ Difference of ${formatPKR(diff)} — فرق ${formatPKR(diff)}`}
          </span>
        </div>
      </>
    );
  };

  const renderTableReport = () => {
    if (!data || !Array.isArray(data) || !config) return null;
    if (data.length === 0) return <div className="empty-state"><p>No data found for the selected criteria</p></div>;

    const rows = config.extract(data);
    const summary = config.summary ? config.summary(data) : [];

    return (
      <>
        {/* Summary cards */}
        {summary.length > 0 && (
          <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${Math.min(summary.length, 4)}, 1fr)`, marginBottom: 20 }}>
            {summary.map((s, i) => (
              <div className="stat-card" key={i}>
                <div className="stat-info">
                  <h3>{s.label}</h3>
                  <div className="stat-value">{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Data table */}
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {config.columns.map((col, i) => (
                  <th key={i} style={config.amountCols?.includes(i) ? { textAlign: 'right' } : {}}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}
                      className={config.amountCols?.includes(ci) ? 'amount' : ''}
                      style={config.amountCols?.includes(ci) ? { textAlign: 'right', fontWeight: 600 } : {}}
                    >
                      {/* Urdu column gets RTL */}
                      {config.columns[ci]?.includes('Urdu') ? (
                        <span className="urdu">{cell}</span>
                      ) : typeof cell === 'string' && cell.includes('\n') ? (
                        <>{cell.split('\n')[0]}<br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cell.split('\n')[1]}</span></>
                      ) : (
                        cell ?? '—'
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  /* ═══ General Ledger Renderer ═══ */
  const renderGeneralLedger = () => {
    if (!data || !data.party) return null;
    const s = data.summary;
    const openBal = s.openingDr - s.openingCr;
    return (
      <>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{data.party.name}{data.party.name_urdu ? <span className="urdu" style={{ marginLeft: 12, fontSize: '0.95rem', color: 'var(--text-muted)' }}>{data.party.name_urdu}</span> : ''}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{data.party.phone || ''} {data.party.address ? ' — ' + data.party.address : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Closing Balance</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.closingType === 'Dr' ? 'var(--green)' : 'var(--red)' }}>{formatPKR(s.closingBalance)} {s.closingType}</div>
            </div>
          </div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher #</th>
                <th>Particulars</th>
                <th style={{ textAlign: 'right' }}>Debit / <span className="urdu">بنام</span></th>
                <th style={{ textAlign: 'right' }}>Credit / <span className="urdu">جمع</span></th>
                <th style={{ textAlign: 'right' }}>Balance / <span className="urdu">بقایا</span></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: 'var(--glass)', fontWeight: 700 }}>
                <td></td><td></td>
                <td>Opening Balance</td>
                <td className="amount" style={{ textAlign: 'right' }}>{s.openingDr > 0 ? formatPKR(s.openingDr) : '0.00'}</td>
                <td className="amount" style={{ textAlign: 'right' }}>{s.openingCr > 0 ? formatPKR(s.openingCr) : '0.00'}</td>
                <td className="amount" style={{ textAlign: 'right', color: openBal >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPKR(Math.abs(openBal))} {openBal >= 0 ? 'Dr' : 'Cr'}</td>
              </tr>
              {data.entries.map((e, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{formatDate(e.date)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.voucher}</td>
                  <td style={{ fontSize: '0.82rem' }}>{e.particulars}</td>
                  <td className="amount" style={{ textAlign: 'right', fontWeight: 600, color: e.debit > 0 ? 'var(--green)' : 'var(--text-muted)' }}>{e.debit > 0 ? formatPKR(e.debit) : '0.00'}</td>
                  <td className="amount" style={{ textAlign: 'right', fontWeight: 600, color: e.credit > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{e.credit > 0 ? formatPKR(e.credit) : '0.00'}</td>
                  <td className="amount" style={{ textAlign: 'right', fontWeight: 700, color: e.balanceType === 'Dr' ? 'var(--green)' : 'var(--red)' }}>{formatPKR(e.balance)} {e.balanceType}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--glass)', fontWeight: 800 }}>
                <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.9rem' }}>Total</td>
                <td className="amount" style={{ textAlign: 'right', fontSize: '0.9rem', borderTop: '2px solid var(--border)' }}>{formatPKR(s.totalDr)}</td>
                <td className="amount" style={{ textAlign: 'right', fontSize: '0.9rem', borderTop: '2px solid var(--border)' }}>{formatPKR(s.totalCr)}</td>
                <td className="amount" style={{ textAlign: 'right', fontSize: '0.9rem', borderTop: '2px solid var(--border)', color: s.closingType === 'Dr' ? 'var(--green)' : 'var(--red)' }}>{formatPKR(s.closingBalance)} {s.closingType}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 16 }}>
          {[{ label: 'Opening Dr', value: formatPKR(s.openingDr) }, { label: 'Opening Cr', value: formatPKR(s.openingCr) }, { label: 'Transaction Dr', value: formatPKR(s.transactionDr) }, { label: 'Transaction Cr', value: formatPKR(s.transactionCr) }, { label: 'Balance', value: `${formatPKR(s.closingBalance)} ${s.closingType}` }].map((item, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const hasData = data !== null;
  const isCustomObj = ['profit-loss', 'balance-sheet', 'trial-balance', 'general-ledger'].includes(selectedReport);
  const canExport = hasData && (isRokar ? !!data?.entries : isLedger ? !!data?.party : (isCustomObj ? !Array.isArray(data) && data : Array.isArray(data) && data.length > 0));

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Reports — <span className="urdu">رپورٹس</span></h2>
        <ExportDropdown onExport={handleExport} disabled={!canExport} />
      </div>

      <div className="filter-row">
        <div className="form-group" style={{ minWidth: 240 }}>
          <label>Report Type — رپورٹ کی قسم</label>
          <select value={selectedReport} onChange={e => { setSelectedReport(e.target.value); setData(null); }}>
            <option value="">— Select Report —</option>
            {reportTypes.map(r => <option key={r.id} value={r.id}>{r.name} — {r.urdu}</option>)}
          </select>
        </div>
        {currentType?.needsDate && (
          <>
            <div className="form-group"><label>From — سے</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div className="form-group"><label>To — تک</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          </>
        )}
        {currentType?.needsAsOn && (
          <div className="form-group"><label>As On — بتاریخ</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
        )}
        {currentType?.needsParty && (
          <>
            <div className="form-group" style={{ minWidth: 130 }}>
              <label>Party Type — قسم</label>
              <select value={partyType} onChange={e => { setPartyType(e.target.value); setPartyId(''); }}>
                <option value="Buyer">Buyer — خریدار</option>
                <option value="Supplier">Supplier — سپلائر</option>
              </select>
            </div>
            <div className="form-group" style={{ minWidth: 250 }}>
              <label>Party — فریق</label>
              <SearchableSelect
                options={(partyType === 'Buyer' ? buyers : suppliers).map(p => ({
                  value: String(p.id),
                  label: p.name,
                  labelUrdu: p.name_urdu || '',
                  searchText: `${p.name} ${p.name_urdu || ''} ${p.phone || ''}`,
                }))}
                value={partyId}
                onChange={(v) => setPartyId(v)}
                placeholder="Search party..."
              />
            </div>
          </>
        )}
        {currentType?.needsProduct && (
          <div className="form-group" style={{ minWidth: 200 }}>
            <label>Product — پروڈکٹ</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">All Products — تمام</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.name_urdu ? ' — ' + p.name_urdu : ''}</option>
              ))}
            </select>
          </div>
        )}
        <button className="btn btn-primary" onClick={generate} style={{ alignSelf: 'flex-end' }}>Generate Report</button>
      </div>

      {selectedReport === 'profit-loss'   && renderProfitLoss()}
      {selectedReport === 'balance-sheet' && renderBalanceSheet()}
      {selectedReport === 'trial-balance' && renderTrialBalance()}
      {isRokar                            && renderRokarReport()}
      {isLedger                           && renderGeneralLedger()}
      {!isCustomObj && !isRokar && !isLedger && renderTableReport()}

      {hasData && Array.isArray(data) && data.length === 0 && !isCustomObj && !isRokar && !isLedger && (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: '0.9rem' }}>No data found for the selected criteria</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Try adjusting the date range or report type</p>
        </div>
      )}
    </div>
  );
}
