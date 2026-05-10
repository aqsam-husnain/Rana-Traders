import React, { useState, useEffect } from 'react';
import { formatPKR, formatNumber, formatDate, todayISO } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import { useToast } from '../components/Toast';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';


export default function Commission() {
  const [products, setProducts] = useState([]);
  const [report, setReport] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(todayISO());
  const [tab, setTab] = useState('settings');
  const toast = useToast();

  useEffect(() => { window.api.getProducts().then(setProducts); }, []);

  const loadReport = async () => {
    const data = await window.api.getReport('commission', { dateFrom, dateTo });
    if (Array.isArray(data)) setReport(data);
  };

  const updateRate = async (id, rate) => {
    const p = products.find(x => x.id === id);
    if (p) { await window.api.updateProduct(id, { ...p, commission_rate: parseFloat(rate) || 0 }); window.api.getProducts().then(setProducts); }
  };

  const saleCommission = report.filter(r => r.type === 'Sale').reduce((s, r) => s + (r.commission || 0), 0);
  const purchaseCommission = report.filter(r => r.type === 'Purchase').reduce((s, r) => s + (r.commission || 0), 0);
  const totalCommission = saleCommission + purchaseCommission;

  const handleExport = async (format) => {
    if (report.length === 0) return;

    const columns = ['#', 'Date', 'Type', 'Party', 'Product', 'Qty', 'Total', 'Commission'];
    const rows = report.map((r, i) => [
      i + 1, formatDate(r.date), r.type, r.party_name || '—', r.product_name,
      formatNumber(r.quantity), formatPKR(r.total), formatPKR(r.commission)
    ]);
    const summary = [
      { label: 'Sale Commission', value: formatPKR(saleCommission) },
      { label: 'Purchase Commission', value: formatPKR(purchaseCommission) },
      { label: 'Total Commission', value: formatPKR(totalCommission) },
    ];
    const dateRange = `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;
    const fileBase = `Commission_Report_${dateTo}`;

    const exportData = { title: 'Commission Report — آڑت رپورٹ', titleUrdu: 'آڑت رپورٹ', columns, rows, summary, dateRange };

    let saved = false;
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `${fileBase}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `${fileBase}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `${fileBase}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Commission / Aarat — <span className="urdu">آڑت</span></h2>
        {tab === 'report' && <ExportDropdown onExport={handleExport} disabled={report.length === 0} />}
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Commission Settings</button>
        <button className={`tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>Commission Report</button>
      </div>

      {tab === 'settings' && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Product (Urdu)</th><th>Unit</th><th>Commission Rate (%)</th></tr></thead>
            <tbody>
              {products.filter(p => p.status === 'Active').map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="urdu">{p.name_urdu || '—'}</td>
                  <td>{p.unit}</td>
                  <td>
                    <input type="number" step="0.01" defaultValue={p.commission_rate}
                      onBlur={e => updateRate(p.id, e.target.value)}
                      onKeyDown={blockInvalidChars} onWheel={preventScrollChange}
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', width: 100, outline: 'none' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'report' && (
        <>
          <div className="filter-row">
            <div className="form-group"><label>From — سے</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div className="form-group"><label>To — تک</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={loadReport} style={{ alignSelf: 'flex-end' }}>Generate</button>
          </div>

          {/* Summary cards */}
          {report.length > 0 && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon green">₨</div>
                <div className="stat-info"><h3>Sale Commission — فروخت آڑت</h3><div className="stat-value">{formatPKR(saleCommission)}</div></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon red">₨</div>
                <div className="stat-info"><h3>Purchase Commission — خریداری آڑت</h3><div className="stat-value">{formatPKR(purchaseCommission)}</div></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon amber">%</div>
                <div className="stat-info"><h3>Total Commission — کل آڑت</h3><div className="stat-value" style={{ color: 'var(--accent2)' }}>{formatPKR(totalCommission)}</div></div>
              </div>
            </div>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>Type</th><th>Party</th><th>Product</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Commission</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{formatDate(r.date)}</td>
                    <td><span className={`badge ${r.type === 'Sale' ? 'badge-active' : 'badge-walkin'}`}>{r.type}</span></td>
                    <td style={{ fontWeight: 600 }}>{r.party_name || '—'}{r.party_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{r.party_name_urdu}</span></> : ''}</td>
                    <td>{r.product_name}{r.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.product_name_urdu}</span></> : ''}</td>
                    <td className="amount" style={{ textAlign: 'right' }}>{formatNumber(r.quantity)}</td>
                    <td className="amount" style={{ textAlign: 'right' }}>{formatPKR(r.total)}</td>
                    <td className="amount" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent2)' }}>{formatPKR(r.commission)}</td>
                  </tr>
                ))}
                {/* Totals row */}
                {report.length > 0 && (
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                    <td colSpan={6} style={{ textAlign: 'right', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Grand Total</td>
                    <td className="amount" style={{ textAlign: 'right' }}>{formatPKR(report.reduce((s, r) => s + (r.total || 0), 0))}</td>
                    <td className="amount" style={{ textAlign: 'right', color: 'var(--accent2)', fontSize: '1rem' }}>{formatPKR(totalCommission)}</td>
                  </tr>
                )}
                {report.length === 0 && <tr><td colSpan={8} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>Generate report to view commission data</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
