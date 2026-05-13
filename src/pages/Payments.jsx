import React, { useState, useEffect } from 'react';
import { MdAdd, MdDelete } from 'react-icons/md';
import { formatPKR, formatDate, todayISO } from '../utils/formatters';
import { confirmAction } from '../utils/confirmDialog';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ party_type: 'Buyer', party_id: '', date: todayISO(), amount: '', type: 'Received', mode: 'Cash', reference: '', notes: '' });
  const toast = useToast();

  useEffect(() => { load(); }, []);
  const load = async () => {
    setPayments(await window.api.getPayments());
    const allC = await window.api.getBuyers(); setBuyers(allC.filter(c => c.type === 'Regular'));
    const allD = await window.api.getSuppliers(); setSuppliers(allD.filter(d => d.type === 'Regular'));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await window.api.addPayment({ ...form, party_id: parseInt(form.party_id), amount: parseFloat(form.amount) });
    setShowForm(false);
    setForm({ party_type: 'Customer', party_id: '', date: todayISO(), amount: '', type: 'Received', mode: 'Cash', reference: '', notes: '' });
    load();
    toast.success('Payment saved! — ادائیگی محفوظ ہو گئی');
  };
  const handleDelete = async (id) => { if (confirmAction('Delete?')) { await window.api.deletePayment(id); load(); toast.success('Payment deleted — ادائیگی حذف ہو گئی'); } };
  const partyList = form.party_type === 'Buyer' ? buyers : suppliers;

  const handleExport = async (format) => {
    if (payments.length === 0) return;
    const columns = ['#', 'Date', 'Party Type', 'Party Name / نام', 'Type', 'Amount', 'Mode', 'Reference'];
    const rows = payments.map((p, i) => [i + 1, formatDate(p.date), p.party_type, (p.party_name || '—') + (p.party_name_urdu ? '\n' + p.party_name_urdu : ''), p.type, formatPKR(p.amount), p.mode, p.reference || '—']);
    const totalReceived = payments.filter(p => p.type === 'Received').reduce((s, p) => s + (p.amount || 0), 0);
    const totalPaid = payments.filter(p => p.type === 'Paid').reduce((s, p) => s + (p.amount || 0), 0);
    const summary = [{ label: 'Total Received / کل وصولی', value: formatPKR(totalReceived) }, { label: 'Total Paid / کل ادائیگی', value: formatPKR(totalPaid) }, { label: 'Entries', value: String(payments.length) }];
    const exportData = { title: 'Payments Report — ادائیگی رپورٹ', columns, rows, summary, dateRange: '' };
    let saved = false; const ts = fileTimestamp();
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `Payments_Report_${ts}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `Payments_Report_${ts}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `Payments_Report_${ts}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Payments — <span className="urdu">ادائیگی</span></h2>
        <div className="flex gap-2">
          <ExportDropdown onExport={handleExport} disabled={payments.length === 0} />
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><MdAdd /> New Payment</button>
        </div>
      </div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Date</th><th>Party Type</th><th>Party Name</th><th>Type</th><th>Amount</th><th>Mode</th><th>Reference</th><th></th></tr></thead>
          <tbody>
            {payments.map((p, i) => (<tr key={p.id}><td>{i + 1}</td><td>{formatDate(p.date)}</td><td><span className={`badge ${p.party_type === 'Buyer' ? 'badge-regular' : 'badge-walkin'}`}>{p.party_type}</span></td><td style={{ fontWeight: 600 }}>{p.party_name}{p.party_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{p.party_name_urdu}</span></> : ''}</td><td><span className={`badge ${p.type === 'Received' ? 'badge-active' : 'badge-inactive'}`}>{p.type}</span></td><td className="amount" style={{ fontWeight: 700 }}>{formatPKR(p.amount)}</td><td>{p.mode}</td><td>{p.reference || '—'}</td><td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}><MdDelete /></button></td></tr>))}
            {payments.length === 0 && <tr><td colSpan={9} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No payments</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal show={showForm} onClose={() => setShowForm(false)} title={<>New Payment — <span className="urdu">نئی ادائیگی</span></>}>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group"><label>Party Type</label><select value={form.party_type} onChange={e => setForm({ ...form, party_type: e.target.value, party_id: '', type: e.target.value === 'Buyer' ? 'Received' : 'Paid' })}><option>Buyer</option><option>Supplier</option></select></div>
            <div className="form-group"><label>{form.party_type}</label><select required value={form.party_id} onChange={e => setForm({ ...form, party_id: e.target.value })}><option value="">Select {form.party_type}</option>{partyList.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="form-group"><label>Date & Time</label><input type="datetime-local" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="form-group"><label>Amount (PKR)</label><input type="number" step="0.01" required value={form.amount} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="form-group"><label>Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Received</option><option>Paid</option></select></div>
            <div className="form-group"><label>Mode</label><select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option></select></div>
            <div className="form-group"><label>Reference / Cheque #</label><input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
            <div className="form-group"><label>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Payment</button></div>
        </form>
      </Modal>
    </div>
  );
}
