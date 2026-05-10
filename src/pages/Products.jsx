import React, { useState, useEffect, useRef } from 'react';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdClose } from 'react-icons/md';
import Modal from '../components/Modal';
import { formatNumber } from '../utils/formatters';
import { confirmAction } from '../utils/confirmDialog';
import { useToast } from '../components/Toast';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', name_urdu: '', unit: '', commission_rate: '', opening_stock: '', status: 'Active' });
  const [newUnit, setNewUnit] = useState('');
  const [showUnitInput, setShowUnitInput] = useState(false);
  const toast = useToast();

  // Ref always holds the latest form — immune to stale closures
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setProducts(await window.api.getProducts());
    setUnits(await window.api.getUnits());
  };

  const resetForm = () => {
    setForm({ name: '', name_urdu: '', unit: '', commission_rate: '', opening_stock: '', status: 'Active' });
    setShowUnitInput(false);
    setNewUnit('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const f = formRef.current;
    if (!f.name.trim()) return toast.error('Product name is required — جنس کا نام ضروری ہے');

    // Check for duplicate product name (case-insensitive)
    const nameLower = f.name.trim().toLowerCase();
    const nameUrduTrimmed = (f.name_urdu || '').trim();
    const duplicate = products.find(p => {
      if (editing && p.id === editing.id) return false; // skip self when editing
      if (p.name.trim().toLowerCase() === nameLower) return true;
      if (nameUrduTrimmed && (p.name_urdu || '').trim() === nameUrduTrimmed) return true;
      return false;
    });
    if (duplicate) return toast.error(`A product named "${duplicate.name}" already exists — یہ جنس پہلے سے موجود ہے`);

    if (editing) await window.api.updateProduct(editing.id, f);
    else await window.api.addProduct(f);
    setShowForm(false);
    setEditing(null);
    resetForm();
    load();
    toast.success(editing ? 'Product updated! — جنس اپ ڈیٹ ہو گئی' : 'Product added! — جنس شامل ہو گئی');
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({ ...p, commission_rate: p.commission_rate ?? '', opening_stock: p.opening_stock ?? '' });
    setShowUnitInput(false);
    setNewUnit('');
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirmAction('Delete?')) { await window.api.deleteProduct(id); load(); toast.success('Product deleted — جنس حذف ہو گئی'); }
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

  const handleDeleteUnit = async (unitId, unitName) => {
    const inUse = products.some(p => p.unit === unitName);
    if (inUse) { toast.error(`Cannot delete "${unitName}" — it is being used by a product.`); return; }
    if (confirmAction(`Delete unit "${unitName}"?`)) {
      await window.api.deleteUnit(unitId);
      setUnits(await window.api.getUnits());
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.name_urdu || '').includes(search)
  );

  const openAddForm = () => {
    setEditing(null);
    resetForm();
    setShowForm(true);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Products — <span className="urdu">اجناس</span></h2>
        <button className="btn btn-primary" onClick={openAddForm}><MdAdd /> Add Product</button>
      </div>
      <div className="search-bar"><MdSearch /><input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Name (Urdu)</th><th>Unit</th><th>Commission %</th><th>Opening Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="urdu">{p.name_urdu || '—'}</td>
                <td>{p.unit || '—'}</td>
                <td>{p.commission_rate}%</td>
                <td className="amount">{formatNumber(p.opening_stock || 0)} {p.unit}</td>
                <td><span className={`badge ${p.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>{p.status}</span></td>
                <td><div className="flex gap-2">
                  <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(p)}><MdEdit /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}><MdDelete /></button>
                </div></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No products</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal show={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Product' : 'Add Product — نئی جنس'}>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name (English)</label>
              <input required value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Wheat" />
            </div>
            <div className="form-group">
              <label>Name (Urdu)</label>
              <input className="urdu" value={form.name_urdu} onChange={e => updateField('name_urdu', e.target.value)} placeholder="گندم" />
            </div>

            {/* Unit selector */}
            <div className="form-group">
              <label>Unit — اکائی</label>
              <select
                value={showUnitInput ? '__custom__' : form.unit}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    setShowUnitInput(true);
                  } else {
                    setShowUnitInput(false);
                    setNewUnit('');
                    updateField('unit', e.target.value);
                  }
                }}
              >
                {!form.unit && <option value="">Select Unit</option>}
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                <option value="__custom__">➕ Add Custom Unit...</option>
              </select>
              {showUnitInput && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    placeholder="Type unit name, e.g. KG, Mann, Bag..."
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddUnit(); }
                      if (e.key === 'Escape') { setShowUnitInput(false); setNewUnit(''); }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleAddUnit} title="Save unit" style={{ minWidth: 34, height: 40 }}>
                    <MdAdd />
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setShowUnitInput(false); setNewUnit(''); }} title="Cancel" style={{ minWidth: 34, height: 40 }}>
                    <MdClose />
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Commission Rate (%)</label>
              <input type="number" step="0.01" value={form.commission_rate} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => updateField('commission_rate', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Opening Stock — ابتدائی اسٹاک</label>
              <input type="number" step="0.01" value={form.opening_stock} onKeyDown={blockInvalidChars} onWheel={preventScrollChange} onChange={e => updateField('opening_stock', e.target.value)} placeholder="0" />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Stock you already have before any purchase entry
              </span>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => updateField('status', e.target.value)}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
