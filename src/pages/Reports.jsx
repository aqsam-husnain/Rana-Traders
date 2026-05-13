import React, { useState } from 'react';
import { formatPKR, formatNumber, formatDate, todayISO } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import { useToast } from '../components/Toast';
import { MdAccountBalance, MdBalance, MdInventory } from 'react-icons/md';

const reportTypes = [
  { id: 'daily-sales', name: 'Daily Sale Report', urdu: 'یومیہ فروخت رپورٹ', needsDate: true },
  { id: 'daily-purchases', name: 'Daily Purchase Report', urdu: 'یومیہ خریداری رپورٹ', needsDate: true },
  { id: 'commission', name: 'Commission Report', urdu: 'آڑت رپورٹ', needsDate: true },
  { id: 'stock', name: 'Stock Report', urdu: 'اسٹاک رپورٹ', needsDate: false },
  { id: 'buyer-outstanding', name: 'Buyer Outstanding', urdu: 'خریدار واجبات', needsDate: false },
  { id: 'supplier-outstanding', name: 'Supplier Outstanding', urdu: 'سپلائر واجبات', needsDate: false },
  { id: 'profit-loss', name: 'Profit & Loss', urdu: 'نفع و نقصان', needsDate: false },
  { id: 'stock-valuation', name: 'Daily Stock Valuation', urdu: 'یومیہ اسٹاک قدر', needsDate: true, custom: true },
  { id: 'balance-sheet', name: 'Balance Sheet', urdu: 'بیلنس شیٹ', needsAsOn: true, custom: true },
  { id: 'trial-balance', name: 'Trial Balance', urdu: 'ٹرائل بیلنس', needsAsOn: true, custom: true },
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
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const toast = useToast();

  const generate = async () => {
    if (!selectedReport) return;
    const result = await window.api.getReport(selectedReport, { dateFrom, dateTo });
    setData(result);
  };

  const currentType = reportTypes.find(r => r.id === selectedReport);
  const config = reportColumns[selectedReport];

  const handleExport = async (format) => {
    if (!data || !currentType) return;
    const ts = fileTimestamp();
    const isArray = Array.isArray(data);
    const isCustom = ['balance-sheet', 'trial-balance'].includes(selectedReport);
    const rows = isArray && config ? config.extract(data) : [];
    const summary = isArray && config?.summary ? config.summary(data) : [];
    const dateRange = currentType.needsDate ? `${formatDate(dateFrom)} — ${formatDate(dateTo)}` : '';
    const fileBase = `${currentType.name.replace(/[^a-zA-Z0-9]/g, '_')}_${ts}`;
    const title = `${currentType.name} — ${currentType.urdu}`;

    let exportRows = rows, exportCols = config?.columns || [], exportSummary = summary, highlightSet = null;

    // Build custom export rows for non-array reports
    if (selectedReport === 'profit-loss' && !isArray) {
      exportCols = ['Metric', 'Amount (PKR)'];
      exportRows = [
        ['Total Sales', formatPKR(data.totalSales)],
        ['Total Purchases', formatPKR(data.totalPurchases)],
        ['Total Commission Earned', formatPKR(data.totalCommission)],
        ['Net Profit / Loss', formatPKR(data.totalSales - data.totalPurchases)],
      ];
      exportSummary = [
        { label: 'Total Sales', value: formatPKR(data.totalSales) },
        { label: 'Total Purchases', value: formatPKR(data.totalPurchases) },
        { label: 'Net Profit', value: formatPKR(data.totalSales - data.totalPurchases) },
      ];
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
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `${fileBase}.pdf`, highlightRows: highlightSet });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `${fileBase}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `${fileBase}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  const renderProfitLoss = () => {
    if (!data || Array.isArray(data)) return null;
    const netProfit = data.totalSales - data.totalPurchases;
    return (
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="stat-card"><div className="stat-icon green">₨</div><div className="stat-info"><h3>Total Sales</h3><div className="stat-value">{formatPKR(data.totalSales)}</div></div></div>
        <div className="stat-card"><div className="stat-icon red">₨</div><div className="stat-info"><h3>Total Purchases</h3><div className="stat-value">{formatPKR(data.totalPurchases)}</div></div></div>
        <div className="stat-card"><div className="stat-icon amber">%</div><div className="stat-info"><h3>Total Commission</h3><div className="stat-value">{formatPKR(data.totalCommission)}</div></div></div>
        <div className="stat-card"><div className={`stat-icon ${netProfit >= 0 ? 'green' : 'red'}`}>±</div><div className="stat-info"><h3>Net Profit / Loss</h3><div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPKR(netProfit)}</div></div></div>
      </div>
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

  const hasData = data !== null;
  const isCustomObj = ['profit-loss', 'balance-sheet', 'trial-balance'].includes(selectedReport);
  const canExport = hasData && (isCustomObj ? !Array.isArray(data) && data : Array.isArray(data) && data.length > 0);

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
        <button className="btn btn-primary" onClick={generate} style={{ alignSelf: 'flex-end' }}>Generate Report</button>
      </div>

      {/* Report output */}
      {selectedReport === 'profit-loss' && renderProfitLoss()}
      {selectedReport === 'balance-sheet' && renderBalanceSheet()}
      {selectedReport === 'trial-balance' && renderTrialBalance()}
      {!isCustomObj && renderTableReport()}

      {hasData && Array.isArray(data) && data.length === 0 && !isCustomObj && (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: '0.9rem' }}>No data found for the selected criteria</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Try adjusting the date range or report type</p>
        </div>
      )}
    </div>
  );
}
