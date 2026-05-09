import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdAdd, MdDelete, MdPayment, MdShoppingCart, MdPerson, MdPhone, MdBadge, MdLocationOn } from 'react-icons/md';
import { formatPKR, formatDate, todayISO, formatNumber } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';

export default function SupplierKhata() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);

  // Payment form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payForm, setPayForm] = useState({ date: todayISO(), amount: '', type: 'Paid', mode: 'Cash', reference: '', notes: '' });

  // Purchase form
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [commissionMode, setCommissionMode] = useState('default');
  const [customPercent, setCustomPercent] = useState('');
  const [purchForm, setPurchForm] = useState({
    product_id: '', date: todayISO(), quantity: '', rate: '', commission: 0,
    bardana: 0, labour: 0, payment_mode: 'On Account', notes: '', unit: ''
  });

  useEffect(() => { loadAll(); }, [id]);

  const loadAll = async () => {
    setLoading(true);
    const s = await window.api.getSupplier(parseInt(id));
    setSupplier(s);
    const l = await window.api.getSupplierLedger(parseInt(id));
    setLedger(l);
    setProducts(await window.api.getProducts());
    setUnits(await window.api.getUnits());
    setLoading(false);
  };

  const openingBalance = supplier?.opening_balance || 0;
  const entries = ledger?.entries || [];

  // ─── Payment handlers ───
  const openPaymentForm = () => {
    setPayForm({ date: todayISO(), amount: '', type: 'Paid', mode: 'Cash', reference: '', notes: '' });
    setShowPaymentForm(true);
  };

  const handlePaymentSave = async (e) => {
    e.preventDefault();
    await window.api.addPayment({
      party_type: 'Supplier', party_id: parseInt(id), date: payForm.date,
      amount: parseFloat(payForm.amount), type: payForm.type,
      mode: payForm.mode, reference: payForm.reference, notes: payForm.notes
    });
    setShowPaymentForm(false);
    loadAll();
  };

  // ─── Purchase handlers ───
  const purchTotal = (parseFloat(purchForm.quantity) || 0) * (parseFloat(purchForm.rate) || 0);
  const purchNet = purchTotal + (parseFloat(purchForm.commission) || 0) + (parseFloat(purchForm.bardana) || 0) + (parseFloat(purchForm.labour) || 0);

  const getDefaultPercent = (pid) => { const p = products.find(x => x.id === parseInt(pid || purchForm.product_id)); return p ? p.commission_rate : 0; };
  const calcCommission = (qty, rate, percent) => ((parseFloat(qty) || 0) * (parseFloat(rate) || 0) * (parseFloat(percent) || 0) / 100).toFixed(2);
  const recalcCommission = (qty, rate, pid) => calcCommission(qty, rate, getDefaultPercent(pid));

  const openPurchaseForm = () => {
    setCommissionMode('default'); setCustomPercent('');
    setPurchForm({ product_id: '', date: todayISO(), quantity: '', rate: '', commission: 0, bardana: 0, labour: 0, payment_mode: 'On Account', notes: '', unit: '' });
    setShowPurchaseForm(true);
  };

  const handleProductChange = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    let newCommission = commissionMode === 'default' ? recalcCommission(purchForm.quantity, purchForm.rate, pid) : calcCommission(purchForm.quantity, purchForm.rate, customPercent);
    setPurchForm({ ...purchForm, product_id: pid, unit: p ? p.unit : '', commission: newCommission });
  };

  const handlePurchaseSave = async (e) => {
    e.preventDefault();
    const qty = parseFloat(purchForm.quantity) || 0;
    if (!purchForm.product_id) return alert('Please select a product');
    if (qty <= 0) return alert('Quantity must be greater than 0');

    await window.api.addPurchase({
      supplier_id: parseInt(id), product_id: parseInt(purchForm.product_id), date: purchForm.date,
      quantity: qty, rate: parseFloat(purchForm.rate), total: purchTotal,
      commission: parseFloat(purchForm.commission) || 0, bardana: parseFloat(purchForm.bardana) || 0,
      labour: parseFloat(purchForm.labour) || 0, net_amount: purchNet,
      payment_mode: purchForm.payment_mode, notes: purchForm.notes,
      amount_paid: 0, payment_status: 'To Pay',
      unit: purchForm.unit || null, commission_type: commissionMode
    });
    setShowPurchaseForm(false);
    loadAll();
  };

  const handleDeletePayment = async (paymentId) => {
    if (confirm('Delete this payment entry?')) { await window.api.deletePayment(paymentId); loadAll(); }
  };
  const handleDeletePurchase = async (purchaseId) => {
    if (confirm('Delete this purchase entry?')) { await window.api.deletePurchase(purchaseId); loadAll(); }
  };

  // ─── Export ───
  const getExportColumns = () => ['#', 'Date', 'Type', 'Product', 'Qty', 'Rate', 'Debit', 'Credit', 'Balance'];

  const handleExport = (format, hiddenColumns = []) => {
    if (!entries.length) return;
    let bal = openingBalance;
    const columns = getExportColumns();
    const mask = (colName, value) => hiddenColumns.includes(colName) ? '—' : value;
    const rows = [['', '', 'Opening Balance — ابتدائی بیلنس', '', '', '', '', '', formatPKR(openingBalance)]];
    entries.forEach((e, i) => {
      bal += (e.debit || 0) - (e.credit || 0);
      const productWithUnit = e.product_name ? `${e.product_name}${e.display_unit ? ` (${e.display_unit})` : ''}` : '—';
      rows.push([
        mask('#', i + 1), mask('Date', formatDate(e.date)), mask('Type', e.type),
        mask('Product', productWithUnit), mask('Qty', e.quantity || '—'),
        mask('Rate', e.rate ? formatPKR(e.rate) : '—'),
        mask('Debit', e.debit ? formatPKR(e.debit) : '—'),
        mask('Credit', e.credit ? formatPKR(e.credit) : '—'),
        mask('Balance', formatPKR(bal))
      ]);
    });
    const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
    const summary = [{ label: 'Supplier', value: supplier?.name || '' }, { label: 'Total Debit', value: formatPKR(totalDebit) }, { label: 'Total Credit', value: formatPKR(totalCredit) }, { label: 'Final Balance', value: formatPKR(bal) }];
    const exportData = { title: `Supplier Khata — ${supplier?.name} — کھاتا`, columns, rows, summary, dateRange: '' };
    const safeName = (supplier?.name || 'Supplier').replace(/\s+/g, '_');
    if (format === 'pdf') exportToPDF({ ...exportData, fileName: `Khata_${safeName}_${todayISO()}.pdf` });
    else if (format === 'xlsx') exportToXLSX({ ...exportData, fileName: `Khata_${safeName}_${todayISO()}.xlsx` });
    else if (format === 'csv') exportToCSV({ ...exportData, fileName: `Khata_${safeName}_${todayISO()}.csv` });
  };

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  if (!supplier) return <div className="empty-state"><p>Supplier not found</p></div>;

  let finalBalance = openingBalance;
  entries.forEach(e => { finalBalance += (e.debit || 0) - (e.credit || 0); });
  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/suppliers')} title="Back"><MdArrowBack /></button>
          <div>
            <h2 style={{ marginBottom: 2 }}>{supplier.name} {supplier.name_urdu ? <span className="urdu" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>({supplier.name_urdu})</span> : ''}</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Supplier Khata / Ledger — سپلائر کھاتا</span>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportDropdown onExport={handleExport} disabled={entries.length === 0} columns={getExportColumns()} />
          <button className="btn btn-primary" onClick={openPaymentForm}><MdPayment style={{ marginRight: 4 }} /> Add Payment</button>
          <button className="btn btn-primary" style={{ background: 'var(--accent2)' }} onClick={openPurchaseForm}><MdShoppingCart style={{ marginRight: 4 }} /> New Purchase</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MdPerson style={{ color: 'var(--accent2)', fontSize: '1.2rem' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Contact</span>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
            {supplier.phone && <div><MdPhone style={{ verticalAlign: 'middle', marginRight: 4, fontSize: '0.9rem', color: 'var(--text-muted)' }} />{supplier.phone}</div>}
            {supplier.cnic && <div><MdBadge style={{ verticalAlign: 'middle', marginRight: 4, fontSize: '0.9rem', color: 'var(--text-muted)' }} />{supplier.cnic}</div>}
            {supplier.address && <div><MdLocationOn style={{ verticalAlign: 'middle', marginRight: 4, fontSize: '0.9rem', color: 'var(--text-muted)' }} />{supplier.address}</div>}
            {!supplier.phone && !supplier.cnic && !supplier.address && <span style={{ color: 'var(--text-muted)' }}>No contact info</span>}
          </div>
        </div>
        <div className="stat-card"><div className="stat-icon amber"><MdShoppingCart /></div><div className="stat-info"><h3>Opening Balance</h3><div className="stat-value">{formatPKR(openingBalance)}</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><MdShoppingCart /></div><div className="stat-info"><h3>Total Purchases (Debit)</h3><div className="stat-value">{formatPKR(totalDebit)}</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><MdPayment /></div><div className="stat-info"><h3>Total Paid (Credit)</h3><div className="stat-value">{formatPKR(totalCredit)}</div></div></div>
        <div className="stat-card"><div className={`stat-icon ${finalBalance > 0 ? 'red' : 'green'}`}><MdPayment /></div><div className="stat-info"><h3>Current Balance</h3><div className="stat-value" style={{ color: finalBalance > 0 ? 'var(--red)' : 'var(--green)' }}>{formatPKR(finalBalance)}</div></div></div>
      </div>

      {/* Ledger Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Khata / Ledger — <span className="urdu">کھاتا</span></h3>
        </div>
        <div className="data-table-wrapper" style={{ border: 'none' }}>
          <table className="data-table">
            <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Rate</th><th>Debit</th><th>Credit</th><th>Balance</th><th></th></tr></thead>
            <tbody>
              <tr style={{ background: 'var(--glass)' }}><td></td><td colSpan={5}><strong>Opening Balance — ابتدائی بیلنس</strong></td><td></td><td></td><td className="amount" style={{ fontWeight: 700 }}>{formatPKR(openingBalance)}</td><td></td></tr>
              {(() => { let bal = openingBalance; return entries.map((e, i) => {
                bal += (e.debit || 0) - (e.credit || 0);
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{formatDate(e.date)}</td>
                    <td><span className={`badge ${e.type === 'Purchase' ? 'badge-regular' : 'badge-active'}`}>{e.type}</span></td>
                    <td>{e.product_name || '—'}{e.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}</td>
                    <td>{e.quantity || '—'}</td>
                    <td>{e.rate ? formatPKR(e.rate) : '—'}</td>
                    <td className="amount positive">{e.debit ? formatPKR(e.debit) : '—'}</td>
                    <td className="amount negative">{e.credit ? formatPKR(e.credit) : '—'}</td>
                    <td className="amount" style={{ fontWeight: 700 }}>{formatPKR(bal)}</td>
                    <td>
                      {e.type === 'Payment' && e.payment_id ? <button className="btn btn-sm btn-danger" onClick={() => handleDeletePayment(e.payment_id)} title="Delete"><MdDelete /></button> : ''}
                      {e.type === 'Purchase' && e.purchase_id ? <button className="btn btn-sm btn-danger" onClick={() => handleDeletePurchase(e.purchase_id)} title="Delete"><MdDelete /></button> : ''}
                    </td>
                  </tr>
                );
              }); })()}
              {entries.length === 0 && <tr><td colSpan={10} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No entries yet — ابھی تک کوئی اندراج نہیں</td></tr>}
              {entries.length > 0 && (
                <tr style={{ background: 'var(--glass)', fontWeight: 700 }}>
                  <td></td><td colSpan={5}><strong>Closing Balance — حتمی بیلنس</strong></td>
                  <td className="amount positive">{formatPKR(totalDebit)}</td>
                  <td className="amount negative">{formatPKR(totalCredit)}</td>
                  <td className="amount" style={{ fontWeight: 800, fontSize: '1rem', color: finalBalance > 0 ? 'var(--red)' : 'var(--green)' }}>{formatPKR(finalBalance)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal show={showPaymentForm} onClose={() => setShowPaymentForm(false)} title={<>Add Payment — <span className="urdu">ادائیگی</span></>}>
        <form onSubmit={handlePaymentSave}>
          <div className="form-grid">
            <div className="form-group"><label>Date & Time</label><input type="datetime-local" required value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} /></div>
            <div className="form-group"><label>Amount (PKR)</label><input type="number" step="0.01" required value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} /></div>
            <div className="form-group"><label>Type</label><select value={payForm.type} onChange={e => setPayForm({ ...payForm, type: e.target.value })}><option>Paid</option><option>Received</option></select></div>
            <div className="form-group"><label>Mode</label><select value={payForm.mode} onChange={e => setPayForm({ ...payForm, mode: e.target.value })}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option></select></div>
            <div className="form-group"><label>Reference / Cheque #</label><input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} /></div>
            <div className="form-group"><label>Notes</label><input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowPaymentForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Payment</button></div>
        </form>
      </Modal>

      {/* Purchase Modal */}
      <Modal show={showPurchaseForm} onClose={() => setShowPurchaseForm(false)} title={<>New Purchase from {supplier.name} — <span className="urdu">نئی خریداری</span></>} large>
        <form onSubmit={handlePurchaseSave}>
          <div className="form-grid">
            <div className="form-group"><label>Date & Time</label><input type="datetime-local" required value={purchForm.date} onChange={e => setPurchForm({ ...purchForm, date: e.target.value })} /></div>
            <div className="form-group">
              <label>Product — جنس</label>
              <select required value={purchForm.product_id} onChange={e => handleProductChange(e.target.value)}>
                <option value="">Select Product</option>
                {products.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name} — {p.name_urdu}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Unit — اکائی</label><select value={purchForm.unit} onChange={e => setPurchForm({ ...purchForm, unit: e.target.value })}>{!purchForm.unit && <option value="">Select Unit</option>}{units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
            <div className="form-group"><label>Quantity — مقدار</label><input type="number" step="0.01" required value={purchForm.quantity} onChange={e => { const q = e.target.value; const comm = commissionMode === 'default' ? recalcCommission(q, purchForm.rate) : calcCommission(q, purchForm.rate, customPercent); setPurchForm({ ...purchForm, quantity: q, commission: comm }); }} /></div>
            <div className="form-group"><label>Rate (PKR) — نرخ</label><input type="number" step="0.01" required value={purchForm.rate} onChange={e => { const r = e.target.value; const comm = commissionMode === 'default' ? recalcCommission(purchForm.quantity, r) : calcCommission(purchForm.quantity, r, customPercent); setPurchForm({ ...purchForm, rate: r, commission: comm }); }} /></div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Commission — آڑت</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => { setCommissionMode('default'); setCustomPercent(''); setPurchForm({ ...purchForm, commission: recalcCommission(purchForm.quantity, purchForm.rate) }); }}
                    style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: commissionMode === 'default' ? 'var(--accent)' : 'transparent', color: commissionMode === 'default' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Default</button>
                  <button type="button" onClick={() => { setCommissionMode('custom'); const dp = getDefaultPercent(purchForm.product_id); setCustomPercent(dp); setPurchForm({ ...purchForm, commission: calcCommission(purchForm.quantity, purchForm.rate, dp) }); }}
                    style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: commissionMode === 'custom' ? 'var(--accent2)' : 'transparent', color: commissionMode === 'custom' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Custom</button>
                </span>
              </label>
              {commissionMode === 'custom' ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: '0 0 100px', position: 'relative' }}>
                    <input type="number" step="0.01" min="0" value={customPercent} onChange={e => { const pct = e.target.value; setCustomPercent(pct); setPurchForm({ ...purchForm, commission: calcCommission(purchForm.quantity, purchForm.rate, pct) }); }} style={{ borderColor: 'var(--accent2)', paddingRight: 28 }} placeholder="%" />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none' }}>%</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>→</span>
                  <input type="number" step="0.01" value={purchForm.commission} readOnly style={{ flex: 1, opacity: 0.8, cursor: 'not-allowed', fontWeight: 700, color: 'var(--accent2)' }} />
                </div>
              ) : (
                <>
                  <input type="number" step="0.01" value={purchForm.commission} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Auto @ {getDefaultPercent(purchForm.product_id)}%</span>
                </>
              )}
            </div>
            <div className="form-group"><label>Bardana — بوری</label><input type="number" step="0.01" value={purchForm.bardana} onChange={e => setPurchForm({ ...purchForm, bardana: e.target.value })} /></div>
            <div className="form-group"><label>Labour — مزدوری</label><input type="number" step="0.01" value={purchForm.labour} onChange={e => setPurchForm({ ...purchForm, labour: e.target.value })} /></div>
            <div className="form-group"><label>Notes — نوٹ</label><input value={purchForm.notes} onChange={e => setPurchForm({ ...purchForm, notes: e.target.value })} /></div>
          </div>
          <div className="totals-bar"><span>Total: <strong>{formatPKR(purchTotal)}</strong></span><span>Net: <strong className="amount" style={{ fontSize: '1.1rem', color: 'var(--accent2)' }}>{formatPKR(purchNet)}</strong></span></div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowPurchaseForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Purchase</button></div>
        </form>
      </Modal>
    </div>
  );
}
