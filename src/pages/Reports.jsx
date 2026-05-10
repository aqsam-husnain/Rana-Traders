import React, { useState } from 'react';
import { formatPKR, formatNumber, formatDate, todayISO } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import { useToast } from '../components/Toast';

const reportTypes = [
  { id: 'daily-sales', name: 'Daily Sale Report', urdu: 'یومیہ فروخت رپورٹ', needsDate: true },
  { id: 'daily-purchases', name: 'Daily Purchase Report', urdu: 'یومیہ خریداری رپورٹ', needsDate: true },
  { id: 'commission', name: 'Commission Report', urdu: 'آڑت رپورٹ', needsDate: true },
  { id: 'stock', name: 'Stock Report', urdu: 'اسٹاک رپورٹ', needsDate: false },
  { id: 'buyer-outstanding', name: 'Buyer Outstanding', urdu: 'خریدار واجبات', needsDate: false },
  { id: 'supplier-outstanding', name: 'Supplier Outstanding', urdu: 'سپلائر واجبات', needsDate: false },
  { id: 'profit-loss', name: 'Profit & Loss', urdu: 'نفع و نقصان', needsDate: false },
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
    if (!data || !config || !currentType) return;

    const isArray = Array.isArray(data);
    const rows = isArray ? config.extract(data) : [];
    const summary = isArray && config.summary ? config.summary(data) : [];
    const dateRange = currentType.needsDate ? `${formatDate(dateFrom)} — ${formatDate(dateTo)}` : '';
    const fileBase = `${currentType.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateTo}`;

    const exportData = {
      title: `${currentType.name} — ${currentType.urdu}`,
      titleUrdu: currentType.urdu,
      columns: config.columns,
      rows,
      summary,
      dateRange,
    };

    let saved = false;
    if (format === 'pdf') {
      if (selectedReport === 'profit-loss' && !isArray) {
        saved = await exportToPDF({
          ...exportData,
          columns: ['Metric', 'Amount (PKR)'],
          rows: [
            ['Total Sales', formatPKR(data.totalSales)],
            ['Total Purchases', formatPKR(data.totalPurchases)],
            ['Total Commission Earned', formatPKR(data.totalCommission)],
            ['Net Profit / Loss', formatPKR(data.totalSales - data.totalPurchases)],
          ],
          summary: [
            { label: 'Total Sales', value: formatPKR(data.totalSales) },
            { label: 'Total Purchases', value: formatPKR(data.totalPurchases) },
            { label: 'Net Profit', value: formatPKR(data.totalSales - data.totalPurchases) },
          ],
          fileName: `${fileBase}.pdf`,
        });
      } else {
        saved = await exportToPDF({ ...exportData, fileName: `${fileBase}.pdf` });
      }
    } else if (format === 'xlsx') {
      if (selectedReport === 'profit-loss' && !isArray) {
        saved = await exportToXLSX({
          ...exportData,
          columns: ['Metric', 'Amount (PKR)'],
          rows: [
            ['Total Sales', data.totalSales],
            ['Total Purchases', data.totalPurchases],
            ['Total Commission', data.totalCommission],
            ['Net Profit / Loss', data.totalSales - data.totalPurchases],
          ],
          fileName: `${fileBase}.xlsx`,
        });
      } else {
        saved = await exportToXLSX({ ...exportData, fileName: `${fileBase}.xlsx` });
      }
    } else if (format === 'csv') {
      if (selectedReport === 'profit-loss' && !isArray) {
        saved = await exportToCSV({
          columns: ['Metric', 'Amount'],
          rows: [
            ['Total Sales', data.totalSales],
            ['Total Purchases', data.totalPurchases],
            ['Total Commission', data.totalCommission],
            ['Net Profit / Loss', data.totalSales - data.totalPurchases],
          ],
          fileName: `${fileBase}.csv`,
        });
      } else {
        saved = await exportToCSV({ ...exportData, fileName: `${fileBase}.csv` });
      }
    }
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
  const canExport = hasData && (selectedReport === 'profit-loss' ? !Array.isArray(data) : Array.isArray(data) && data.length > 0);

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
        <button className="btn btn-primary" onClick={generate} style={{ alignSelf: 'flex-end' }}>Generate Report</button>
      </div>

      {/* Report output */}
      {selectedReport === 'profit-loss' ? renderProfitLoss() : renderTableReport()}

      {hasData && Array.isArray(data) && data.length === 0 && selectedReport !== 'profit-loss' && (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: '0.9rem' }}>No data found for the selected criteria</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Try adjusting the date range or report type</p>
        </div>
      )}
    </div>
  );
}
