import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdSearch } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { formatPKR, todayISO } from '../utils/formatters';
import { confirmAction } from '../utils/confirmDialog';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';
import { useShortcuts } from '../context/ShortcutContext';
import ShortcutBadge from '../components/ShortcutBadge';

export default function Buyers() {
  const [buyers, setBuyers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const emptyForm = { name: '', name_urdu: '', phone: '', address: '', cnic: '', opening_balance: '', status: 'Active' };
  const [form, setForm] = useState(emptyForm);
  const navigate = useNavigate();
  const toast = useToast();
  const { registerPageHandlers, unregisterPageHandlers } = useShortcuts();

  useEffect(() => { load(); }, []);

  // Register keyboard shortcuts for this page
  useEffect(() => {
    registerPageHandlers({
      'page.new': () => { setEditing(null); setForm(emptyForm); setShowForm(true); },
      'page.exportPdf': () => handleExport('pdf'),
      'page.exportXlsx': () => handleExport('xlsx'),
    });
    return () => unregisterPageHandlers();
  }, [buyers]);
  const load = async () => { const d = await window.api.getBuyers(); setBuyers(d.filter(c => c.type === 'Regular')); };
  const handleSave = async (e) => { e.preventDefault(); if (editing) await window.api.updateBuyer(editing.id, { ...form, type: 'Regular' }); else await window.api.addBuyer({ ...form, type: 'Regular' }); setShowForm(false); setEditing(null); setForm(emptyForm); load(); toast.success(editing ? 'Buyer updated! — خریدار اپ ڈیٹ ہو گیا' : 'Buyer added! — خریدار شامل ہو گیا'); };
  const handleEdit = (c) => { setEditing(c); setForm(c); setShowForm(true); };
  const handleDelete = async (id) => { if (confirmAction('Delete this buyer?')) { await window.api.deleteBuyer(id); load(); toast.success('Buyer deleted — خریدار حذف ہو گیا'); } };
  const filtered = buyers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.name_urdu || '').includes(search) || (c.phone || '').includes(search));

  const handleExport = async (format) => {
    if (filtered.length === 0) return;
    const columns = ['#', 'Name / نام', 'Phone', 'CNIC', 'Address', 'Opening Balance', 'Status'];
    const rows = filtered.map((c, i) => [i + 1, c.name + (c.name_urdu ? '\n' + c.name_urdu : ''), c.phone || '—', c.cnic || '—', c.address || '—', formatPKR(c.opening_balance || 0), c.status]);
    const summary = [{ label: 'Total Buyers / کل خریدار', value: String(filtered.length) }, { label: 'Total Opening Balance / ابتدائی بیلنس', value: formatPKR(filtered.reduce((s, c) => s + (c.opening_balance || 0), 0)) }];
    const exportData = { title: 'Buyers List — خریداروں کی فہرست', columns, rows, summary, dateRange: '' };
    let saved = false; const ts = fileTimestamp();
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `Buyers_${ts}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `Buyers_${ts}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `Buyers_${ts}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Buyers — <span className="urdu">خریدار</span></h2>
        <div className="flex gap-2">
          <ExportDropdown onExport={handleExport} disabled={filtered.length === 0} />
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}><MdAdd /> Add Buyer<ShortcutBadge actionId="page.new" /></button>
        </div>
      </div>
      <div className="search-bar"><MdSearch /><input placeholder="Search buyers..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Name (Urdu)</th><th>Phone</th><th>CNIC</th><th>Opening Bal.</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((c, i) => (<tr key={c.id} onClick={() => navigate(`/buyer/${c.id}`)} style={{ cursor: 'pointer' }} title="View Khata / Ledger"><td>{i + 1}</td><td style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.name}</td><td className="urdu">{c.name_urdu || '—'}</td><td>{c.phone || '—'}</td><td>{c.cnic || '—'}</td><td className="amount">{c.opening_balance?.toLocaleString() || 0}</td><td><span className={`badge ${c.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>{c.status}</span></td><td><div className="flex gap-2"><button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); handleEdit(c); }} title="Edit"><MdEdit /></button><button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} title="Delete"><MdDelete /></button></div></td></tr>))}
            {filtered.length === 0 && <tr><td colSpan={8} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No buyers found</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal show={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Buyer' : 'Add Buyer — نیا خریدار'}>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group"><label>Name (English)</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label>Name (Urdu) — نام</label><input className="urdu" value={form.name_urdu} onChange={e => setForm({ ...form, name_urdu: e.target.value })} /></div>
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-group"><label>CNIC</label><input value={form.cnic} onChange={e => setForm({ ...form, cnic: e.target.value })} /></div>
            <div className="form-group"><label>Opening Balance (PKR)</label><input type="number" step="0.01" value={form.opening_balance} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => setForm({ ...form, opening_balance: e.target.value })} placeholder="0" /></div>
            <div className="form-group"><label>Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Inactive</option></select></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Save'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
