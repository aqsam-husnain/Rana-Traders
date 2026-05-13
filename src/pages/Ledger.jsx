import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatPKR, formatDate, todayISO } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import { useToast } from '../components/Toast';

export default function Ledger() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('type') || 'buyer');
  const [buyers, setBuyers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || '');
  const [ledger, setLedger] = useState(null);
  const toast = useToast();

  useEffect(() => {
    window.api.getBuyers().then(all => setBuyers(all.filter(c => c.type === 'Regular')));
    window.api.getSuppliers().then(all => setSuppliers(all.filter(d => d.type === 'Regular')));
  }, []);

  useEffect(() => {
    if (selectedId) loadLedger();
    else setLedger(null);
  }, [selectedId, tab]);

  const loadLedger = async () => {
    if (tab === 'buyer') setLedger(await window.api.getBuyerLedger(parseInt(selectedId)));
    else setLedger(await window.api.getSupplierLedger(parseInt(selectedId)));
  };

  const partyList = tab === 'buyer' ? buyers : suppliers;
  let runningBalance = ledger?.buyer?.opening_balance || ledger?.supplier?.opening_balance || 0;

  // Build rows with running balance for export
  const buildExportData = () => {
    if (!ledger || !ledger.entries) return { columns: [], rows: [], summary: [] };
    const partyName = ledger.buyer?.name || ledger.supplier?.name || '';
    const openBal = ledger.buyer?.opening_balance || ledger.supplier?.opening_balance || 0;
    let bal = openBal;
    const columns = ['#', 'Date', 'Type', 'Product', 'Qty', 'Rate', 'Debit', 'Credit', 'Balance'];
    const rows = [['', '', '', '', '', '', '', '', formatPKR(openBal)]]; // Opening balance row
    ledger.entries.forEach((e, i) => {
      bal += (e.debit || 0) - (e.credit || 0);
      rows.push([i + 1, formatDate(e.date), e.type, e.product_name || '—', e.quantity || '—', e.rate ? formatPKR(e.rate) : '—', e.debit ? formatPKR(e.debit) : '—', e.credit ? formatPKR(e.credit) : '—', formatPKR(bal)]);
    });
    const totalDebit = ledger.entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = ledger.entries.reduce((s, e) => s + (e.credit || 0), 0);
    const summary = [{ label: 'Party', value: partyName }, { label: 'Total Debit', value: formatPKR(totalDebit) }, { label: 'Total Credit', value: formatPKR(totalCredit) }, { label: 'Final Balance', value: formatPKR(bal) }];
    return { columns, rows, summary, partyName };
  };

  const handleExport = async (format) => {
    if (!ledger || !ledger.entries || ledger.entries.length === 0) return;
    const { columns, rows, summary, partyName } = buildExportData();
    const typeLabel = tab === 'buyer' ? 'Buyer' : 'Supplier';
    const exportData = { title: `${typeLabel} Ledger — ${partyName} — کھاتا`, columns, rows, summary, dateRange: '' };
    let saved = false; const ts = fileTimestamp();
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `Ledger_${partyName.replace(/\s+/g, '_')}_${ts}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `Ledger_${partyName.replace(/\s+/g, '_')}_${ts}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `Ledger_${partyName.replace(/\s+/g, '_')}_${ts}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Khata / Ledger — <span className="urdu">کھاتا</span></h2>
        <ExportDropdown onExport={handleExport} disabled={!ledger || !ledger.entries || ledger.entries.length === 0} />
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'buyer' ? 'active' : ''}`} onClick={() => { setTab('buyer'); setSelectedId(''); setLedger(null); }}>Buyer Ledger</button>
        <button className={`tab ${tab === 'supplier' ? 'active' : ''}`} onClick={() => { setTab('supplier'); setSelectedId(''); setLedger(null); }}>Supplier Ledger</button>
      </div>
      <div className="filter-row">
        <div className="form-group" style={{ minWidth: 250 }}>
          <label>Select {tab === 'buyer' ? 'Buyer' : 'Supplier'}</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">— Choose —</option>
            {partyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      {ledger && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3>{ledger.buyer?.name || ledger.supplier?.name} {ledger.buyer?.name_urdu || ledger.supplier?.name_urdu ? <span className="urdu">({ledger.buyer?.name_urdu || ledger.supplier?.name_urdu})</span> : ''}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Opening Balance: <strong>{formatPKR(ledger.buyer?.opening_balance || ledger.supplier?.opening_balance || 0)}</strong></span>
          </div>
          <div className="data-table-wrapper" style={{ border: 'none' }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Rate</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
              <tbody>
                <tr style={{ background: 'var(--glass)' }}><td colSpan={5}><strong>Opening Balance</strong></td><td></td><td></td><td className="amount" style={{ fontWeight: 700 }}>{formatPKR(runningBalance)}</td></tr>
                {ledger.entries.map((e, i) => {
                  runningBalance += (e.debit || 0) - (e.credit || 0);
                  return (
                    <tr key={i}>
                      <td>{formatDate(e.date)}</td>
                      <td><span className={`badge ${e.type === 'Sale' || e.type === 'Purchase' ? 'badge-regular' : 'badge-active'}`}>{e.type}</span></td>
                      <td>{e.product_name || '—'}{e.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}</td><td>{e.quantity || '—'}</td>
                      <td>{e.rate ? formatPKR(e.rate) : '—'}</td>
                      <td className="amount positive">{e.debit ? formatPKR(e.debit) : '—'}</td>
                      <td className="amount negative">{e.credit ? formatPKR(e.credit) : '—'}</td>
                      <td className="amount" style={{ fontWeight: 700 }}>{formatPKR(runningBalance)}</td>
                    </tr>
                  );
                })}
                {ledger.entries.length === 0 && <tr><td colSpan={8} className="text-center" style={{ padding: 30, color: 'var(--text-muted)' }}>No entries</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
