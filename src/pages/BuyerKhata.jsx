import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdAdd, MdDelete, MdEdit, MdPayment, MdPointOfSale, MdPerson, MdPhone, MdBadge, MdLocationOn, MdClose, MdWarning } from 'react-icons/md';
import { formatPKR, formatDate, todayISO, formatNumber } from '../utils/formatters';
import { confirmAction } from '../utils/confirmDialog';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';

export default function BuyerKhata() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [buyer, setBuyer] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Payment form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payForm, setPayForm] = useState({ date: todayISO(), amount: '', type: 'Received', mode: 'Cash', reference: '', notes: '' });

  // Sale form
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [availableStock, setAvailableStock] = useState(null);
  const [stockWarning, setStockWarning] = useState('');
  const [commissionMode, setCommissionMode] = useState('default');
  const [customPercent, setCustomPercent] = useState('');
  const [showUnitInput, setShowUnitInput] = useState(false);
  const [newUnit, setNewUnit] = useState('');
  const [saleForm, setSaleForm] = useState({
    product_id: '', date: todayISO(), total_weight: '', kaat: 0, rate: '', commission: 0,
    bardana: 0, labour: 0, munshiyana: 0, kiraya: 0, others: 0,
    payment_mode: 'On Account', notes: '', unit: '',
    amount_paid: 0, payment_status: 'To Receive'
  });
  const [editingSaleId, setEditingSaleId] = useState(null);

  useEffect(() => { loadAll(); }, [id]);

  const loadAll = async () => {
    setLoading(true);
    const b = await window.api.getBuyer(parseInt(id));
    setBuyer(b);
    const l = await window.api.getBuyerLedger(parseInt(id));
    setLedger(l);
    setProducts(await window.api.getProducts());
    setUnits(await window.api.getUnits());
    setLoading(false);
  };

  // ─── Ledger balance calculation ───
  const openingBalance = buyer?.opening_balance || 0;
  let runningBalance = openingBalance;
  const entries = ledger?.entries || [];

  // ─── Payment handlers ───
  const openPaymentForm = () => {
    setPayForm({ date: todayISO(), amount: '', type: 'Received', mode: 'Cash', reference: '', notes: '' });
    setShowPaymentForm(true);
  };

  const handlePaymentSave = async (e) => {
    e.preventDefault();
    await window.api.addPayment({
      party_type: 'Buyer', party_id: parseInt(id), date: payForm.date,
      amount: parseFloat(payForm.amount), type: payForm.type,
      mode: payForm.mode, reference: payForm.reference, notes: payForm.notes
    });
    setShowPaymentForm(false);
    loadAll();
    toast.success('Payment saved successfully! — ادائیگی محفوظ ہو گئی');
  };

  // ─── Sale handlers ───
  const safiWeight = Math.max(0, (parseFloat(saleForm.total_weight) || 0) - (parseFloat(saleForm.kaat) || 0));
  const saleTotal = safiWeight * (parseFloat(saleForm.rate) || 0);
  const saleNet = saleTotal - (parseFloat(saleForm.commission) || 0) - (parseFloat(saleForm.bardana) || 0) - (parseFloat(saleForm.labour) || 0) - (parseFloat(saleForm.munshiyana) || 0) - (parseFloat(saleForm.kiraya) || 0) - (parseFloat(saleForm.others) || 0);

  const getDefaultPercent = (pid) => { const p = products.find(x => x.id === parseInt(pid || saleForm.product_id)); return p ? p.commission_rate : 0; };
  const calcCommission = (qty, rate, percent) => ((parseFloat(qty) || 0) * (parseFloat(rate) || 0) * (parseFloat(percent) || 0) / 100).toFixed(2);
  const recalcCommission = (qty, rate, pid) => calcCommission(qty, rate, getDefaultPercent(pid));

  const checkStock = async (productId) => {
    if (!productId) { setAvailableStock(null); setStockWarning(''); return; }
    const stock = await window.api.getProductStock(parseInt(productId));
    setAvailableStock(stock);
    setStockWarning(''); // reset on product change; weight validation will set it if needed
  };

  const validateSafiWeight = (tw, k) => {
    const safi = Math.max(0, (parseFloat(tw) || 0) - (parseFloat(k) || 0));
    if (availableStock !== null && safi > availableStock)
      setStockWarning(`Selling beyond stock — Available: ${formatNumber(availableStock)}, Entering: ${formatNumber(safi)}`);
    else
      setStockWarning('');
  };

  const openSaleForm = () => {
    setEditingSaleId(null);
    setCommissionMode('default'); setCustomPercent('');
    setShowUnitInput(false); setNewUnit('');
    setSaleForm({ product_id: '', date: todayISO(), total_weight: '', kaat: 0, rate: '', commission: 0, bardana: 0, labour: 0, munshiyana: 0, kiraya: 0, others: 0, payment_mode: 'On Account', notes: '', unit: '', amount_paid: 0, payment_status: 'To Receive' });
    setAvailableStock(null); setStockWarning('');
    setShowSaleForm(true);
  };

  const openEditSaleForm = async (e) => {
    setEditingSaleId(e.sale_id);
    setCommissionMode(e.commission_type || 'default'); setCustomPercent('');
    setShowUnitInput(false); setNewUnit('');
    setSaleForm({
      product_id: '', date: e.date, total_weight: e.total_weight || e.quantity, kaat: e.kaat || 0,
      rate: e.rate, commission: e.commission || 0,
      bardana: e.bardana || 0, labour: e.labour || 0,
      munshiyana: e.munshiyana || 0, kiraya: e.kiraya || 0, others: e.others || 0,
      payment_mode: e.payment_mode || 'On Account', notes: e.notes || '',
      unit: e.display_unit || '', amount_paid: e.amount_paid || 0,
      payment_status: e.payment_status || 'To Receive'
    });
    // Load the full sale record to get product_id
    const sale = await window.api.getSale(e.sale_id);
    if (sale) {
      setSaleForm(prev => ({ ...prev, product_id: String(sale.product_id), unit: sale.unit || prev.unit }));
      if (e.commission_type === 'custom' && sale.total > 0 && sale.commission > 0) {
        setCustomPercent(((sale.commission / sale.total) * 100).toFixed(2));
      }
      await checkStock(sale.product_id);
    }
    setShowSaleForm(true);
  };

  const updatePaymentStatus = (amtPaid) => {
    const paid = parseFloat(amtPaid) || 0;
    if (paid <= 0) return 'To Receive';
    if (paid >= saleNet) return 'Received';
    return 'Partial';
  };

  const handleProductChange = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    const safi = Math.max(0, (parseFloat(saleForm.total_weight) || 0) - (parseFloat(saleForm.kaat) || 0));
    let newCommission = commissionMode === 'default' ? recalcCommission(safi, saleForm.rate, pid) : calcCommission(safi, saleForm.rate, customPercent);
    setSaleForm({ ...saleForm, product_id: pid, unit: p ? p.unit : '', commission: newCommission });
    checkStock(pid);
    setShowUnitInput(false);
    setNewUnit('');
  };

  const handleAddUnit = async () => {
    const trimmed = newUnit.trim();
    if (!trimmed) return;
    await window.api.addUnit(trimmed);
    const updatedUnits = await window.api.getUnits();
    setUnits(updatedUnits);
    setNewUnit('');
    setShowUnitInput(false);
    setSaleForm(prev => ({ ...prev, unit: trimmed }));
  };

  const handleSaleSave = async (e) => {
    e.preventDefault();
    const qty = safiWeight;
    if (!saleForm.product_id) return toast.error('Please select a product — جنس منتخب کریں');
    if (qty <= 0) return toast.error('Safi Weight must be greater than 0');

    // No hard stock restriction — overselling is allowed and will result in negative stock (handled via Stock Overview)

    const amountPaid = parseFloat(saleForm.amount_paid) || 0;
    const paymentStatus = updatePaymentStatus(amountPaid);
    const payload = {
      buyer_id: parseInt(id), product_id: parseInt(saleForm.product_id), date: saleForm.date,
      quantity: qty, rate: parseFloat(saleForm.rate), total: saleTotal,
      commission: parseFloat(saleForm.commission) || 0, bardana: parseFloat(saleForm.bardana) || 0,
      labour: parseFloat(saleForm.labour) || 0, net_amount: saleNet,
      payment_mode: saleForm.payment_mode, notes: saleForm.notes,
      amount_paid: amountPaid, payment_status: paymentStatus,
      unit: saleForm.unit || null, commission_type: commissionMode,
      total_weight: parseFloat(saleForm.total_weight) || 0, kaat: parseFloat(saleForm.kaat) || 0,
      munshiyana: parseFloat(saleForm.munshiyana) || 0, kiraya: parseFloat(saleForm.kiraya) || 0,
      others: parseFloat(saleForm.others) || 0
    };

    if (editingSaleId) {
      await window.api.updateSale(editingSaleId, payload);
      toast.success('Sale updated successfully! — فروخت اپ ڈیٹ ہو گئی');
    } else {
      await window.api.addSale(payload);
      toast.success('Sale saved successfully! — فروخت محفوظ ہو گئی');
    }
    setShowSaleForm(false); setEditingSaleId(null);
    loadAll();
  };

  const handleDeletePayment = async (paymentId) => {
    if (confirmAction('Delete this payment entry?')) {
      await window.api.deletePayment(paymentId);
      loadAll();
      toast.success('Payment deleted — ادائیگی حذف ہو گئی');
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (confirmAction('Delete this sale entry?')) {
      await window.api.deleteSale(saleId);
      loadAll();
      toast.success('Sale deleted — فروخت حذف ہو گئی');
    }
  };

  // ─── Export ───
  const getExportColumns = () => ['#', 'Date', 'Type', 'Product', 'Qty', 'Rate', 'Debit', 'Credit', 'Balance'];

  const handleExport = async (format, hiddenColumns = []) => {
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
    const summary = [{ label: 'Buyer', value: buyer?.name || '' }, { label: 'Total Debit', value: formatPKR(totalDebit) }, { label: 'Total Credit', value: formatPKR(totalCredit) }, { label: 'Final Balance', value: formatPKR(bal) }];
    const exportData = { title: `Buyer Khata — ${buyer?.name} — کھاتا`, columns, rows, summary, dateRange: '' };
    const safeName = (buyer?.name || 'Buyer').replace(/\s+/g, '_');
    let saved = false; const ts = fileTimestamp();
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `Khata_${safeName}_${ts}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `Khata_${safeName}_${ts}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `Khata_${safeName}_${ts}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  if (!buyer) return <div className="empty-state"><p>Buyer not found</p></div>;

  // Calculate final balance for summary
  let finalBalance = openingBalance;
  entries.forEach(e => { finalBalance += (e.debit || 0) - (e.credit || 0); });
  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/buyers')} title="Back to Buyers"><MdArrowBack /></button>
          <div>
            <h2 style={{ marginBottom: 2 }}>{buyer.name} {buyer.name_urdu ? <span className="urdu" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>({buyer.name_urdu})</span> : ''}</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Buyer Khata / Ledger — خریدار کھاتا</span>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportDropdown onExport={handleExport} disabled={entries.length === 0} columns={getExportColumns()} />
          <button className="btn btn-primary" onClick={openPaymentForm}><MdPayment style={{ marginRight: 4 }} /> Add Payment</button>
          <button className="btn btn-primary" style={{ background: 'var(--green)' }} onClick={openSaleForm}><MdPointOfSale style={{ marginRight: 4 }} /> New Sale</button>
        </div>
      </div>

      {/* Buyer Info */}
      <div style={{ marginBottom: 12 }}>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MdPerson style={{ color: 'var(--accent)', fontSize: '1.2rem' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Contact</span>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
            {buyer.phone && <div><MdPhone style={{ verticalAlign: 'middle', marginRight: 4, fontSize: '0.9rem', color: 'var(--text-muted)' }} />{buyer.phone}</div>}
            {buyer.cnic && <div><MdBadge style={{ verticalAlign: 'middle', marginRight: 4, fontSize: '0.9rem', color: 'var(--text-muted)' }} />{buyer.cnic}</div>}
            {buyer.address && <div><MdLocationOn style={{ verticalAlign: 'middle', marginRight: 4, fontSize: '0.9rem', color: 'var(--text-muted)' }} />{buyer.address}</div>}
            {!buyer.phone && !buyer.cnic && !buyer.address && <span style={{ color: 'var(--text-muted)' }}>No contact info</span>}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="stat-card" style={{ animationDelay: '0s' }}>
          <div className="stat-icon amber"><MdPointOfSale /></div>
          <div className="stat-info"><h3>Opening Balance</h3><div className="stat-value">{formatPKR(openingBalance)}</div></div>
        </div>
        <div className="stat-card" style={{ animationDelay: '0.06s' }}>
          <div className="stat-icon red"><MdPointOfSale /></div>
          <div className="stat-info"><h3>Total Sales (Debit)</h3><div className="stat-value">{formatPKR(totalDebit)}</div></div>
        </div>
        <div className="stat-card" style={{ animationDelay: '0.12s' }}>
          <div className="stat-icon green"><MdPayment /></div>
          <div className="stat-info"><h3>Total Paid (Credit)</h3><div className="stat-value">{formatPKR(totalCredit)}</div></div>
        </div>
        <div className="stat-card" style={{ animationDelay: '0.18s' }}>
          <div className={`stat-icon ${finalBalance > 0 ? 'red' : 'green'}`}><MdPayment /></div>
          <div className="stat-info"><h3>Current Balance</h3><div className="stat-value" style={{ color: finalBalance > 0 ? 'var(--red)' : 'var(--green)' }}>{formatPKR(finalBalance)}</div></div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Khata / Ledger — <span className="urdu">کھاتا</span></h3>
        </div>
        <div className="data-table-wrapper" style={{ border: 'none' }}>
          <table className="data-table">
            <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Rate</th><th>Comm.</th><th>Debit</th><th>Credit</th><th>Payment</th><th>Balance</th><th></th></tr></thead>
            <tbody>
              <tr style={{ background: 'var(--glass)' }}><td></td><td colSpan={5}><strong>Opening Balance — ابتدائی بیلنس</strong></td><td></td><td></td><td></td><td></td><td className="amount" style={{ fontWeight: 700 }}>{formatPKR(openingBalance)}</td><td></td></tr>
              {(() => { let bal = openingBalance; return entries.map((e, i) => {
                bal += (e.debit || 0) - (e.credit || 0);
                return (
                  <tr key={i} onClick={() => (e.type === 'Sale' && e.sale_id) ? setSelectedEntry(e) : null} style={(e.type === 'Sale' && e.sale_id) ? { cursor: 'pointer' } : {}} title={(e.type === 'Sale' && e.sale_id) ? 'Click to view details' : ''}>
                    <td>{i + 1}</td>
                    <td>{formatDate(e.date)}</td>
                    <td><span className={`badge ${e.type === 'Sale' ? 'badge-regular' : 'badge-active'}`}>{e.type}</span></td>
                    <td>{e.product_name || '—'}{e.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.product_name_urdu}</span></> : ''}</td>
                    <td>{e.quantity || '—'}</td>
                    <td>{e.rate ? formatPKR(e.rate) : '—'}</td>
                    <td className="amount">{e.commission ? formatPKR(e.commission) : '—'}</td>
                    <td className="amount positive">{e.debit ? formatPKR(e.debit) : '—'}</td>
                    <td className="amount negative">{e.credit ? formatPKR(e.credit) : '—'}</td>
                    <td>{e.type === 'Sale' && e.payment_status ? <span className={`badge ${e.payment_status === 'Received' ? 'badge-active' : e.payment_status === 'Partial' ? 'badge-walkin' : 'badge-inactive'}`}>{e.payment_status}</span> : (e.type === 'Payment' ? <span className="badge badge-active">Received</span> : '—')}</td>
                    <td className="amount" style={{ fontWeight: 700 }}>{formatPKR(bal)}</td>
                    <td>
                      {e.type === 'Payment' && e.payment_id ? <button className="btn btn-sm btn-danger" onClick={(ev) => { ev.stopPropagation(); handleDeletePayment(e.payment_id); }} title="Delete Payment"><MdDelete /></button> : ''}
                      {e.type === 'Sale' && e.sale_id ? <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><button className="btn btn-sm btn-secondary" onClick={(ev) => { ev.stopPropagation(); openEditSaleForm(e); }} title="Edit Sale"><MdEdit /></button><button className="btn btn-sm btn-danger" onClick={(ev) => { ev.stopPropagation(); handleDeleteSale(e.sale_id); }} title="Delete Sale"><MdDelete /></button></div> : ''}
                    </td>
                  </tr>
                );
              }); })()}
              {entries.length === 0 && <tr><td colSpan={12} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No entries yet — ابھی تک کوئی اندراج نہیں</td></tr>}
              {entries.length > 0 && (
                <tr style={{ background: 'var(--glass)', fontWeight: 700 }}>
                  <td></td><td colSpan={5}><strong>Closing Balance — حتمی بیلنس</strong></td>
                  <td></td>
                  <td className="amount positive">{formatPKR(totalDebit)}</td>
                  <td className="amount negative">{formatPKR(totalCredit)}</td>
                  <td></td>
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
            <div className="form-group"><label>Amount (PKR)</label><input type="number" step="0.01" required value={payForm.amount} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} /></div>
            <div className="form-group"><label>Type</label><div style={{ padding: '10px 14px', background: 'var(--green-glow)', border: '1px solid var(--green)', borderRadius: 10, fontWeight: 600, color: 'var(--green)' }}>Received — وصولی</div></div>
            <div className="form-group"><label>Mode — ادائیگی کا طریقہ</label><select value={payForm.mode} onChange={e => setPayForm({ ...payForm, mode: e.target.value })}><option value="Cash">Cash — نقد</option><option value="Bank Transfer">Bank Transfer — بینک ٹرانسفر</option><option value="Cheque">Cheque — چیک</option><option value="Online">Online / JazzCash / EasyPaisa</option></select></div>
            <div className="form-group"><label>Reference / Cheque #</label><input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} /></div>
            <div className="form-group"><label>Notes</label><input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowPaymentForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Payment</button></div>
        </form>
      </Modal>

      {/* Sale Modal */}
      <Modal show={showSaleForm} onClose={() => { setShowSaleForm(false); setEditingSaleId(null); }} title={editingSaleId ? <>Edit Sale — <span className="urdu">فروخت میں ترمیم</span></> : <>New Sale to {buyer.name} — <span className="urdu">نئی فروخت</span></>} large>
        <form onSubmit={handleSaleSave}>
          <div className="form-grid">
            <div className="form-group"><label>Date & Time</label><input type="datetime-local" required value={saleForm.date} onChange={e => setSaleForm({ ...saleForm, date: e.target.value })} /></div>
            <div className="form-group">
              <label>Product — جنس</label>
              <select required value={saleForm.product_id} onChange={e => handleProductChange(e.target.value)}>
                <option value="">Select Product</option>
                {products.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name} — {p.name_urdu}</option>)}
              </select>
              {availableStock !== null && <div style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: 4, color: 'var(--green)' }}>Available: {formatNumber(availableStock)}</div>}
            </div>
            <div className="form-group">
              <label>Unit — اکائی</label>
              <select value={showUnitInput ? '__custom__' : saleForm.unit} onChange={e => {
                if (e.target.value === '__custom__') { setShowUnitInput(true); }
                else { setShowUnitInput(false); setNewUnit(''); setSaleForm({ ...saleForm, unit: e.target.value }); }
              }}>
                {!saleForm.unit && <option value="">Select Unit</option>}
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
              <label>Total Weight — <span className="urdu">کل وزن</span></label>
              <input type="number" step="0.01" required value={saleForm.total_weight}
                onKeyDown={blockInvalidChars} onWheel={preventScrollChange}
                onChange={e => { const tw = e.target.value; validateSafiWeight(tw, saleForm.kaat); const safi = Math.max(0, (parseFloat(tw) || 0) - (parseFloat(saleForm.kaat) || 0)); const comm = commissionMode === 'default' ? recalcCommission(safi, saleForm.rate) : calcCommission(safi, saleForm.rate, customPercent); setSaleForm({ ...saleForm, total_weight: tw, commission: comm }); }}
                style={stockWarning ? { borderColor: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.18)' } : {}} />
              {stockWarning && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8 }}>
                  <MdWarning style={{ fontSize: '1rem', color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>Overselling Notice — اسٹاک سے زیادہ</div>
                    <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: 2 }}>{stockWarning}. This will result in negative stock.</div>
                  </div>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Kaat — <span className="urdu">کاٹ</span></label>
              <input type="number" step="0.01" value={saleForm.kaat} onKeyDown={blockInvalidChars} onWheel={preventScrollChange}
                onChange={e => { const k = e.target.value; validateSafiWeight(saleForm.total_weight, k); const safi = Math.max(0, (parseFloat(saleForm.total_weight) || 0) - (parseFloat(k) || 0)); const comm = commissionMode === 'default' ? recalcCommission(safi, saleForm.rate) : calcCommission(safi, saleForm.rate, customPercent); setSaleForm({ ...saleForm, kaat: k, commission: comm }); }} />
            </div>
            <div className="form-group">
              <label>Safi Weight — <span className="urdu">صافی وزن</span></label>
              <input type="number" value={safiWeight.toFixed(2)} readOnly style={{ opacity: 0.8, cursor: 'not-allowed', fontWeight: 700, color: 'var(--green)' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Auto: Total Weight − Kaat</span>
            </div>
            <div className="form-group"><label>Rate — <span className="urdu">ریٹ</span></label><input type="number" step="0.01" required value={saleForm.rate} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => { const r = e.target.value; const comm = commissionMode === 'default' ? recalcCommission(safiWeight, r) : calcCommission(safiWeight, r, customPercent); setSaleForm({ ...saleForm, rate: r, commission: comm }); }} /></div>
            <div className="form-group">
              <label>Total Amount — <span className="urdu">کل رقم</span></label>
              <input type="number" value={saleTotal.toFixed(2)} readOnly style={{ opacity: 0.8, cursor: 'not-allowed', fontWeight: 700 }} />
            </div>
            <div className="form-group"><label>Bardana — <span className="urdu">باردانہ</span></label><input type="number" step="0.01" value={saleForm.bardana} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setSaleForm({ ...saleForm, bardana: e.target.value })} /></div>
            <div className="form-group"><label>Labour — <span className="urdu">مزدوری</span></label><input type="number" step="0.01" value={saleForm.labour} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setSaleForm({ ...saleForm, labour: e.target.value })} /></div>
            <div className="form-group"><label>Munshiyana — <span className="urdu">مُنشِیانَہ</span></label><input type="number" step="0.01" value={saleForm.munshiyana} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setSaleForm({ ...saleForm, munshiyana: e.target.value })} /></div>
            <div className="form-group"><label>Kiraya — <span className="urdu">کرایہ</span></label><input type="number" step="0.01" value={saleForm.kiraya} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setSaleForm({ ...saleForm, kiraya: e.target.value })} /></div>
            <div className="form-group"><label>Others — <span className="urdu">دیگر</span></label><input type="number" step="0.01" value={saleForm.others} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setSaleForm({ ...saleForm, others: e.target.value })} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Commission — <span className="urdu">کمیشن</span></span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => { setCommissionMode('default'); setCustomPercent(''); setSaleForm({ ...saleForm, commission: recalcCommission(safiWeight, saleForm.rate) }); }}
                    style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: commissionMode === 'default' ? 'var(--accent)' : 'transparent', color: commissionMode === 'default' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Default</button>
                  <button type="button" onClick={() => { setCommissionMode('custom'); const dp = getDefaultPercent(saleForm.product_id); setCustomPercent(dp); setSaleForm({ ...saleForm, commission: calcCommission(safiWeight, saleForm.rate, dp) }); }}
                    style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: commissionMode === 'custom' ? 'var(--accent2)' : 'transparent', color: commissionMode === 'custom' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Custom</button>
                </span>
              </label>
              {commissionMode === 'custom' ? (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: '0 0 100px', position: 'relative' }}>
                      <input type="number" step="0.01" min="0" value={customPercent} onChange={e => { const pct = e.target.value; setCustomPercent(pct); setSaleForm({ ...saleForm, commission: calcCommission(safiWeight, saleForm.rate, pct) }); }} style={{ borderColor: 'var(--accent2)', paddingRight: 28 }} placeholder="%" />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none' }}>%</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>→</span>
                    <input type="number" step="0.01" value={saleForm.commission} readOnly style={{ flex: 1, opacity: 0.8, cursor: 'not-allowed', fontWeight: 700, color: 'var(--accent2)' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent2)', marginTop: 2 }}>Enter your commission % — amount auto-calculated</span>
                </>
              ) : (
                <>
                  <input type="number" step="0.01" value={saleForm.commission} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Auto-calculated @ {getDefaultPercent(saleForm.product_id)}% (product default)</span>
                </>
              )}
            </div>

            {/* Payment from Buyer section */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
                💰 Payment from Buyer — خریدار سے وصولی
              </label>
              <div className="tabs" style={{ marginBottom: 10 }}>
                <button type="button" className={`tab ${saleForm.payment_status === 'To Receive' ? 'active' : ''}`}
                  onClick={() => setSaleForm({ ...saleForm, payment_status: 'To Receive', amount_paid: 0, payment_mode: 'On Account' })}
                  style={{ fontSize: '0.8rem' }}>To Receive — بعد میں وصولی</button>
                <button type="button" className={`tab ${(saleForm.payment_status === 'Partial' || saleForm.payment_status === 'Received') ? 'active' : ''}`}
                  onClick={() => setSaleForm({ ...saleForm, payment_status: 'Partial', amount_paid: saleForm.amount_paid || '' })}
                  style={{ fontSize: '0.8rem' }}>Receive Now — ابھی وصولی</button>
              </div>
              {(saleForm.payment_status === 'Partial' || saleForm.payment_status === 'Received') && (
                <>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <input type="number" step="0.01" value={saleForm.amount_paid}
                      onKeyDown={blockInvalidChars} onWheel={preventScrollChange}
                      onChange={e => {
                        const val = e.target.value;
                        const paid = parseFloat(val) || 0;
                        setSaleForm({ ...saleForm, amount_paid: val, payment_status: paid >= saleNet ? 'Received' : 'Partial' });
                      }}
                      placeholder="Amount received from buyer..."
                      style={{ flex: 1 }} />
                    <button type="button" className="btn btn-sm btn-secondary"
                      onClick={() => setSaleForm({ ...saleForm, amount_paid: saleNet, payment_status: 'Received' })}
                      style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>Full Amount</button>
                  </div>
                  {/* Real-time payment summary */}
                  {(() => { const paid = parseFloat(saleForm.amount_paid) || 0; const remaining = saleNet - paid; return (
                    <div className="payment-summary">
                      <div className="payment-summary-item"><div className="payment-summary-label">Net Amount — خالص</div><div className="payment-summary-value" style={{ color: 'var(--text-primary)' }}>{formatPKR(saleNet)}</div></div>
                      <div className="payment-summary-item"><div className="payment-summary-label">Receiving — وصولی</div><div className="payment-summary-value" style={{ color: 'var(--green)' }}>{formatPKR(paid)}</div></div>
                      <div className="payment-summary-item"><div className="payment-summary-label">Remaining — بقایا</div><div className="payment-summary-value" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>{formatPKR(remaining > 0 ? remaining : 0)}</div></div>
                    </div>
                  ); })()}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.78rem' }}>Payment Method — ادائیگی کا طریقہ</label>
                    <select value={saleForm.payment_mode} onChange={e => setSaleForm({ ...saleForm, payment_mode: e.target.value })}>
                      <option value="Cash">Cash — نقد</option>
                      <option value="Bank Transfer">Bank Transfer — بینک ٹرانسفر</option>
                      <option value="Cheque">Cheque — چیک</option>
                      <option value="Online">Online / JazzCash / EasyPaisa</option>
                    </select>
                  </div>
                </>
              )}
              {saleForm.payment_status === 'To Receive' && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  ادھار — No payment now, amount added to buyer's outstanding balance
                </div>
              )}
            </div>

            <div className="form-group"><label>Notes — نوٹ</label><input value={saleForm.notes} onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} /></div>
          </div>
          <div className="totals-bar"><span>Total: <strong>{formatPKR(saleTotal)}</strong></span><span>Net: <strong className="amount positive" style={{ fontSize: '1.1rem' }}>{formatPKR(saleNet)}</strong></span></div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => { setShowSaleForm(false); setEditingSaleId(null); }}>Cancel</button><button type="submit" className="btn btn-primary">{editingSaleId ? 'Update Sale' : 'Save Sale'}</button></div>
        </form>
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal show={!!selectedEntry} onClose={() => setSelectedEntry(null)} title={<>Sale Details — <span className="urdu">فروخت کی تفصیلات</span></>}>
        {selectedEntry && (() => {
          const e = selectedEntry;
          const remaining = (e.net_amount || 0) - (e.amount_paid || 0);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Product — جنس</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{e.product_name}{e.display_unit ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({e.display_unit})</span> : ''}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Date — تاریخ</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(e.date)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Weight — <span className="urdu">کل وزن</span></div>
                  <div style={{ fontWeight: 700 }}>{formatNumber(e.total_weight || e.quantity)} {e.display_unit || ''}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Kaat — <span className="urdu">کاٹ</span></div>
                  <div style={{ fontWeight: 700 }}>{formatNumber(e.kaat || 0)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Safi Weight — <span className="urdu">صافی وزن</span></div>
                  <div style={{ fontWeight: 700, color: 'var(--green)' }}>{formatNumber(e.quantity)} {e.display_unit || ''}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Rate — <span className="urdu">ریٹ</span></div>
                  <div style={{ fontWeight: 700 }}>{formatPKR(e.rate)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total — <span className="urdu">کل رقم</span></div>
                  <div style={{ fontWeight: 700 }}>{formatPKR(e.total)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Commission — <span className="urdu">کمیشن</span></div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatPKR(e.commission || 0)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Bardana — <span className="urdu">باردانہ</span></div>
                  <div style={{ fontWeight: 700 }}>{formatPKR(e.bardana || 0)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Labour — <span className="urdu">مزدوری</span></div>
                  <div style={{ fontWeight: 700 }}>{formatPKR(e.labour || 0)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Munshiyana — <span className="urdu">مُنشِیانَہ</span></div>
                  <div style={{ fontWeight: 700 }}>{formatPKR(e.munshiyana || 0)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Kiraya — <span className="urdu">کرایہ</span></div>
                  <div style={{ fontWeight: 700 }}>{formatPKR(e.kiraya || 0)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Others — <span className="urdu">دیگر</span></div>
                  <div style={{ fontWeight: 700 }}>{formatPKR(e.others || 0)}</div>
                </div>
              </div>
              <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.05))', borderRadius: 12, border: '1px solid var(--accent)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Net Amount — خالص رقم</div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent)' }}>{formatPKR(e.net_amount)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: e.payment_status === 'Received' ? 'rgba(76,175,80,0.08)' : e.payment_status === 'Partial' ? 'rgba(255,152,0,0.08)' : 'rgba(244,67,54,0.08)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Payment Status — ادائیگی</div>
                  <div><span className={`badge ${e.payment_status === 'Received' ? 'badge-active' : e.payment_status === 'Partial' ? 'badge-walkin' : 'badge-inactive'}`} style={{ fontSize: '0.85rem' }}>{e.payment_status || 'To Receive'}</span></div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Received — وصول شدہ</div>
                  <div style={{ fontWeight: 700, color: 'var(--green)' }}>{formatPKR(e.amount_paid || 0)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Remaining — بقایا</div>
                  <div style={{ fontWeight: 700, color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>{formatPKR(remaining > 0 ? remaining : 0)}</div>
                </div>
              </div>
              {e.payment_mode && e.payment_mode !== 'On Account' && <div style={{ padding: '10px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Payment Method — طریقہ</div>
                <div style={{ fontWeight: 600 }}>{e.payment_mode}</div>
              </div>}
              {e.notes && <div style={{ padding: '10px 16px', background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Notes — نوٹ</div>
                <div>{e.notes}</div>
              </div>}
            </div>
          );
        })()}
        <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setSelectedEntry(null)}>Close</button></div>
      </Modal>
    </div>
  );
}
