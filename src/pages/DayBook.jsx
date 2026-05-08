import React, { useState, useEffect } from 'react';
import { formatPKR, formatDate, todayDateOnly } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';

export default function DayBook() {
  const [date, setDate] = useState(todayDateOnly());
  const [entries, setEntries] = useState([]);

  useEffect(() => { window.api.getDaybook(date).then(setEntries); }, [date]);

  const totalIn = entries.filter(e => e.type === 'Sale' || e.type === 'Payment In').reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter(e => e.type === 'Purchase' || e.type === 'Payment Out').reduce((s, e) => s + e.amount, 0);

  const handleExport = (format) => {
    if (entries.length === 0) return;
    const columns = ['#', 'Type', 'Party', 'Product', 'Amount (PKR)'];
    const rows = entries.map((e, i) => [i + 1, e.type, e.party_name || '—', e.product_name || '—', formatPKR(e.amount)]);
    const summary = [{ label: 'Total Inflow', value: formatPKR(totalIn) }, { label: 'Total Outflow', value: formatPKR(totalOut) }, { label: 'Net', value: formatPKR(totalIn - totalOut) }];
    const exportData = { title: `Day Book — روزنامچہ`, columns, rows, summary, dateRange: formatDate(date) };
    if (format === 'pdf') exportToPDF({ ...exportData, fileName: `DayBook_${date}.pdf` });
    else if (format === 'xlsx') exportToXLSX({ ...exportData, fileName: `DayBook_${date}.xlsx` });
    else if (format === 'csv') exportToCSV({ ...exportData, fileName: `DayBook_${date}.csv` });
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Day Book — <span className="urdu">روزنامچہ</span></h2>
        <ExportDropdown onExport={handleExport} disabled={entries.length === 0} />
      </div>
      <div className="filter-row">
        <div className="form-group"><label>Date — تاریخ</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-icon green">↓</div><div className="stat-info"><h3>Total Inflow</h3><div className="stat-value" style={{ color: 'var(--green)' }}>{formatPKR(totalIn)}</div></div></div>
        <div className="stat-card"><div className="stat-icon red">↑</div><div className="stat-info"><h3>Total Outflow</h3><div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(totalOut)}</div></div></div>
        <div className="stat-card"><div className="stat-icon indigo">≈</div><div className="stat-info"><h3>Net</h3><div className="stat-value">{formatPKR(totalIn - totalOut)}</div></div></div>
      </div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Type</th><th>Time</th><th>Party</th><th>Product</th><th>Amount (PKR)</th></tr></thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><span className={`badge ${e.type.includes('Sale') || e.type.includes('In') ? 'badge-active' : 'badge-inactive'}`}>{e.type}</span></td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.date && e.date.includes('T') ? new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                <td>{e.party_name || '—'}{e.party_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.party_name_urdu}</span></> : ''}</td><td>{e.product_name || '—'}{e.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}</td>
                <td className="amount" style={{ fontWeight: 600 }}>{formatPKR(e.amount)}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={6} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No entries for this date</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
