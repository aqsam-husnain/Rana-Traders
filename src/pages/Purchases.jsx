import React, { useState, useEffect } from 'react';
import { MdAdd, MdDelete, MdPerson, MdPersonOutline, MdClose } from 'react-icons/md';
import { formatPKR, formatDate, todayISO, formatNumber } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [partyType, setPartyType] = useState('Regular');
  const [walkInName, setWalkInName] = useState('');
  const [commissionMode, setCommissionMode] = useState('default');
  const [customPercent, setCustomPercent] = useState('');
  const [showUnitInput, setShowUnitInput] = useState(false);
  const [newUnit, setNewUnit] = useState('');
  const [form, setForm] = useState({ supplier_id: '', product_id: '', date: todayISO(), quantity: '', rate: '', commission: 0, bardana: 0, labour: 0, payment_mode: 'On Account', notes: '', amount_paid: 0, payment_status: 'To Pay', unit: '' });

  useEffect(() => { load(); }, []);
  const load = async () => {
    setPurchases(await window.api.getPurchases());
    const allSuppliers = await window.api.getSuppliers();
    setSuppliers(allSuppliers.filter(d => d.type === 'Regular' && d.status === 'Active'));
    setProducts(await window.api.getProducts());
    setUnits(await window.api.getUnits());
  };

  const total = (parseFloat(form.quantity) || 0) * (parseFloat(form.rate) || 0);
  const net = total + (parseFloat(form.commission) || 0) + (parseFloat(form.bardana) || 0) + (parseFloat(form.labour) || 0);
  const getDefaultPercent = (pid) => { const p = products.find(x => x.id === parseInt(pid || form.product_id)); return p ? p.commission_rate : 0; };
  const calcCommission = (qty, rate, percent) => ((parseFloat(qty) || 0) * (parseFloat(rate) || 0) * (parseFloat(percent) || 0) / 100).toFixed(2);
  const recalcCommission = (qty, rate, pid) => calcCommission(qty, rate, getDefaultPercent(pid));
  const switchPartyType = (type) => { setPartyType(type); if (type === 'Walk-in') { setWalkInName(`Walk-in Supplier #${Math.floor(1000 + Math.random() * 9000)}`); setForm({ ...form, supplier_id: '' }); } else setWalkInName(''); };

  const handleProductChange = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    let newCommission;
    if (commissionMode === 'default') {
      newCommission = recalcCommission(form.quantity, form.rate, pid);
    } else {
      newCommission = calcCommission(form.quantity, form.rate, customPercent);
    }
    setForm({ ...form, product_id: pid, unit: p ? p.unit : '', commission: newCommission });
    setShowUnitInput(false);
    setNewUnit('');
  };

  const openForm = () => {
    setPartyType('Regular'); setWalkInName(''); setCommissionMode('default'); setCustomPercent('');
    setShowUnitInput(false); setNewUnit('');
    setForm({ supplier_id: '', product_id: '', date: todayISO(), quantity: '', rate: '', commission: 0, bardana: 0, labour: 0, payment_mode: 'On Account', notes: '', amount_paid: 0, payment_status: 'To Pay', unit: '' });
    setShowForm(true);
  };

  const updatePaymentStatus = (amtPaid) => {
    const paid = parseFloat(amtPaid) || 0;
    if (paid <= 0) return 'To Pay';
    if (paid >= net) return 'Paid';
    return 'Partial';
  };

  const handleAddUnit = async () => {
    const trimmed = newUnit.trim();
    if (!trimmed) return;
    await window.api.addUnit(trimmed);
    setNewUnit('');
    setShowUnitInput(false);
    const updatedUnits = await window.api.getUnits();
    setUnits(updatedUnits);
    setForm({ ...form, unit: trimmed });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const qty = parseFloat(form.quantity) || 0;
    if (!form.product_id) return alert('Please select a product');
    if (qty <= 0) return alert('Quantity must be greater than 0');
    let supplierId;
    if (partyType === 'Walk-in') { const result = await window.api.addSupplier({ name: walkInName || 'Walk-in Supplier', name_urdu: '', type: 'Walk-in', phone: '', address: '', cnic: '', opening_balance: 0, status: 'Active' }); supplierId = result.lastInsertRowid; }
    else { supplierId = parseInt(form.supplier_id); if (!supplierId) return alert('Please select a supplier'); }

    const amountPaid = parseFloat(form.amount_paid) || 0;
    const paymentStatus = updatePaymentStatus(amountPaid);

    await window.api.addPurchase({
      supplier_id: supplierId, product_id: parseInt(form.product_id), date: form.date,
      quantity: qty, rate: parseFloat(form.rate), total,
      commission: parseFloat(form.commission) || 0, bardana: parseFloat(form.bardana) || 0,
      labour: parseFloat(form.labour) || 0, net_amount: net,
      payment_mode: form.payment_mode, notes: form.notes,
      amount_paid: amountPaid, payment_status: paymentStatus,
      unit: form.unit || null, commission_type: commissionMode
    });
    setShowForm(false); load();
  };
  const handleDelete = async (id) => { if (confirm('Delete this purchase?')) { await window.api.deletePurchase(id); load(); } };

  const handleExport = (format) => {
    if (purchases.length === 0) return;
    const columns = ['#', 'Date', 'Supplier / سپلائر', 'Product / جنس', 'Qty', 'Unit', 'Rate', 'Total', 'Commission', 'Net Amount', 'Payment', 'Paid'];
    const rows = purchases.map((p, i) => [i + 1, formatDate(p.date), (p.supplier_name || '—') + (p.supplier_name_urdu ? '\n' + p.supplier_name_urdu : ''), p.product_name + (p.product_name_urdu ? '\n' + p.product_name_urdu : ''), formatNumber(p.quantity), p.display_unit || p.product_unit || '', formatPKR(p.rate), formatPKR(p.total), formatPKR(p.commission), formatPKR(p.net_amount), p.payment_status || 'To Pay', formatPKR(p.amount_paid || 0)]);
    const summary = [{ label: 'Total Purchases / کل خریداری', value: formatPKR(purchases.reduce((s, r) => s + (r.net_amount || 0), 0)) }, { label: 'Total Commission / کل آڑت', value: formatPKR(purchases.reduce((s, r) => s + (r.commission || 0), 0)) }, { label: 'Total Paid to Suppliers', value: formatPKR(purchases.reduce((s, r) => s + (r.amount_paid || 0), 0)) }, { label: 'Entries', value: String(purchases.length) }];
    const exportData = { title: 'Purchases Report — خریداری رپورٹ', columns, rows, summary, dateRange: '' };
    if (format === 'pdf') exportToPDF({ ...exportData, fileName: `Purchases_Report_${todayISO()}.pdf` });
    else if (format === 'xlsx') exportToXLSX({ ...exportData, fileName: `Purchases_Report_${todayISO()}.xlsx` });
    else if (format === 'csv') exportToCSV({ ...exportData, fileName: `Purchases_Report_${todayISO()}.csv` });
  };

  const statusBadge = (status) => {
    if (status === 'Paid') return 'badge-active';
    if (status === 'Partial') return 'badge-walkin';
    return 'badge-inactive';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Purchases — <span className="urdu">خریداری</span></h2>
        <div className="flex gap-2">
          <ExportDropdown onExport={handleExport} disabled={purchases.length === 0} />
          <button className="btn btn-primary" onClick={openForm}><MdAdd /> New Purchase</button>
        </div>
      </div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th>Comm.</th><th>Net</th><th>Payment</th><th>Paid</th><th></th></tr></thead>
          <tbody>
            {purchases.map((p, i) => (<tr key={p.id}><td>{i + 1}</td><td>{formatDate(p.date)}</td><td>{p.supplier_name || '—'}{p.supplier_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.supplier_name_urdu}</span></> : ''}</td><td>{p.product_name}{p.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.product_name_urdu}</span></> : ''}</td><td>{p.quantity} {p.display_unit || p.product_unit}</td><td>{formatPKR(p.rate)}</td><td className="amount">{formatPKR(p.total)}</td><td className="amount">{formatPKR(p.commission)}</td><td className="amount" style={{ fontWeight: 700 }}>{formatPKR(p.net_amount)}</td><td><span className={`badge ${statusBadge(p.payment_status || 'To Pay')}`}>{p.payment_status || 'To Pay'}</span></td><td className="amount">{formatPKR(p.amount_paid || 0)}</td><td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}><MdDelete /></button></td></tr>))}
            {purchases.length === 0 && <tr><td colSpan={12} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No purchases yet</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal show={showForm} onClose={() => setShowForm(false)} title={<>New Purchase — <span className="urdu">نئی خریداری</span></>} large>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 20 }}><label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block' }}>Supplier Type — سپلائر کی قسم</label><div className="tabs" style={{ marginBottom: 0 }}><button type="button" className={`tab ${partyType === 'Regular' ? 'active' : ''}`} onClick={() => switchPartyType('Regular')}><MdPerson style={{ verticalAlign: 'middle', marginRight: 4 }} /> Regular — باقاعدہ</button><button type="button" className={`tab ${partyType === 'Walk-in' ? 'active' : ''}`} onClick={() => switchPartyType('Walk-in')}><MdPersonOutline style={{ verticalAlign: 'middle', marginRight: 4 }} /> Walk-in — فوری</button></div></div>
          <div className="form-grid">
            <div className="form-group"><label>Date & Time — تاریخ و وقت</label><input type="datetime-local" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            {partyType === 'Regular' ? (<div className="form-group"><label>Supplier — سپلائر</label><select required value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}><option value="">Select Supplier</option>{suppliers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>) : (<div className="form-group"><label>Walk-in Name — فوری سپلائر</label><input value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Walk-in Supplier" style={{ borderColor: 'var(--accent2)', background: 'var(--accent2-glow)' }} /></div>)}
            {/* Product dropdown — name only, no unit in brackets */}
            <div className="form-group"><label>Product — جنس</label><select required value={form.product_id} onChange={e => handleProductChange(e.target.value)}><option value="">Select Product</option>{products.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name} — {p.name_urdu}</option>)}</select></div>

            {/* Unit selector — allows override at purchase time */}
            <div className="form-group">
              <label>Unit — اکائی</label>
              <select value={showUnitInput ? '__custom__' : form.unit} onChange={e => {
                if (e.target.value === '__custom__') { setShowUnitInput(true); }
                else { setShowUnitInput(false); setNewUnit(''); setForm({ ...form, unit: e.target.value }); }
              }}>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                <option value="__custom__">➕ Add New Unit...</option>
              </select>
              {showUnitInput && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="New unit name..." autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddUnit(); } if (e.key === 'Escape') { setShowUnitInput(false); setNewUnit(''); } }}
                    style={{ flex: 1 }} />
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleAddUnit} style={{ minWidth: 34, height: 40 }}><MdAdd /></button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setShowUnitInput(false); setNewUnit(''); }} style={{ minWidth: 34, height: 40 }}><MdClose /></button>
                </div>
              )}
            </div>

            <div className="form-group"><label>Quantity — مقدار</label><input type="number" step="0.01" required value={form.quantity} onChange={e => { const q = e.target.value; const comm = commissionMode === 'default' ? recalcCommission(q, form.rate) : calcCommission(q, form.rate, customPercent); setForm({ ...form, quantity: q, commission: comm }); }} /></div>
            <div className="form-group"><label>Rate (PKR) — نرخ</label><input type="number" step="0.01" required value={form.rate} onChange={e => { const r = e.target.value; const comm = commissionMode === 'default' ? recalcCommission(form.quantity, r) : calcCommission(form.quantity, r, customPercent); setForm({ ...form, rate: r, commission: comm }); }} /></div>

            {/* Commission with default/custom toggle */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Commission — آڑت</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => { setCommissionMode('default'); setCustomPercent(''); setForm({ ...form, commission: recalcCommission(form.quantity, form.rate) }); }}
                    style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: commissionMode === 'default' ? 'var(--accent)' : 'transparent', color: commissionMode === 'default' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Default</button>
                  <button type="button" onClick={() => { setCommissionMode('custom'); const dp = getDefaultPercent(form.product_id); setCustomPercent(dp); setForm({ ...form, commission: calcCommission(form.quantity, form.rate, dp) }); }}
                    style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: commissionMode === 'custom' ? 'var(--accent2)' : 'transparent', color: commissionMode === 'custom' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Custom</button>
                </span>
              </label>
              {commissionMode === 'custom' ? (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: '0 0 100px', position: 'relative' }}>
                      <input type="number" step="0.01" min="0" value={customPercent}
                        onChange={e => { const pct = e.target.value; setCustomPercent(pct); setForm({ ...form, commission: calcCommission(form.quantity, form.rate, pct) }); }}
                        style={{ borderColor: 'var(--accent2)', paddingRight: 28 }} placeholder="%" />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none' }}>%</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>→</span>
                    <input type="number" step="0.01" value={form.commission} readOnly style={{ flex: 1, opacity: 0.8, cursor: 'not-allowed', fontWeight: 700, color: 'var(--accent2)' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent2)', marginTop: 2 }}>Enter your commission % — amount auto-calculated</span>
                </>
              ) : (
                <>
                  <input type="number" step="0.01" value={form.commission} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Auto-calculated @ {getDefaultPercent(form.product_id)}% (product default)</span>
                </>
              )}
            </div>

            <div className="form-group"><label>Bardana — بوری</label><input type="number" step="0.01" value={form.bardana} onChange={e => setForm({ ...form, bardana: e.target.value })} /></div>
            <div className="form-group"><label>Labour — مزدوری</label><input type="number" step="0.01" value={form.labour} onChange={e => setForm({ ...form, labour: e.target.value })} /></div>

            {/* Payment to Dealer section */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent2)', marginBottom: 8 }}>
                💰 Payment to Supplier — سپلائر کو ادائیگی
              </label>
              <div className="tabs" style={{ marginBottom: 10 }}>
                <button type="button" className={`tab ${form.payment_status === 'To Pay' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, payment_status: 'To Pay', amount_paid: 0, payment_mode: 'On Account' })}
                  style={{ fontSize: '0.8rem' }}>To Pay — بعد میں ادائیگی</button>
                <button type="button" className={`tab ${(form.payment_status === 'Partial' || form.payment_status === 'Paid') ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, payment_status: 'Partial', amount_paid: form.amount_paid || '' })}
                  style={{ fontSize: '0.8rem' }}>Pay Now — ابھی ادائیگی</button>
              </div>
              {(form.payment_status === 'Partial' || form.payment_status === 'Paid') && (
                <>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <input type="number" step="0.01" value={form.amount_paid}
                      onChange={e => {
                        const val = e.target.value;
                        const paid = parseFloat(val) || 0;
                        setForm({ ...form, amount_paid: val, payment_status: paid >= net ? 'Paid' : 'Partial' });
                      }}
                      placeholder="Amount to pay supplier..."
                      style={{ flex: 1 }} />
                    <button type="button" className="btn btn-sm btn-secondary"
                      onClick={() => setForm({ ...form, amount_paid: net, payment_status: 'Paid' })}
                      style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>Full Amount</button>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.78rem' }}>Payment Method — ادائیگی کا طریقہ</label>
                    <select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                      <option value="Cash">Cash — نقد</option>
                      <option value="Bank Transfer">Bank Transfer — بینک ٹرانسفر</option>
                      <option value="Cheque">Cheque — چیک</option>
                      <option value="Online">Online / JazzCash / EasyPaisa</option>
                    </select>
                  </div>
                </>
              )}
              {form.payment_status === 'To Pay' && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  ادھار — No payment now, amount added to supplier's outstanding balance
                </div>
              )}
            </div>

            <div className="form-group"><label>Notes — نوٹ</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="totals-bar"><span>Total: <strong>{formatPKR(total)}</strong></span><span>Net Amount: <strong className="amount" style={{ fontSize: '1.1rem', color: 'var(--accent2)' }}>{formatPKR(net)}</strong></span></div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Purchase</button></div>
        </form>
      </Modal>
    </div>
  );
}
