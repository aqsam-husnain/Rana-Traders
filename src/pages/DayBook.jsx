import React, { useState, useEffect } from 'react';
import { MdChevronLeft, MdChevronRight, MdCalendarToday, MdToday } from 'react-icons/md';
import { formatPKR, formatDate, todayDateOnly } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import { useToast } from '../components/Toast';

export default function DayBook() {
  const [date, setDate] = useState(todayDateOnly());
  const [entries, setEntries] = useState([]);
  const toast = useToast();
  const dateInputRef = React.useRef(null);

  useEffect(() => { window.api.getDaybook(date).then(setEntries); }, [date]);

  // Sort entries by time for proper chronological display
  const sortedEntries = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const totalIn = sortedEntries.filter(e => e.type === 'Sale' || e.type === 'Payment In').reduce((s, e) => s + e.amount, 0);
  const totalOut = sortedEntries.filter(e => e.type === 'Purchase' || e.type === 'Payment Out').reduce((s, e) => s + e.amount, 0);

  // Date navigation helpers
  const changeDay = (offset) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    const pad = (n) => String(n).padStart(2, '0');
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };
  const goToday = () => setDate(todayDateOnly());
  const isToday = date === todayDateOnly();

  // Format the selected date for display
  const displayDate = (() => {
    const d = new Date(date + 'T00:00:00');
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const formatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    return { weekday, formatted };
  })();

  const handleExport = async (format) => {
    if (sortedEntries.length === 0) return;
    const columns = ['#', 'Type', 'Party', 'Product', 'Amount (PKR)'];
    const rows = sortedEntries.map((e, i) => [i + 1, e.type, e.party_name || '—', e.product_name || '—', formatPKR(e.amount)]);
    const summary = [{ label: 'Total Inflow', value: formatPKR(totalIn) }, { label: 'Total Outflow', value: formatPKR(totalOut) }, { label: 'Net', value: formatPKR(totalIn - totalOut) }];
    const exportData = { title: `Day Book — روزنامچہ`, columns, rows, summary, dateRange: formatDate(date) };
    let saved = false;
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `DayBook_${date}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `DayBook_${date}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `DayBook_${date}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  // Badge styling helper
  const getBadgeClass = (type) => {
    if (type === 'Sale') return 'badge-active';
    if (type === 'Purchase') return 'badge-inactive';
    if (type === 'Payment In') return 'badge-active';
    if (type === 'Payment Out') return 'badge-inactive';
    return '';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Day Book — <span className="urdu">روزنامچہ</span></h2>
        <ExportDropdown onExport={handleExport} disabled={sortedEntries.length === 0} />
      </div>

      {/* Professional Date Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        padding: '12px 18px', background: 'var(--glass)', borderRadius: 14,
        border: '1px solid var(--border)', flexWrap: 'wrap'
      }}>
        <button className="btn btn-sm btn-secondary" onClick={() => changeDay(-1)} title="Previous Day"
          style={{ minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 0 }}>
          <MdChevronLeft style={{ fontSize: '1.3rem' }} />
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flex: 1,
          cursor: 'pointer', position: 'relative'
        }}
          onClick={() => dateInputRef.current?.showPicker?.()}
          title="Click to pick a date"
        >
          <MdCalendarToday style={{ fontSize: '1.2rem', color: 'var(--accent)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>
              {displayDate.weekday}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {displayDate.formatted}
            </div>
          </div>
          {/* Hidden date input for picker */}
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer', zIndex: 1
            }}
          />
        </div>

        <button className="btn btn-sm btn-secondary" onClick={() => changeDay(1)} title="Next Day"
          style={{ minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 0 }}>
          <MdChevronRight style={{ fontSize: '1.3rem' }} />
        </button>

        {!isToday && (
          <button className="btn btn-sm btn-primary" onClick={goToday}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', padding: '6px 14px', borderRadius: 10 }}>
            <MdToday style={{ fontSize: '1rem' }} /> Today
          </button>
        )}
        {isToday && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--green)',
            background: 'rgba(76,175,80,0.1)', padding: '4px 12px', borderRadius: 8,
            border: '1px solid rgba(76,175,80,0.2)', letterSpacing: '0.5px', textTransform: 'uppercase'
          }}>Today</span>
        )}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-icon green">↓</div><div className="stat-info"><h3>Total Inflow — آمدن</h3><div className="stat-value" style={{ color: 'var(--green)' }}>{formatPKR(totalIn)}</div></div></div>
        <div className="stat-card"><div className="stat-icon red">↑</div><div className="stat-info"><h3>Total Outflow — اخراجات</h3><div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(totalOut)}</div></div></div>
        <div className="stat-card"><div className="stat-icon indigo">≈</div><div className="stat-info"><h3>Net — خالص</h3><div className="stat-value">{formatPKR(totalIn - totalOut)}</div></div></div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Type</th><th>Time</th><th>Party</th><th>Product</th><th>Amount (PKR)</th></tr></thead>
          <tbody>
            {sortedEntries.map((e, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><span className={`badge ${getBadgeClass(e.type)}`}>{e.type}</span></td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.date && e.date.includes('T') ? new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                <td>{e.party_name || '—'}{e.party_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.party_name_urdu}</span></> : ''}</td><td>{e.product_name || '—'}{e.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}</td>
                <td className="amount" style={{ fontWeight: 600 }}>{formatPKR(e.amount)}</td>
              </tr>
            ))}
            {sortedEntries.length === 0 && <tr><td colSpan={6} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No entries for this date — اس تاریخ کے لیے کوئی اندراج نہیں</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
