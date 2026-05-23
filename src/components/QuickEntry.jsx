import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MdAdd, MdDelete, MdSearch, MdClose, MdFlashOn, MdPlaylistAdd, MdSend, MdPersonAdd } from 'react-icons/md';
import { formatPKR, todayISO } from '../utils/formatters';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';
import { useToast } from './Toast';
import QESaleForm from './QESaleForm';
import './QuickEntry.css';

/* ──────────────────────────────────────────────────────────────
   Transaction types available depending on which tab is active
   ────────────────────────────────────────────────────────────── */
const ROZNAMCHA_TYPES = [
  { value: 'Payment In',  label: 'Payment In — وصولی' },
  { value: 'Payment Out', label: 'Payment Out — ادائیگی' },
];

const ROKAR_TYPES = [
  { value: 'Cash Received', label: 'Cash In — نقد وصولی' },
  { value: 'Cash Paid',     label: 'Cash Out — نقد ادائیگی' },
];

const emptyRow = () => ({
  id: Date.now() + Math.random(),
  partySearch: '',
  partyId: '',
  partyType: 'Buyer',
  partyName: '',
  txnType: '',
  productId: '',
  amount: '',
  narration: '',
});

export default function QuickEntry({ activeTab, onEntrySaved, onOpenChange }) {
  const toast = useToast();
  const [open, _setOpen] = useState(false);

  // Wrap setOpen to notify parent
  const setOpen = (val) => { _setOpen(val); onOpenChange?.(val); };
  const [bulkMode, setBulkMode] = useState(false);
  const [formType, setFormType] = useState(''); // '' = quick entry, 'Sale'/'Purchase' = full form
  const [rows, setRows] = useState([emptyRow()]);
  const [buyers, setBuyers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const dropdownRef = useRef(null);
  const firstInputRef = useRef(null);

  const [showQuickAdd, setShowQuickAdd] = useState(null);
  const [quickAddName, setQuickAddName] = useState('');

  const txnTypes = activeTab === 'rokar' ? ROKAR_TYPES : ROZNAMCHA_TYPES;

  useEffect(() => {
    const load = async () => {
      const allBuyers = await window.api.getBuyers();
      setBuyers(allBuyers.filter(b => b.status === 'Active'));
      const allSuppliers = await window.api.getSuppliers();
      setSuppliers(allSuppliers.filter(s => s.status === 'Active'));
      setProducts(await window.api.getProducts());
    };
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (open) {
      const defaultType = txnTypes[0]?.value || '';
      setRows(prev => prev.map(r => ({ ...r, txnType: r.txnType || defaultType })));
    }
  }, [activeTab, open]);

  const getAllParties = useCallback(() => {
    const list = [];
    buyers.forEach(b => list.push({ id: b.id, name: b.name, nameUrdu: b.name_urdu || '', type: 'Buyer', partyType: b.type }));
    suppliers.forEach(s => list.push({ id: s.id, name: s.name, nameUrdu: s.name_urdu || '', type: 'Supplier', partyType: s.type }));
    return list;
  }, [buyers, suppliers]);

  const filterParties = (query) => {
    if (!query.trim()) return getAllParties().slice(0, 15);
    const q = query.toLowerCase();
    return getAllParties().filter(p =>
      p.name.toLowerCase().includes(q) || (p.nameUrdu && p.nameUrdu.includes(query))
    ).slice(0, 15);
  };

  const updateRow = (rowId, field, value) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    const defaultType = txnTypes[0]?.value || '';
    setRows(prev => [...prev, { ...emptyRow(), txnType: defaultType }]);
  };

  const removeRow = (rowId) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== rowId) : prev);
  };

  const clearAll = () => {
    const defaultType = txnTypes[0]?.value || '';
    setRows([{ ...emptyRow(), txnType: defaultType }]);
  };

  const selectParty = (rowId, party) => {
    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r, partyId: party.id, partyType: party.type, partyName: party.name, partySearch: party.name,
    } : r));
    setActiveDropdown(null);
    setHighlightIdx(0);
  };

  const handleQuickAdd = async (rowId) => {
    if (!quickAddName.trim()) return;
    const result = await window.api.addBuyer({
      name: quickAddName.trim(), name_urdu: '', type: 'Regular',
      phone: '', address: '', cnic: '', opening_balance: 0, status: 'Active'
    });
    const newId = result.lastInsertRowid;
    const allBuyers = await window.api.getBuyers();
    setBuyers(allBuyers.filter(b => b.status === 'Active'));
    selectParty(rowId, { id: newId, type: 'Buyer', name: quickAddName.trim() });
    setShowQuickAdd(null);
    setQuickAddName('');
    toast.success(`"${quickAddName.trim()}" added as Buyer`);
  };

  const postEntry = async (row) => {
    const amount = parseFloat(row.amount);
    if (!amount || amount <= 0) throw new Error('Amount required');
    const date = todayISO();
    const { txnType, partyId, partyType, productId, narration } = row;

    if (activeTab === 'roznamcha') {
      if (!partyId) throw new Error('Party required for Payment');
      await window.api.addPayment({
        party_type: partyType, party_id: parseInt(partyId),
        date, amount, type: txnType === 'Payment In' ? 'Received' : 'Paid',
        mode: 'Cash', reference: '', notes: narration,
      });
    } else {
      if (!partyId) throw new Error('Party required');
      await window.api.addPayment({
        party_type: partyType, party_id: parseInt(partyId),
        date, amount, type: txnType === 'Cash Received' ? 'Received' : 'Paid',
        mode: 'Cash', reference: '', notes: narration,
      });
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let successCount = 0;
      for (const row of rows) {
        if (!row.amount || parseFloat(row.amount) <= 0) continue;
        await postEntry(row);
        successCount++;
      }
      if (successCount === 0) { toast.error('No valid entries to save'); setSaving(false); return; }
      toast.success(`${successCount} ${successCount === 1 ? 'entry' : 'entries'} posted — اندراج محفوظ`);
      clearAll();
      setOpen(false);
      onEntrySaved?.();
    } catch (err) { toast.error(err.message || 'Failed to save'); }
    setSaving(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); if (bulkMode) addRow(); }
      if (e.key === 'Escape') {
        if (activeDropdown) { setActiveDropdown(null); return; }
        if (showQuickAdd) { setShowQuickAdd(null); return; }
        clearAll(); setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, bulkMode, activeDropdown, showQuickAdd]);

  useEffect(() => {
    if (!activeDropdown) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setActiveDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeDropdown]);

  const draftTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const validRowCount = rows.filter(r => parseFloat(r.amount) > 0).length;

  /* ─────────────── CLOSED STATE: Trigger Button ─────────────── */
  if (!open) {
    return (
      <button
        className="btn btn-primary qe-trigger-btn"
        onClick={() => { setOpen(true); setTimeout(() => firstInputRef.current?.focus(), 100); }}
        title="Quick Entry"
        id="quick-entry-trigger"
      >
        <MdFlashOn style={{ fontSize: '1.1rem' }} />
        Quick Entry — <span className="urdu" style={{ fontSize: '0.82rem' }}>فوری اندراج</span>
      </button>
    );
  }

  /* ─────────────── OPEN STATE: Panel ─────────────── */
  return (
    <div className="qe-panel fade-in" id="quick-entry-panel">
      {/* ── Header ── */}
      <div className="qe-header">
        <div className="qe-header-left">
          <div className="qe-header-icon"><MdFlashOn /></div>
          <div>
            <div className="qe-title">Quick Entry — <span className="urdu">فوری اندراج</span></div>
            <div className="qe-subtitle">
              {activeTab === 'roznamcha' ? 'Roznamcha — روزنامچہ' : 'Rokar Khata — روکڑ کھاتہ'}
              {bulkMode && !formType && <span className="qe-bulk-badge">BULK</span>}
              {formType && <span className="qe-bulk-badge" style={{ color: formType === 'Sale' ? 'var(--green)' : 'var(--accent2)', background: formType === 'Sale' ? 'var(--green-glow)' : 'var(--accent2-glow)' }}>{formType.toUpperCase()}</span>}
            </div>
          </div>
        </div>
        <div className="qe-header-right">
          {/* Type Selector */}
          <div className="qe-mode-toggle">
            <button className={`qe-mode-btn ${!formType ? 'active' : ''}`}
              onClick={() => { setFormType(''); }}
              title="Quick entry for Payments">💰 Payment</button>
            <button className={`qe-mode-btn ${formType === 'Sale' ? 'active' : ''}`}
              onClick={() => setFormType('Sale')}
              style={formType === 'Sale' ? { background: 'var(--green)', color: '#fff' } : {}}
              title="Full Sale Form">📦 Sale</button>
            <button className={`qe-mode-btn ${formType === 'Purchase' ? 'active' : ''}`}
              onClick={() => setFormType('Purchase')}
              style={formType === 'Purchase' ? { background: 'var(--accent2)', color: '#fff' } : {}}
              title="Full Purchase Form">🛒 Purchase</button>
          </div>
          <button className="qe-close-btn" onClick={() => { clearAll(); setFormType(''); setOpen(false); }} title="Close (Esc)"><MdClose /></button>
        </div>
      </div>

      {/* ── Sale/Purchase Full Form ── */}
      {formType && (
        <div className="qe-body" style={{ padding: '20px 24px' }}>
          <QESaleForm
            type={formType}
            onSaved={() => { setFormType(''); setOpen(false); onEntrySaved?.(); }}
            onCancel={() => setFormType('')}
          />
        </div>
      )}

      {/* ── Quick Entry Rows (Payment/Expense) ── */}
      {!formType && (
      <>
      <div className="qe-body">
        {/* Single/Bulk toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {bulkMode ? `${rows.length} Payment${rows.length > 1 ? 's' : ''}` : 'New Payment'}
          </div>
          <div className="qe-mode-toggle">
            <button className={`qe-mode-btn ${!bulkMode ? 'active' : ''}`}
              onClick={() => { setBulkMode(false); setRows([rows[0] || emptyRow()]); }}>Single</button>
            <button className={`qe-mode-btn ${bulkMode ? 'active' : ''}`}
              onClick={() => setBulkMode(true)}><MdPlaylistAdd style={{ fontSize: '1rem', verticalAlign: 'middle' }} /> Bulk</button>
          </div>
        </div>
        {rows.map((row, idx) => (
          <div className="qe-entry-row" key={row.id}>
            {/* Row number for bulk */}
            {bulkMode && <div className="qe-row-num">{idx + 1}</div>}

            {/* Fields grid */}
            <div className="qe-fields-grid">
              {/* ── Party Search ── */}
              <div className="qe-field qe-field-party" ref={activeDropdown === row.id ? dropdownRef : null}>
                <label className="qe-field-label">Party / Account</label>
                <div className="qe-input-wrap">
                  <MdSearch className="qe-input-icon" />
                  <input
                    ref={idx === 0 ? firstInputRef : null}
                    className="qe-input"
                    type="text"
                    placeholder="Search party..."
                    value={row.partySearch}
                    onChange={(e) => {
                      updateRow(row.id, 'partySearch', e.target.value);
                      updateRow(row.id, 'partyId', '');
                      updateRow(row.id, 'partyName', '');
                      setActiveDropdown(row.id);
                      setHighlightIdx(0);
                    }}
                    onFocus={() => { setActiveDropdown(row.id); setHighlightIdx(0); }}
                    onKeyDown={(e) => {
                      const filtered = filterParties(row.partySearch);
                      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(p => Math.min(p + 1, filtered.length)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(p => Math.max(p - 1, 0)); }
                      else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (highlightIdx < filtered.length) selectParty(row.id, filtered[highlightIdx]);
                        else if (highlightIdx === filtered.length && row.partySearch.trim()) {
                          setShowQuickAdd(row.id); setQuickAddName(row.partySearch.trim()); setActiveDropdown(null);
                        }
                      }
                      else if (e.key === 'Escape') setActiveDropdown(null);
                      else if (e.key === 'Tab' && activeDropdown === row.id) setActiveDropdown(null);
                    }}
                    style={row.partyId ? { color: 'var(--green)', fontWeight: 600 } : {}}
                  />
                  {row.partyId && (
                    <button className="qe-input-clear" onClick={() => {
                      updateRow(row.id, 'partySearch', ''); updateRow(row.id, 'partyId', ''); updateRow(row.id, 'partyName', '');
                    }}><MdClose /></button>
                  )}
                </div>

                {/* Dropdown */}
                {activeDropdown === row.id && (
                  <div className="qe-dropdown">
                    {filterParties(row.partySearch).map((p, i) => (
                      <div key={`${p.type}-${p.id}`}
                        className={`qe-dropdown-item ${i === highlightIdx ? 'highlighted' : ''}`}
                        onClick={() => selectParty(row.id, p)}
                        onMouseEnter={() => setHighlightIdx(i)}>
                        <span className="qe-party-name">{p.name}</span>
                        <span className="qe-party-meta">
                          {p.nameUrdu && <span className="urdu" style={{ fontSize: '0.78rem' }}>{p.nameUrdu}</span>}
                          <span className={`qe-party-type-tag ${p.type === 'Buyer' ? 'buyer' : 'supplier'}`}>{p.type}</span>
                        </span>
                      </div>
                    ))}
                    <div className={`qe-dropdown-item qe-dropdown-add ${highlightIdx === filterParties(row.partySearch).length ? 'highlighted' : ''}`}
                      onClick={() => { setShowQuickAdd(row.id); setQuickAddName(row.partySearch.trim()); setActiveDropdown(null); }}
                      onMouseEnter={() => setHighlightIdx(filterParties(row.partySearch).length)}>
                      <MdPersonAdd style={{ fontSize: '1rem', color: 'var(--accent)' }} />
                      <span>Add New Party{row.partySearch.trim() ? `: "${row.partySearch.trim()}"` : ''}</span>
                    </div>
                  </div>
                )}

                {/* Quick-add form */}
                {showQuickAdd === row.id && (
                  <div className="qe-quickadd">
                    <div className="qe-quickadd-title"><MdPersonAdd /> Add New Party</div>
                    <input className="qe-input" value={quickAddName} onChange={e => setQuickAddName(e.target.value)}
                      placeholder="Party name..." autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleQuickAdd(row.id); }
                        if (e.key === 'Escape') { setShowQuickAdd(null); setQuickAddName(''); }
                      }} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => handleQuickAdd(row.id)} style={{ flex: 1 }}><MdAdd /> Add as Buyer</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setShowQuickAdd(null); setQuickAddName(''); }}><MdClose /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Type ── */}
              <div className="qe-field qe-field-type">
                <label className="qe-field-label">Type</label>
                <select className="qe-select" value={row.txnType} onChange={e => updateRow(row.id, 'txnType', e.target.value)}>
                  <option value="">Select Type</option>
                  {txnTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* ── Product ── */}
              <div className="qe-field qe-field-product">
                <label className="qe-field-label">Product</label>
                <select className="qe-select" value={row.productId} onChange={e => updateRow(row.id, 'productId', e.target.value)}>
                  <option value="">— Optional —</option>
                  {products.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* ── Amount ── */}
              <div className="qe-field qe-field-amount">
                <label className="qe-field-label">Amount (PKR)</label>
                <input className="qe-input qe-amount" type="number" step="0.01" placeholder="0.00"
                  value={row.amount}
                  onKeyDown={(e) => { blockInvalidChars(e); if (e.key === 'Enter' && !bulkMode) { e.preventDefault(); handleSubmit(); } }}
                  onWheel={preventScrollChange}
                  onChange={e => updateRow(row.id, 'amount', e.target.value)} />
              </div>

              {/* ── Narration ── */}
              <div className="qe-field qe-field-narration">
                <label className="qe-field-label">Narration</label>
                <input className="qe-input" type="text" placeholder="Details / تفصیل"
                  value={row.narration} onChange={e => updateRow(row.id, 'narration', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !bulkMode) { e.preventDefault(); handleSubmit(); } }} />
              </div>
            </div>

            {/* Remove button (bulk) */}
            {bulkMode && (
              <button className="qe-remove-btn" onClick={() => removeRow(row.id)}
                title="Remove row" tabIndex={-1} disabled={rows.length <= 1}><MdDelete /></button>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="qe-footer">
        <div className="qe-footer-left">
          {bulkMode && (
            <button className="btn btn-sm btn-secondary qe-add-row-btn" onClick={addRow} title="Add Row (Ctrl+N)">
              <MdAdd /> Add Row
            </button>
          )}
          <div className="qe-draft-info">
            {validRowCount > 0 && (
              <>
                <span className="qe-draft-count">{validRowCount} {validRowCount === 1 ? 'entry' : 'entries'}</span>
                <span className="qe-draft-sep">·</span>
                <span className="qe-draft-total">{formatPKR(draftTotal)}</span>
              </>
            )}
          </div>
        </div>
        <div className="qe-footer-right">
          <span className="qe-hint">Tab ↹  ·  Enter ↵  ·  Esc ✕</span>
          <button className="btn btn-primary qe-submit-btn" onClick={handleSubmit}
            disabled={saving || validRowCount === 0}>
            <MdSend style={{ fontSize: '1rem' }} />
            {saving ? 'Saving...' : bulkMode ? `Post All (${validRowCount})` : 'Post Entry'}
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
