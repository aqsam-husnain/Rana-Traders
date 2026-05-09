import React, { useState, useEffect } from 'react';
import { MdAdd, MdDelete, MdPerson, MdPersonOutline, MdWarning, MdClose } from 'react-icons/md';
import { formatPKR, formatDate, todayISO, formatNumber } from '../utils/formatters';
import { confirmAction } from '../utils/confirmDialog';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [availableStock, setAvailableStock] = useState(null);
  const [stockError, setStockError] = useState('');
  const [commissionMode, setCommissionMode] = useState('default');
  const [customPercent, setCustomPercent] = useState('');
  const [showUnitInput, setShowUnitInput] = useState(false);
  const [newUnit, setNewUnit] = useState('');

  const [partyType, setPartyType] = useState('Regular');
  const [walkInName, setWalkInName] = useState('');
  const [form, setForm] = useState({
    buyer_id: '', product_id: '', date: todayISO(),
    quantity: '', rate: '', commission: 0, bardana: 0, labour: 0,
    payment_mode: 'On Account', notes: '', unit: '',
    amount_paid: 0, payment_status: 'To Receive'
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setSales(await window.api.getSales());
    const allBuyers = await window.api.getBuyers();
    setBuyers(allBuyers.filter(c => c.type === 'Regular' && c.status === 'Active'));
    setProducts(await window.api.getProducts());
    setUnits(await window.api.getUnits());
  };

  const total = (parseFloat(form.quantity) || 0) * (parseFloat(form.rate) || 0);
  const net = total - (parseFloat(form.commission) || 0) - (parseFloat(form.bardana) || 0) - (parseFloat(form.labour) || 0);

  const getDefaultPercent = (pid) => { const p = products.find(x => x.id === parseInt(pid || form.product_id)); return p ? p.commission_rate : 0; };
  const calcCommission = (qty, rate, percent) => ((parseFloat(qty) || 0) * (parseFloat(rate) || 0) * (parseFloat(percent) || 0) / 100).toFixed(2);
  const recalcCommission = (qty, rate, pid) => calcCommission(qty, rate, getDefaultPercent(pid));

  const checkStock = async (productId) => {
    if (!productId) { setAvailableStock(null); setStockError(''); return; }
    const stock = await window.api.getProductStock(parseInt(productId));
    setAvailableStock(stock);
    if (stock <= 0) setStockError(`Out of stock! Available: 0`);
    else setStockError('');
  };

  const validateQuantity = (qty) => {
    const q = parseFloat(qty) || 0;
    if (availableStock !== null && q > availableStock) setStockError(`Not enough stock! Available: ${formatNumber(availableStock)}`);
    else if (availableStock !== null && availableStock <= 0) setStockError(`Out of stock! Available: 0`);
    else setStockError('');
  };

  const switchPartyType = (type) => {
    setPartyType(type);
    if (type === 'Walk-in') { setWalkInName(`Walk-in Buyer #${Math.floor(1000 + Math.random() * 9000)}`); setForm({ ...form, buyer_id: '' }); }
    else setWalkInName('');
  };

  const handleProductChange = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    let newCommission;
    if (commissionMode === 'default') {
      newCommission = recalcCommission(form.quantity, form.rate, pid);
    } else {
      newCommission = calcCommission(form.quantity, form.rate, customPercent);
    }
    setForm({ ...form, product_id: pid, unit: p ? p.unit : '', commission: newCommission });
    checkStock(pid);
    setShowUnitInput(false);
    setNewUnit('');
  };

  const openForm = () => {
    setPartyType('Regular'); setWalkInName(''); setCommissionMode('default'); setCustomPercent('');
    setShowUnitInput(false); setNewUnit('');
    setForm({ buyer_id: '', product_id: '', date: todayISO(), quantity: '', rate: '', commission: 0, bardana: 0, labour: 0, payment_mode: 'On Account', notes: '', unit: '', amount_paid: 0, payment_status: 'To Receive' });
    setAvailableStock(null); setStockError('');
    setShowForm(true);
  };

  const updatePaymentStatus = (amtPaid) => {
    const paid = parseFloat(amtPaid) || 0;
    if (paid <= 0) return 'To Receive';
    if (paid >= net) return 'Received';
    return 'Partial';
  };

  const handleAddUnit = async () => {
    const trimmed = newUnit.trim();
    if (!trimmed) return;
    await window.api.addUnit(trimmed);
    const updatedUnits = await window.api.getUnits();
    setUnits(updatedUnits);
    setNewUnit('');
    setShowUnitInput(false);
    setForm(prev => ({ ...prev, unit: trimmed }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const qty = parseFloat(form.quantity) || 0;
    if (!form.product_id) return alert('Please select a product');
    if (qty <= 0) return alert('Quantity must be greater than 0');
    const currentStock = await window.api.getProductStock(parseInt(form.product_id));
    if (currentStock <= 0) return alert('Cannot save sale — this product is out of stock!\n\nاس جنس کا اسٹاک ختم ہو گیا ہے');
    if (qty > currentStock) return alert(`Cannot save sale — not enough stock!\nAvailable: ${formatNumber(currentStock)}\nRequested: ${formatNumber(qty)}\n\nاتنا اسٹاک دستیاب نہیں ہے`);

    let buyerId;
    if (partyType === 'Walk-in') {
      const result = await window.api.addBuyer({ name: walkInName || 'Walk-in Buyer', name_urdu: '', type: 'Walk-in', phone: '', address: '', cnic: '', opening_balance: 0, status: 'Active' });
      buyerId = result.lastInsertRowid;
    } else {
      buyerId = parseInt(form.buyer_id);
      if (!buyerId) return alert('Please select a buyer');
    }

    const amountPaid = parseFloat(form.amount_paid) || 0;
    const paymentStatus = updatePaymentStatus(amountPaid);

    await window.api.addSale({
      buyer_id: buyerId, product_id: parseInt(form.product_id), date: form.date,
      quantity: qty, rate: parseFloat(form.rate), total,
      commission: parseFloat(form.commission) || 0, bardana: parseFloat(form.bardana) || 0,
      labour: parseFloat(form.labour) || 0, net_amount: net,
      payment_mode: form.payment_mode, notes: form.notes,
      amount_paid: amountPaid, payment_status: paymentStatus,
      unit: form.unit || null, commission_type: commissionMode
    });
    setShowForm(false); load();
  };

  const handleDelete = async (id) => { if (confirmAction('Delete this sale entry?')) { await window.api.deleteSale(id); load(); } };

  const handleExport = (format) => {
    if (sales.length === 0) return;
    const columns = ['#', 'Date', 'Buyer / خریدار', 'Product / جنس', 'Qty', 'Unit', 'Rate', 'Total', 'Commission', 'Net Amount', 'Payment', 'Received'];
    const rows = sales.map((s, i) => [i + 1, formatDate(s.date), (s.buyer_name || '—') + (s.buyer_name_urdu ? '\n' + s.buyer_name_urdu : ''), s.product_name + (s.product_name_urdu ? '\n' + s.product_name_urdu : ''), formatNumber(s.quantity), s.display_unit || s.product_unit || '', formatPKR(s.rate), formatPKR(s.total), formatPKR(s.commission), formatPKR(s.net_amount), s.payment_status || 'To Receive', formatPKR(s.amount_paid || 0)]);
    const summary = [
      { label: 'Total Sales / کل فروخت', value: formatPKR(sales.reduce((s, r) => s + (r.net_amount || 0), 0)) },
      { label: 'Total Commission / کل آڑت', value: formatPKR(sales.reduce((s, r) => s + (r.commission || 0), 0)) },
      { label: 'Total Received from Buyers', value: formatPKR(sales.reduce((s, r) => s + (r.amount_paid || 0), 0)) },
      { label: 'Entries', value: String(sales.length) },
    ];
    const exportData = { title: 'Sales Report — فروخت رپورٹ', columns, rows, summary, dateRange: '' };
    if (format === 'pdf') exportToPDF({ ...exportData, fileName: `Sales_Report_${todayISO()}.pdf` });
    else if (format === 'xlsx') exportToXLSX({ ...exportData, fileName: `Sales_Report_${todayISO()}.xlsx` });
    else if (format === 'csv') exportToCSV({ ...exportData, fileName: `Sales_Report_${todayISO()}.csv` });
  };

  const statusBadge = (status) => {
    if (status === 'Received') return 'badge-active';
    if (status === 'Partial') return 'badge-walkin';
    return 'badge-inactive';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Sales — <span className="urdu">فروخت</span></h2>
        <div className="flex gap-2">
          <ExportDropdown onExport={handleExport} disabled={sales.length === 0} />
          <button className="btn btn-primary" onClick={openForm}><MdAdd /> New Sale</button>
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Date</th><th>Buyer</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th>Comm.</th><th>Net</th><th>Payment</th><th>Received</th><th></th></tr></thead>
          <tbody>
            {sales.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td><td>{formatDate(s.date)}</td><td>{s.buyer_name || '—'}{s.buyer_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.buyer_name_urdu}</span></> : ''}</td><td>{s.product_name}{s.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.product_name_urdu}</span></> : ''}</td>
                <td>{s.quantity} {s.display_unit || s.product_unit}</td><td>{formatPKR(s.rate)}</td><td className="amount">{formatPKR(s.total)}</td>
                <td className="amount">{formatPKR(s.commission)}</td><td className="amount" style={{ fontWeight: 700 }}>{formatPKR(s.net_amount)}</td>
                <td><span className={`badge ${statusBadge(s.payment_status || 'To Receive')}`}>{s.payment_status || 'To Receive'}</span></td>
                <td className="amount">{formatPKR(s.amount_paid || 0)}</td>
                <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}><MdDelete /></button></td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={12} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No sales yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal show={showForm} onClose={() => setShowForm(false)} title={<>New Sale — <span className="urdu">نئی فروخت</span></>} large>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block' }}>Buyer Type — خریدار کی قسم</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={`tab ${partyType === 'Regular' ? 'active' : ''}`} onClick={() => switchPartyType('Regular')}><MdPerson style={{ verticalAlign: 'middle', marginRight: 4 }} /> Regular — باقاعدہ</button>
              <button type="button" className={`tab ${partyType === 'Walk-in' ? 'active' : ''}`} onClick={() => switchPartyType('Walk-in')}><MdPersonOutline style={{ verticalAlign: 'middle', marginRight: 4 }} /> Walk-in — فوری</button>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Date & Time — تاریخ و وقت</label><input type="datetime-local" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            {partyType === 'Regular' ? (
              <div className="form-group"><label>Buyer — خریدار</label><select required value={form.buyer_id} onChange={e => setForm({ ...form, buyer_id: e.target.value })}><option value="">Select Buyer</option>{buyers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            ) : (
              <div className="form-group"><label>Walk-in Name — فوری خریدار</label><input value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Walk-in Buyer" style={{ borderColor: 'var(--accent2)', background: 'var(--accent2-glow)' }} /></div>
            )}
            {/* Product dropdown — name only, no unit in brackets */}
            <div className="form-group">
              <label>Product — جنس</label>
              <select required value={form.product_id} onChange={e => handleProductChange(e.target.value)}>
                <option value="">Select Product</option>
                {products.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name} — {p.name_urdu}</option>)}
              </select>
              {availableStock !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.78rem', fontWeight: 600, color: availableStock > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {availableStock <= 0 && <MdWarning style={{ fontSize: '0.9rem' }} />}
                  Available: {formatNumber(availableStock)} {products.find(p => p.id === parseInt(form.product_id))?.unit || ''}
                </div>
              )}
            </div>

            {/* Unit selector */}
            <div className="form-group">
              <label>Unit — اکائی</label>
              <select value={showUnitInput ? '__custom__' : form.unit} onChange={e => {
                if (e.target.value === '__custom__') { setShowUnitInput(true); }
                else { setShowUnitInput(false); setNewUnit(''); setForm({ ...form, unit: e.target.value }); }
              }}>
                {!form.unit && <option value="">Select Unit</option>}
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

            <div className="form-group">
              <label>Quantity — مقدار</label>
              <input type="number" step="0.01" required value={form.quantity}
                onChange={e => { const q = e.target.value; validateQuantity(q); const comm = commissionMode === 'default' ? recalcCommission(q, form.rate) : calcCommission(q, form.rate, customPercent); setForm({ ...form, quantity: q, commission: comm }); }}
                style={stockError ? { borderColor: 'var(--red)', boxShadow: '0 0 0 3px var(--red-glow)' } : {}}
              />
              {stockError && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600 }}><MdWarning style={{ fontSize: '0.85rem' }} /> {stockError}</div>}
            </div>
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

            {/* Payment from Buyer section */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
                💰 Payment from Buyer — خریدار سے وصولی
              </label>
              <div className="tabs" style={{ marginBottom: 10 }}>
                <button type="button" className={`tab ${form.payment_status === 'To Receive' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, payment_status: 'To Receive', amount_paid: 0, payment_mode: 'On Account' })}
                  style={{ fontSize: '0.8rem' }}>To Receive — بعد میں وصولی</button>
                <button type="button" className={`tab ${(form.payment_status === 'Partial' || form.payment_status === 'Received') ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, payment_status: 'Partial', amount_paid: form.amount_paid || '' })}
                  style={{ fontSize: '0.8rem' }}>Receive Now — ابھی وصولی</button>
              </div>
              {(form.payment_status === 'Partial' || form.payment_status === 'Received') && (
                <>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <input type="number" step="0.01" value={form.amount_paid}
                      onChange={e => {
                        const val = e.target.value;
                        const paid = parseFloat(val) || 0;
                        setForm({ ...form, amount_paid: val, payment_status: paid >= net ? 'Received' : 'Partial' });
                      }}
                      placeholder="Amount received from buyer..."
                      style={{ flex: 1 }} />
                    <button type="button" className="btn btn-sm btn-secondary"
                      onClick={() => setForm({ ...form, amount_paid: net, payment_status: 'Received' })}
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
              {form.payment_status === 'To Receive' && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  ادھار — No payment now, amount added to buyer's outstanding balance
                </div>
              )}
            </div>

            <div className="form-group"><label>Notes — نوٹ</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="totals-bar"><span>Total: <strong>{formatPKR(total)}</strong></span><span>Net Amount: <strong className="amount positive" style={{ fontSize: '1.1rem' }}>{formatPKR(net)}</strong></span></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!!stockError}>Save Sale</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
