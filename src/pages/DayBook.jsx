import React, { useState, useEffect } from 'react';
import { MdChevronLeft, MdChevronRight, MdCalendarToday, MdToday, MdTrendingDown, MdTrendingUp } from 'react-icons/md';
import { formatPKR, formatDate, todayDateOnly } from '../utils/formatters';
import { exportDayBookPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import { useToast } from '../components/Toast';

export default function DayBook() {
  const [date, setDate] = useState(todayDateOnly());
  const [entries, setEntries] = useState([]);
  const [rokarEntries, setRokarEntries] = useState([]);
  const [rokarCumulative, setRokarCumulative] = useState({ openingBalance: 0, totalIn: 0, totalOut: 0, balance: 0 });
  const [activeTab, setActiveTab] = useState('roznamcha');
  const toast = useToast();
  const dateInputRef = React.useRef(null);

  useEffect(() => {
    window.api.getDaybook(date).then(setEntries);
    window.api.getRokar(date).then(setRokarEntries);
  }, [date]);

  // Load cumulative running balance once on mount (and when tab switches to rokar)
  useEffect(() => {
    if (activeTab === 'rokar') {
      window.api.getRokarCumulative().then(setRokarCumulative);
    }
  }, [activeTab]);

  // ── Roznamcha data ──
  const sortedEntries = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const inflowEntries = sortedEntries.filter(e => e.type === 'Sale' || e.type === 'Payment In');
  const outflowEntries = sortedEntries.filter(e => e.type === 'Purchase' || e.type === 'Payment Out');
  const totalSale = sortedEntries.filter(e => e.type === 'Sale').reduce((s, e) => s + e.amount, 0);
  const totalPurchase = sortedEntries.filter(e => e.type === 'Purchase').reduce((s, e) => s + e.amount, 0);
  const totalPaymentIn = sortedEntries.filter(e => e.type === 'Payment In').reduce((s, e) => s + e.amount, 0);
  const totalPaymentOut = sortedEntries.filter(e => e.type === 'Payment Out').reduce((s, e) => s + e.amount, 0);
  const totalIn = totalSale + totalPaymentIn;
  const totalOut = totalPurchase + totalPaymentOut;

  // ── Rokar Khata data ──
  const sortedRokar = [...rokarEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  // جمع (Cash In): Walk-in sales + regular buyer partial cash + standalone cash payments received
  const rokarJama  = sortedRokar.filter(e => e.type === 'Walk-in Sale' || e.type === 'Cash Received');
  // خرچ (Cash Out): Walk-in purchases + regular supplier partial cash + standalone cash payments made + daily expenses
  const rokarKharch = sortedRokar.filter(e => e.type === 'Walk-in Purchase' || e.type === 'Cash Paid' || e.type === 'Expense');
  const totalRokarJama   = rokarJama.reduce((s, e) => s + (e.amount || 0), 0);
  const totalRokarKharch = rokarKharch.reduce((s, e) => s + (e.amount || 0), 0);
  const rokarBalance = totalRokarJama - totalRokarKharch;

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
    const ts = fileTimestamp();
    const fmtTime = (e) => e.date && e.date.includes('T') ? new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

    let saved = false;
    if (format === 'pdf') {
      // Split T-Account PDF
      const inflowCols = ['#', 'Time', 'Type', 'Party', 'Amount'];
      const outflowCols = ['#', 'Time', 'Type', 'Party', 'Amount'];
      const inflowRows = inflowEntries.map((e, i) => [i + 1, fmtTime(e), e.type, (e.party_name || '—') + (e.party_name_urdu ? '\n' + e.party_name_urdu : ''), formatPKR(e.amount)]);
      const outflowRows = outflowEntries.map((e, i) => [i + 1, fmtTime(e), e.type, (e.party_name || '—') + (e.party_name_urdu ? '\n' + e.party_name_urdu : ''), formatPKR(e.amount)]);
      saved = await exportDayBookPDF({
        title: `Day Book — روزنامچہ`,
        inflowColumns: inflowCols,
        outflowColumns: outflowCols,
        inflowRows,
        outflowRows,
        inflowTotals: { total: formatPKR(totalIn), sale: formatPKR(totalSale), paymentIn: formatPKR(totalPaymentIn) },
        outflowTotals: { total: formatPKR(totalOut), purchase: formatPKR(totalPurchase), paymentOut: formatPKR(totalPaymentOut) },
        summary: [
          { label: 'Total Inflow — آمدن', value: formatPKR(totalIn) },
          { label: 'Total Outflow — اخراجات', value: formatPKR(totalOut) },
          { label: 'Net — خالص', value: formatPKR(totalIn - totalOut) }
        ],
        dateRange: formatDate(date),
        fileName: `DayBook_${date}_${ts}.pdf`,
      });
    } else {
      // XLSX / CSV — keep tabular format
      const columns = ['#', 'Time', 'Party', 'Product', 'Sale (فروخت)', 'Purchase (خریداری)', 'Payment In (وصولی)', 'Payment Out (ادائیگی)'];
      const rows = sortedEntries.map((e, i) => [
        i + 1, fmtTime(e), (e.party_name || '—') + (e.party_name_urdu ? '\n' + e.party_name_urdu : ''), e.product_name || '—',
        e.type === 'Sale' ? formatPKR(e.amount) : '',
        e.type === 'Purchase' ? formatPKR(e.amount) : '',
        e.type === 'Payment In' ? formatPKR(e.amount) : '',
        e.type === 'Payment Out' ? formatPKR(e.amount) : '',
      ]);
      rows.push(['', '', '', 'Total — کل', formatPKR(totalSale), formatPKR(totalPurchase), formatPKR(totalPaymentIn), formatPKR(totalPaymentOut)]);
      const summary = [
        { label: 'Total Inflow — آمدن', value: formatPKR(totalIn) },
        { label: 'Total Outflow — اخراجات', value: formatPKR(totalOut) },
        { label: 'Net — خالص', value: formatPKR(totalIn - totalOut) }
      ];
      const exportData = { title: `Day Book — روزنامچہ`, columns, rows, summary, dateRange: formatDate(date) };
      if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `DayBook_${date}_${ts}.xlsx` });
      else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `DayBook_${date}_${ts}.csv` });
    }
    if (saved) toast.success('File exported successfully!');
  };

  // ── Rokar Khata Export ──
  const handleExportRokar = async (format) => {
    if (sortedRokar.length === 0) return;
    const ts = fileTimestamp();
    const fmtTime = (e) => e.date && e.date.includes('T') ? new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
    if (format === 'pdf') {
      const jamaCols   = ['#', 'Time', 'Type', 'Party / Description', 'Amount'];
      const kharchCols = ['#', 'Time', 'Type', 'Party / Description', 'Amount'];
      const jamaRows   = rokarJama.map((e, i) => [i + 1, fmtTime(e), e.type, e.party_name || e.product_name || '—', formatPKR(e.amount)]);
      const kharchRows = rokarKharch.map((e, i) => [i + 1, fmtTime(e), e.type, e.party_name || e.product_name || '—', formatPKR(e.amount)]);
      const saved = await exportDayBookPDF({
        title: `Rokar Khata — روکڑ کھاتہ`,
        inflowColumns: jamaCols, outflowColumns: kharchCols,
        inflowRows: jamaRows, outflowRows: kharchRows,
        inflowTotals: { total: formatPKR(totalRokarJama) },
        outflowTotals: { total: formatPKR(totalRokarKharch) },
        summary: [
          { label: 'کل جمع — Cash In',  value: formatPKR(totalRokarJama) },
          { label: 'کل خرچ — Cash Out', value: formatPKR(totalRokarKharch) },
          { label: 'نقد بیلنس — Balance', value: (rokarBalance < 0 ? '−' : '+') + formatPKR(Math.abs(rokarBalance)) },
        ],
        dateRange: formatDate(date),
        fileName: `RokarKhata_${date}_${ts}.pdf`,
      });
      if (saved) toast.success('File exported successfully!');
    } else {
      const columns = ['#', 'Time', 'Flow', 'Type', 'Party / Description', 'Amount'];
      const allRows = [
        ...rokarJama.map((e, i) => [i + 1, fmtTime(e), 'جمع (In)', e.type, e.party_name || e.product_name || '—', formatPKR(e.amount)]),
        ...rokarKharch.map((e, i) => [rokarJama.length + i + 1, fmtTime(e), 'خرچ (Out)', e.type, e.party_name || e.product_name || '—', formatPKR(e.amount)]),
      ];
      const summary = [
        { label: 'کل جمع — Cash In',  value: formatPKR(totalRokarJama) },
        { label: 'کل خرچ — Cash Out', value: formatPKR(totalRokarKharch) },
        { label: 'نقد بیلنس — Balance', value: formatPKR(rokarBalance) },
      ];
      const exportData = { title: `Rokar Khata — روکڑ کھاتہ`, columns, rows: allRows, summary, dateRange: formatDate(date) };
      let saved = false;
      if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `RokarKhata_${date}_${ts}.xlsx` });
      else if (format === 'csv')  saved = await exportToCSV({ ...exportData, fileName: `RokarKhata_${date}_${ts}.csv` });
      if (saved) toast.success('File exported successfully!');
    }
  };

  // Time formatter helper
  const formatTime = (dateStr) => {
    if (dateStr && dateStr.includes('T')) {
      return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return '—';
  };

  // Type badge color helper (Roznamcha)
  const getTypeBadge = (type) => {
    if (type === 'Sale') return { label: 'Sale', urdu: 'فروخت', color: 'var(--green)', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' };
    if (type === 'Payment In') return { label: 'Payment In', urdu: 'وصولی', color: '#4fc3f7', bg: 'rgba(79,195,247,0.1)', border: 'rgba(79,195,247,0.2)' };
    if (type === 'Purchase') return { label: 'Purchase', urdu: 'خریداری', color: 'var(--red)', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' };
    if (type === 'Payment Out') return { label: 'Payment Out', urdu: 'ادائیگی', color: '#ff9800', bg: 'rgba(255,152,0,0.1)', border: 'rgba(255,152,0,0.2)' };
    return {};
  };

  // Type badge color helper (Rokar Khata — Walk-in only)
  const getRokarBadge = (type) => {
    if (type === 'Walk-in Sale')     return { label: 'Walk-in نقد فروخت', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' };
    if (type === 'Cash Received')    return { label: 'وصولی نقد', color: 'var(--green)', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' };
    if (type === 'Walk-in Purchase') return { label: 'Walk-in نقد خرید', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' };
    if (type === 'Cash Paid')        return { label: 'ادائیگی نقد', color: 'var(--red)', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' };
    if (type === 'Expense')          return { label: 'خرچہ', color: '#ff9800', bg: 'rgba(255,152,0,0.1)', border: 'rgba(255,152,0,0.2)' };
    return { label: type, color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' };
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>
          {activeTab === 'roznamcha'
            ? <>Day Book — <span className="urdu">روزنامچہ</span></>
            : <>Rokar Khata — <span className="urdu">روکڑ کھاتہ</span></>}
        </h2>
        {activeTab === 'roznamcha' && (
          <ExportDropdown onExport={handleExport} disabled={sortedEntries.length === 0} />
        )}
        {activeTab === 'rokar' && (
          <ExportDropdown onExport={handleExportRokar} disabled={sortedRokar.length === 0} />
        )}
      </div>

      {/* Tab Toggle */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          className={`tab ${activeTab === 'roznamcha' ? 'active' : ''}`}
          onClick={() => setActiveTab('roznamcha')}
        >
          📒 Roznamcha — <span className="urdu">روزنامچہ</span>
        </button>
        <button
          className={`tab ${activeTab === 'rokar' ? 'active' : ''}`}
          onClick={() => setActiveTab('rokar')}
        >
          💰 Rokar Khata — <span className="urdu">روکڑ کھاتہ</span>
        </button>
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

      {/* ══ ROZNAMCHA VIEW ══ */}
      {activeTab === 'roznamcha' && (
        <>
      {/* Summary Stats — 3 cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-icon green">↓</div><div className="stat-info"><h3>Total Inflow — آمدن</h3><div className="stat-value" style={{ color: 'var(--green)' }}>{formatPKR(totalIn)}</div></div></div>
        <div className="stat-card"><div className="stat-icon red">↑</div><div className="stat-info"><h3>Total Outflow — اخراجات</h3><div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(totalOut)}</div></div></div>
        <div className="stat-card"><div className="stat-icon indigo">≈</div><div className="stat-info"><h3>Net — خالص</h3><div className="stat-value">{formatPKR(totalIn - totalOut)}</div></div></div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          T-ACCOUNT SPLIT LAYOUT — Inflow (Left) | Outflow (Right)
          ═══════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 0,
        marginBottom: 24,
        minHeight: 300,
      }}>

        {/* ─── LEFT COLUMN: INFLOW / CREDIT ─── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Column Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
            background: 'rgba(52,211,153,0.06)',
            borderRadius: '14px 0 0 0',
            border: '1px solid rgba(52,211,153,0.15)',
            borderRight: 'none',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(52,211,153,0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MdTrendingDown style={{ fontSize: '1.3rem', color: 'var(--green)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>
                Credit / Inflow
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--green)', lineHeight: 1.4 }}>
                Sale & Payment In — <span className="urdu" style={{ fontSize: '0.85rem' }}>فروخت اور وصولی</span>
              </div>
            </div>
          </div>

          {/* Inflow Sub-stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            border: '1px solid rgba(52,211,153,0.15)', borderTop: 'none', borderRight: 'none',
          }}>
            <div style={{
              padding: '10px 14px', textAlign: 'center',
              background: 'rgba(52,211,153,0.04)',
              borderRight: '1px solid rgba(52,211,153,0.1)',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Sale — <span className="urdu">فروخت</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--green)' }}>{formatPKR(totalSale)}</div>
            </div>
            <div style={{
              padding: '10px 14px', textAlign: 'center',
              background: 'rgba(79,195,247,0.04)',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payment In — <span className="urdu">وصولی</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4fc3f7' }}>{formatPKR(totalPaymentIn)}</div>
            </div>
          </div>

          {/* Inflow Table */}
          <div style={{
            flex: 1,
            background: 'var(--bg-card)',
            border: '1px solid rgba(52,211,153,0.15)',
            borderTop: 'none',
            borderRight: 'none',
            borderRadius: '0 0 0 14px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Party</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inflowEntries.length > 0 ? inflowEntries.map((e, i) => {
                    const badge = getTypeBadge(e.type);
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(e.date)}</td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                            fontSize: '0.68rem', fontWeight: 600,
                            color: badge.color, background: badge.bg,
                            border: `1px solid ${badge.border}`,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          {e.party_name || '—'}
                          {e.party_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.party_name_urdu}</span></> : ''}
                        </td>
                        <td>
                          {e.product_name || '—'}
                          {e.product_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}
                        </td>
                        <td className="amount" style={{ textAlign: 'right', color: badge.color, fontWeight: 700 }}>
                          {formatPKR(e.amount)}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No inflow entries — <span className="urdu">کوئی آمدن نہیں</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Inflow Footer Total */}
            {inflowEntries.length > 0 && (
              <div style={{
                padding: '14px 18px',
                background: 'rgba(52,211,153,0.06)',
                borderTop: '2px solid rgba(52,211,153,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Credit — <span className="urdu" style={{ fontSize: '0.8rem' }}>کل جمع</span>
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)' }}>
                  {formatPKR(totalIn)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── VERTICAL DIVIDER ─── */}
        <div style={{
          width: 3,
          background: 'linear-gradient(to bottom, rgba(212,160,23,0.05), rgba(212,160,23,0.4), rgba(212,160,23,0.4), rgba(212,160,23,0.05))',
          position: 'relative',
        }}>
          {/* Decorative diamond at center */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(45deg)',
            width: 12, height: 12,
            background: 'var(--accent)',
            borderRadius: 2,
            boxShadow: '0 0 12px rgba(212,160,23,0.4)',
          }} />
        </div>

        {/* ─── RIGHT COLUMN: OUTFLOW / DEBIT ─── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Column Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
            background: 'rgba(248,113,113,0.06)',
            borderRadius: '0 14px 0 0',
            border: '1px solid rgba(248,113,113,0.15)',
            borderLeft: 'none',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(248,113,113,0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MdTrendingUp style={{ fontSize: '1.3rem', color: 'var(--red)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>
                Debit / Outflow
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--red)', lineHeight: 1.4 }}>
                Purchase & Payment Out — <span className="urdu" style={{ fontSize: '0.85rem' }}>خریداری اور ادائیگی</span>
              </div>
            </div>
          </div>

          {/* Outflow Sub-stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            border: '1px solid rgba(248,113,113,0.15)', borderTop: 'none', borderLeft: 'none',
          }}>
            <div style={{
              padding: '10px 14px', textAlign: 'center',
              background: 'rgba(248,113,113,0.04)',
              borderRight: '1px solid rgba(248,113,113,0.1)',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Purchase — <span className="urdu">خریداری</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--red)' }}>{formatPKR(totalPurchase)}</div>
            </div>
            <div style={{
              padding: '10px 14px', textAlign: 'center',
              background: 'rgba(255,152,0,0.04)',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payment Out — <span className="urdu">ادائیگی</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ff9800' }}>{formatPKR(totalPaymentOut)}</div>
            </div>
          </div>

          {/* Outflow Table */}
          <div style={{
            flex: 1,
            background: 'var(--bg-card)',
            border: '1px solid rgba(248,113,113,0.15)',
            borderTop: 'none',
            borderLeft: 'none',
            borderRadius: '0 0 14px 0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Party</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {outflowEntries.length > 0 ? outflowEntries.map((e, i) => {
                    const badge = getTypeBadge(e.type);
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(e.date)}</td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                            fontSize: '0.68rem', fontWeight: 600,
                            color: badge.color, background: badge.bg,
                            border: `1px solid ${badge.border}`,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          {e.party_name || '—'}
                          {e.party_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.party_name_urdu}</span></> : ''}
                        </td>
                        <td>
                          {e.product_name || '—'}
                          {e.product_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}
                        </td>
                        <td className="amount" style={{ textAlign: 'right', color: badge.color, fontWeight: 700 }}>
                          {formatPKR(e.amount)}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No outflow entries — <span className="urdu">کوئی اخراجات نہیں</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Outflow Footer Total */}
            {outflowEntries.length > 0 && (
              <div style={{
                padding: '14px 18px',
                background: 'rgba(248,113,113,0.06)',
                borderTop: '2px solid rgba(248,113,113,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Debit — <span className="urdu" style={{ fontSize: '0.8rem' }}>کل بنام</span>
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--red)' }}>
                  {formatPKR(totalOut)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ END ROZNAMCHA VIEW ══ */}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          ROKAR KHATA VIEW — Cash-only T-Account
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'rokar' && (
        <div>
          {/* ── Cumulative Running Balance Banner ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 22px', marginBottom: 16, borderRadius: 14,
            background: rokarCumulative.balance >= 0
              ? 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.04))'
              : 'linear-gradient(135deg, rgba(248,113,113,0.1), rgba(248,113,113,0.04))',
            border: `1px solid ${rokarCumulative.balance >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, fontSize: '1.6rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: rokarCumulative.balance >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
              }}>💰</div>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 2 }}>
                  Cash in Hand — <span className="urdu">نقد ہاتھ میں (کل وقتی بیلنس)</span>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: rokarCumulative.balance >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
                  {rokarCumulative.balance < 0 ? '−' : ''}{formatPKR(Math.abs(rokarCumulative.balance))}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 2 }}>
              <div>Opening: <strong style={{ color: 'var(--accent)' }}>{formatPKR(rokarCumulative.openingBalance)}</strong></div>
              <div>Total In: <strong style={{ color: 'var(--green)' }}>{formatPKR(rokarCumulative.totalIn)}</strong></div>
              <div>Total Out: <strong style={{ color: 'var(--red)' }}>{formatPKR(rokarCumulative.totalOut)}</strong></div>
            </div>
          </div>

          {/* Daily Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon green">↓</div>
              <div className="stat-info">
                <h3>آج جمع — Today's Cash In</h3>
                <div className="stat-value" style={{ color: 'var(--green)' }}>{formatPKR(totalRokarJama)}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red">↑</div>
              <div className="stat-info">
                <h3>آج خرچ — Today's Cash Out</h3>
                <div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(totalRokarKharch)}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon indigo">₨</div>
              <div className="stat-info">
                <h3>آج بیلنس — Today's Net</h3>
                <div className="stat-value" style={{ color: rokarBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {formatPKR(Math.abs(rokarBalance))}
                  {rokarBalance < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Deficit)</span>}
                </div>
              </div>
            </div>
          </div>


          {/* Rokar T-Account */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, marginBottom: 24, minHeight: 300 }}>

            {/* ── LEFT: جمع (Cash In) ── */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(52,211,153,0.06)', borderRadius: '14px 0 0 0', border: '1px solid rgba(52,211,153,0.15)', borderRight: 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(52,211,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MdTrendingDown style={{ fontSize: '1.3rem', color: 'var(--green)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>نقد آمدن — Cash In</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--green)', lineHeight: 1.4 }}>جمع <span className="urdu" style={{ fontSize: '0.85rem' }}>نقد فروخت و وصولی۔</span></div>
                </div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid rgba(52,211,153,0.15)', borderTop: 'none', borderRight: 'none', borderRadius: '0 0 0 14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="data-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Party</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rokarJama.length > 0 ? rokarJama.map((e, i) => {
                        const badge = getRokarBadge(e.type);
                        return (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(e.date)}</td>
                            <td>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
                                {badge.label}
                              </span>
                            </td>
                            <td>{e.party_name || '—'}{e.party_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.party_name_urdu}</span></> : ''}</td>
                            <td>{e.product_name || '—'}{e.product_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}</td>
                            <td className="amount" style={{ textAlign: 'right', color: badge.color, fontWeight: 700 }}>{formatPKR(e.amount)}</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>کوئی نقد آمدن نہیں — No cash inflow</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {rokarJama.length > 0 && (
                  <div style={{ padding: '14px 18px', background: 'rgba(52,211,153,0.06)', borderTop: '2px solid rgba(52,211,153,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>کل جمع</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)' }}>{formatPKR(totalRokarJama)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── DIVIDER ── */}
            <div style={{ width: 3, background: 'linear-gradient(to bottom, rgba(212,160,23,0.05), rgba(212,160,23,0.4), rgba(212,160,23,0.4), rgba(212,160,23,0.05))', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: 12, height: 12, background: 'var(--accent)', borderRadius: 2, boxShadow: '0 0 12px rgba(212,160,23,0.4)' }} />
            </div>

            {/* ── RIGHT: خرچ (Cash Out) ── */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(248,113,113,0.06)', borderRadius: '0 14px 0 0', border: '1px solid rgba(248,113,113,0.15)', borderLeft: 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(248,113,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MdTrendingUp style={{ fontSize: '1.3rem', color: 'var(--red)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>نقد خرچ — Cash Out</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--red)', lineHeight: 1.4 }}>خرچ <span className="urdu" style={{ fontSize: '0.85rem' }}>نقد خرید و روزانہ خرچہ۔</span></div>
                </div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid rgba(248,113,113,0.15)', borderTop: 'none', borderLeft: 'none', borderRadius: '0 0 14px 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="data-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Party</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rokarKharch.length > 0 ? rokarKharch.map((e, i) => {
                        const badge = getRokarBadge(e.type);
                        return (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(e.date)}</td>
                            <td>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
                                {badge.label}
                              </span>
                            </td>
                            <td>{e.party_name || '—'}{e.party_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.party_name_urdu}</span></> : ''}</td>
                            <td>{e.product_name || '—'}{e.product_name_urdu ? <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}</td>
                            <td className="amount" style={{ textAlign: 'right', color: badge.color, fontWeight: 700 }}>{formatPKR(e.amount)}</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>کوئی نقد خرچ نہیں — No cash outflow</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {rokarKharch.length > 0 && (
                  <div style={{ padding: '14px 18px', background: 'rgba(248,113,113,0.06)', borderTop: '2px solid rgba(248,113,113,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>کل خرچ</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--red)' }}>{formatPKR(totalRokarKharch)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cash Balance Footer */}
          <div style={{ padding: '16px 24px', borderRadius: 14, background: rokarBalance >= 0 ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${rokarBalance >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>نقد بیلنس — Cash Balance</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>کل جمع {formatPKR(totalRokarJama)} − کل خرچ {formatPKR(totalRokarKharch)}</div>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: rokarBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {rokarBalance < 0 ? '−' : '+'}{formatPKR(Math.abs(rokarBalance))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
