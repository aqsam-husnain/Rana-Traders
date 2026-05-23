import React, { useState, useEffect } from 'react';
import { MdAdd, MdClose, MdSend, MdDelete, MdPlaylistAdd } from 'react-icons/md';
import { formatPKR, todayISO } from '../utils/formatters';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';
import SearchableSelect from './SearchableSelect';
import { useToast } from './Toast';
import './QuickEntry.css';

/* ── Default empty form row ── */
const emptyForm = (isSale) => ({
  id: Date.now() + Math.random(),
  party_id: '', product_id: '', date: todayISO(),
  total_weight: '', kaat: 0, rate: '',
  commission: 0, bardana: 0, labour: 0,
  munshiyana: 0, kiraya: 0, others: 0,
  payment_mode: 'On Account', notes: '', unit: 'KG',
  amount_paid: 0, payment_status: isSale ? 'To Receive' : 'To Pay',
});

/* ── Inline Sale/Purchase form for Quick Entry ── */
export default function QESaleForm({ type, onSaved, onCancel }) {
  const toast = useToast();
  const isSale = type === 'Sale';
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [rows, setRows] = useState([emptyForm(isSale)]);

  useEffect(() => {
    const load = async () => {
      if (isSale) {
        const all = await window.api.getBuyers();
        setParties(all.filter(b => b.status === 'Active'));
      } else {
        const all = await window.api.getSuppliers();
        setParties(all.filter(s => s.status === 'Active'));
      }
      setProducts(await window.api.getProducts());
      setUnits(await window.api.getUnits());
    };
    load();
  }, [isSale]);

  // Reset rows when type changes
  useEffect(() => {
    setRows([emptyForm(isSale)]);
    setBulkMode(false);
  }, [type]);

  const getDefaultPercent = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    return p ? p.commission_rate : 0;
  };

  const calcCommission = (qty, rate, percent) =>
    ((parseFloat(qty) || 0) * (parseFloat(rate) || 0) * (parseFloat(percent) || 0) / 100).toFixed(2);

  const recalcCommission = (qty, rate, pid) =>
    calcCommission(qty, rate, getDefaultPercent(pid));

  const updateRow = (rowId, updates) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...updates } : r));
  };

  const handleProductChange = (rowId, pid, row) => {
    const p = products.find(x => x.id === parseInt(pid));
    const safi = Math.max(0, (parseFloat(row.total_weight) || 0) - (parseFloat(row.kaat) || 0));
    const comm = recalcCommission(safi, row.rate, pid);
    updateRow(rowId, { product_id: pid, unit: p ? p.unit : '', commission: comm });
  };

  const handleWeightChange = (rowId, tw, row) => {
    const safi = Math.max(0, (parseFloat(tw) || 0) - (parseFloat(row.kaat) || 0));
    const comm = recalcCommission(safi, row.rate, row.product_id);
    updateRow(rowId, { total_weight: tw, commission: comm });
  };

  const handleKaatChange = (rowId, k, row) => {
    const safi = Math.max(0, (parseFloat(row.total_weight) || 0) - (parseFloat(k) || 0));
    const comm = recalcCommission(safi, row.rate, row.product_id);
    updateRow(rowId, { kaat: k, commission: comm });
  };

  const handleRateChange = (rowId, r, row) => {
    const safi = Math.max(0, (parseFloat(row.total_weight) || 0) - (parseFloat(row.kaat) || 0));
    const comm = recalcCommission(safi, r, row.product_id);
    updateRow(rowId, { rate: r, commission: comm });
  };

  const getSafi = (row) => Math.max(0, (parseFloat(row.total_weight) || 0) - (parseFloat(row.kaat) || 0));
  const getTotal = (row) => getSafi(row) * (parseFloat(row.rate) || 0);
  const getDeductions = (row) =>
    (parseFloat(row.commission) || 0) + (parseFloat(row.bardana) || 0) +
    (parseFloat(row.labour) || 0) + (parseFloat(row.munshiyana) || 0) +
    (parseFloat(row.kiraya) || 0) + (parseFloat(row.others) || 0);
  const getNet = (row) => getTotal(row) - getDeductions(row);

  const addRow = () => setRows(prev => [...prev, emptyForm(isSale)]);
  const removeRow = (rowId) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== rowId) : prev);

  const handleSave = async () => {
    setSaving(true);
    try {
      let successCount = 0;
      for (const row of rows) {
        const safi = getSafi(row);
        const total = getTotal(row);
        const net = getNet(row);
        if (!row.product_id || safi <= 0) continue;
        if (!row.party_id) continue;

        const amountPaid = parseFloat(row.amount_paid) || 0;
        const paymentStatus = (() => {
          if (amountPaid <= 0) return isSale ? 'To Receive' : 'To Pay';
          if (amountPaid >= net) return isSale ? 'Received' : 'Paid';
          return 'Partial';
        })();

        const payload = {
          [isSale ? 'buyer_id' : 'supplier_id']: parseInt(row.party_id),
          product_id: parseInt(row.product_id), date: row.date,
          quantity: safi, rate: parseFloat(row.rate), total,
          commission: parseFloat(row.commission) || 0,
          bardana: parseFloat(row.bardana) || 0,
          labour: parseFloat(row.labour) || 0, net_amount: net,
          payment_mode: row.payment_mode, notes: row.notes,
          amount_paid: amountPaid, payment_status: paymentStatus,
          unit: row.unit || null, commission_type: 'default',
          total_weight: parseFloat(row.total_weight) || 0,
          kaat: parseFloat(row.kaat) || 0,
          munshiyana: parseFloat(row.munshiyana) || 0,
          kiraya: parseFloat(row.kiraya) || 0,
          others: parseFloat(row.others) || 0,
          extra_expenses: null,
        };

        if (isSale) await window.api.addSale(payload);
        else await window.api.addPurchase(payload);
        successCount++;
      }

      if (successCount === 0) { toast.error('No valid entries to save'); setSaving(false); return; }
      toast.success(`${successCount} ${type}${successCount > 1 ? 's' : ''} saved — ${isSale ? 'فروخت' : 'خریداری'} محفوظ`);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  const partyLabel = isSale ? 'Buyer — خریدار' : 'Supplier — سپلائر';
  const numProps = { onKeyDown: blockInvalidChars, onWheel: preventScrollChange };
  const validCount = rows.filter(r => r.product_id && r.party_id && getSafi(r) > 0).length;
  const grandTotal = rows.reduce((s, r) => s + getNet(r), 0);

  const renderRow = (row, idx) => {
    const safi = getSafi(row);
    const total = getTotal(row);
    const deductions = getDeductions(row);
    const net = getNet(row);

    return (
      <div key={row.id} className="qe-sale-row" style={{
        padding: '16px 0',
        borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {bulkMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 10px', borderRadius: 6 }}>#{idx + 1}</span>
            <button className="btn btn-sm btn-danger" onClick={() => removeRow(row.id)} disabled={rows.length <= 1}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}><MdDelete /> Remove</button>
          </div>
        )}

        <div className="form-grid">
          {/* Row 1: Party, Product, Unit */}
          <div className="form-group">
            <label>{partyLabel}</label>
            <SearchableSelect value={row.party_id}
              onChange={val => updateRow(row.id, { party_id: val })}
              placeholder={`Search ${isSale ? 'Buyer' : 'Supplier'}...`}
              options={parties.map(p => ({
                value: String(p.id), label: p.name,
                labelUrdu: p.name_urdu || '',
                searchText: `${p.name} ${p.name_urdu || ''}`
              }))} />
          </div>
          <div className="form-group">
            <label>Product — جنس</label>
            <select required value={row.product_id} onChange={e => handleProductChange(row.id, e.target.value, row)}>
              <option value="">Select Product</option>
              {products.filter(p => p.status === 'Active').map(p =>
                <option key={p.id} value={p.id}>{p.name} — {p.name_urdu}</option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Unit — اکائی</label>
            <select value={row.unit} onChange={e => updateRow(row.id, { unit: e.target.value })}>
              {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </div>

          {/* Row 2: Weight fields + Rate */}
          <div className="form-group">
            <label>Total Weight — <span className="urdu">کل وزن</span></label>
            <input type="number" step="0.01" required value={row.total_weight}
              {...numProps} onChange={e => handleWeightChange(row.id, e.target.value, row)} />
          </div>
          <div className="form-group">
            <label>Kaat — <span className="urdu">کاٹ</span></label>
            <input type="number" step="0.01" value={row.kaat}
              {...numProps} onChange={e => handleKaatChange(row.id, e.target.value, row)} />
          </div>
          <div className="form-group">
            <label>Safi — <span className="urdu">صافی</span></label>
            <input type="number" value={safi.toFixed(2)} readOnly
              style={{ opacity: 0.8, cursor: 'not-allowed', fontWeight: 700, color: 'var(--green)' }} />
          </div>
          <div className="form-group">
            <label>Rate — <span className="urdu">ریٹ</span></label>
            <input type="number" step="0.01" required value={row.rate}
              {...numProps} onChange={e => handleRateChange(row.id, e.target.value, row)} />
          </div>

          {/* Row 3: Deductions */}
          <div className="form-group">
            <label>Bardana — <span className="urdu">باردانہ</span></label>
            <input type="number" step="0.01" value={row.bardana}
              {...numProps} onChange={e => updateRow(row.id, { bardana: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Labour — <span className="urdu">مزدوری</span></label>
            <input type="number" step="0.01" value={row.labour}
              {...numProps} onChange={e => updateRow(row.id, { labour: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Munshiyana — <span className="urdu">مُنشِیانَہ</span></label>
            <input type="number" step="0.01" value={row.munshiyana}
              {...numProps} onChange={e => updateRow(row.id, { munshiyana: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Kiraya — <span className="urdu">کرایہ</span></label>
            <input type="number" step="0.01" value={row.kiraya}
              {...numProps} onChange={e => updateRow(row.id, { kiraya: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Others — <span className="urdu">دیگر</span></label>
            <input type="number" step="0.01" value={row.others}
              {...numProps} onChange={e => updateRow(row.id, { others: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Commission — <span className="urdu">کمیشن</span></label>
            <input type="number" step="0.01" value={row.commission} readOnly
              style={{ opacity: 0.7, cursor: 'not-allowed' }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Auto @ {getDefaultPercent(row.product_id)}%
            </span>
          </div>

          {/* Row 4: Payment Section */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: isSale ? 'var(--accent)' : 'var(--accent2)', marginBottom: 6 }}>
              💰 {isSale ? 'Payment from Buyer — خریدار سے وصولی' : 'Payment to Supplier — سپلائر کو ادائیگی'}
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button type="button" className={`tab ${row.payment_status === (isSale ? 'To Receive' : 'To Pay') ? 'active' : ''}`}
                onClick={() => updateRow(row.id, { payment_status: isSale ? 'To Receive' : 'To Pay', amount_paid: 0, payment_mode: 'On Account' })}
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
                {isSale ? 'To Receive — بعد میں وصولی' : 'To Pay — بعد میں ادائیگی'}
              </button>
              <button type="button" className={`tab ${row.payment_status !== (isSale ? 'To Receive' : 'To Pay') ? 'active' : ''}`}
                onClick={() => updateRow(row.id, { payment_status: 'Partial', amount_paid: row.amount_paid || '' })}
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
                {isSale ? 'Receive Now — ابھی وصولی' : 'Pay Now — ابھی ادائیگی'}
              </button>
            </div>
            {row.payment_status !== (isSale ? 'To Receive' : 'To Pay') && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="number" step="0.01" value={row.amount_paid}
                  {...numProps}
                  onChange={e => {
                    const paid = parseFloat(e.target.value) || 0;
                    updateRow(row.id, {
                      amount_paid: e.target.value,
                      payment_status: paid >= net ? (isSale ? 'Received' : 'Paid') : 'Partial'
                    });
                  }}
                  placeholder={`Amount ${isSale ? 'received' : 'to pay'}...`}
                  style={{ flex: 1 }} />
                <button type="button" className="btn btn-sm btn-secondary"
                  onClick={() => updateRow(row.id, { amount_paid: net, payment_status: isSale ? 'Received' : 'Paid' })}
                  style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>Full Amount</button>
                <select value={row.payment_mode} onChange={e => updateRow(row.id, { payment_mode: e.target.value })}
                  style={{ maxWidth: 160, fontSize: '0.82rem' }}>
                  <option value="Cash">Cash — نقد</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque — چیک</option>
                  <option value="Online">Online / JazzCash</option>
                </select>
              </div>
            )}
            {row.payment_status === (isSale ? 'To Receive' : 'To Pay') && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ادھار — No payment now, added to {isSale ? "buyer's" : "supplier's"} balance
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>Notes — نوٹ</label>
            <input value={row.notes} onChange={e => updateRow(row.id, { notes: e.target.value })} />
          </div>
        </div>

        {/* Per-row totals */}
        <div className="qe-sale-totals">
          <div className="qe-sale-total-item">
            <span>Total — کل رقم</span>
            <strong>{formatPKR(total)}</strong>
          </div>
          <div className="qe-sale-total-item">
            <span>Deductions — کٹوتی</span>
            <strong style={{ color: 'var(--red)' }}>−{formatPKR(deductions)}</strong>
          </div>
          <div className="qe-sale-total-item qe-sale-net">
            <span>Net Amount — خالص</span>
            <strong style={{ color: isSale ? 'var(--green)' : 'var(--accent2)', fontSize: '1.1rem' }}>{formatPKR(net)}</strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="qe-sale-form fade-in">
      {/* Bulk toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {bulkMode ? `${rows.length} ${type}${rows.length > 1 ? 's' : ''}` : `New ${type}`}
        </div>
        <div className="qe-mode-toggle">
          <button className={`qe-mode-btn ${!bulkMode ? 'active' : ''}`}
            onClick={() => { setBulkMode(false); setRows([rows[0] || emptyForm(isSale)]); }}>Single</button>
          <button className={`qe-mode-btn ${bulkMode ? 'active' : ''}`}
            onClick={() => setBulkMode(true)}>
            <MdPlaylistAdd style={{ fontSize: '1rem', verticalAlign: 'middle' }} /> Bulk
          </button>
        </div>
      </div>

      {/* Form rows */}
      <div style={{ maxHeight: bulkMode ? 'calc(100vh - 380px)' : 'none', overflowY: bulkMode ? 'auto' : 'visible' }}>
        {rows.map((row, idx) => renderRow(row, idx))}
      </div>

      {/* Bulk add row button */}
      {bulkMode && (
        <button className="btn btn-sm btn-secondary" onClick={addRow}
          style={{ marginTop: 12, gap: 4, fontSize: '0.8rem' }}>
          <MdAdd /> Add Another {type}
        </button>
      )}

      {/* Grand total for bulk */}
      {bulkMode && rows.length > 1 && (
        <div style={{
          marginTop: 12, padding: '10px 16px', borderRadius: 8,
          background: 'var(--accent-glow)', border: '1px solid rgba(212,160,23,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.88rem', fontWeight: 700,
        }}>
          <span>Grand Total ({validCount} entries)</span>
          <span style={{ color: 'var(--accent)', fontSize: '1.05rem' }}>{formatPKR(grandTotal)}</span>
        </div>
      )}

      {/* Actions */}
      <div className="qe-sale-actions">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || validCount === 0}
          style={{ gap: 6 }}>
          <MdSend style={{ fontSize: '1rem' }} />
          {saving ? 'Saving...' : bulkMode ? `Save All ${type}s (${validCount})` : `Save ${type}`}
        </button>
      </div>
    </div>
  );
}
