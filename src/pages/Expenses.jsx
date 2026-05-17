import React, { useState, useEffect, useRef } from 'react';
import { MdAdd, MdDelete, MdEdit, MdMoneyOff, MdFilterList, MdLabel, MdClose, MdCheck } from 'react-icons/md';
import { formatPKR, formatDate, todayISO } from '../utils/formatters';
import { confirmAction } from '../utils/confirmDialog';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';
import { useShortcuts } from '../context/ShortcutContext';
import ShortcutBadge from '../components/ShortcutBadge';

const CAT_COLORS = [
  '#a78bfa', '#4fc3f7', '#f87171', '#ff9800',
  '#34d399', '#f472b6', '#fbbf24', '#60a5fa',
];
function catColor(name, index) {
  const idx = typeof index === 'number' ? index : (name?.charCodeAt(0) || 0) % CAT_COLORS.length;
  const c = CAT_COLORS[idx % CAT_COLORS.length];
  return { color: c, bg: c + '1a', border: c + '40' };
}

const emptyForm = (defaultCat = 'General') => ({
  date: todayISO(),
  category: defaultCat,
  amount: '',
  notes: '',
});

export default function Expenses() {
  const [expenses, setExpenses]       = useState([]);
  const [categories, setCategories]   = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState(null);
  const [form, setForm]               = useState(emptyForm());
  const [filterFrom, setFilterFrom]   = useState('');
  const [filterTo, setFilterTo]       = useState('');
  const [filterCat, setFilterCat]     = useState('');

  // Inline category add state (inside the expense form modal dropdown)
  const [addingCat, setAddingCat]     = useState(false);
  const [newCatName, setNewCatName]   = useState('');
  const newCatRef = useRef(null);

  // Manage Categories modal — uses its own separate state to avoid conflicts
  const [showManageCats, setShowManageCats] = useState(false);
  const [manageCatName, setManageCatName]   = useState('');

  const toast = useToast();
  const { registerPageHandlers, unregisterPageHandlers } = useShortcuts();

  useEffect(() => {
    loadCategories();
    load();
  }, []);

  useEffect(() => { load(); }, [filterFrom, filterTo, filterCat]);

  // Register keyboard shortcuts for this page
  useEffect(() => {
    registerPageHandlers({
      'page.new': () => openAdd(),
      'page.manage': () => setShowManageCats(true),
      'page.exportPdf': () => handleExport('pdf'),
    });
    return () => unregisterPageHandlers();
  }, [expenses]);

  const loadCategories = async () => {
    try {
      const cats = await window.api.getExpenseCategories();
      setCategories(cats || []);
      return cats || [];
    } catch (e) {
      console.warn('Could not load expense categories:', e);
      return [];
    }
  };

  const load = async () => {
    const f = {};
    if (filterFrom) f.dateFrom = filterFrom;
    if (filterTo)   f.dateTo   = filterTo;
    if (filterCat)  f.category = filterCat;
    setExpenses(await window.api.getExpenses(f));
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm(categories[0]?.name || 'General'));
    setAddingCat(false);
    setNewCatName('');
    setShowForm(true);
  };

  const openEdit = (exp) => {
    setEditId(exp.id);
    setForm({
      date: exp.date,
      category: exp.category || 'General',
      amount: String(exp.amount),
      notes: exp.notes || '',
    });
    setAddingCat(false);
    setNewCatName('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const data = {
      date: form.date,
      category: form.category,
      amount: parseFloat(form.amount),
      notes: form.notes,
      description: '',
      description_urdu: '',
    };
    if (editId) {
      await window.api.updateExpense(editId, data);
      toast.success('Expense updated! — خرچہ اپ ڈیٹ ہو گیا');
    } else {
      await window.api.addExpense(data);
      toast.success('Expense saved! — خرچہ محفوظ ہو گیا');
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id) => {
    if (confirmAction('Delete this expense?')) {
      await window.api.deleteExpense(id);
      load();
      toast.success('Expense deleted — خرچہ حذف ہو گیا');
    }
  };

  // ── Inline add new category ──────────────────────────────────────
  const handleStartAddCat = () => {
    setAddingCat(true);
    setNewCatName('');
    setTimeout(() => newCatRef.current?.focus(), 80);
  };

  const handleSaveNewCat = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const res = await window.api.addExpenseCategory(name);
    if (res?.error) { toast.error(res.error); return; }
    // Reload categories first, then switch back to dropdown with new category selected
    const updated = await loadCategories();
    // Ensure the new category exists in the updated list before selecting it
    const exists = (updated || []).some(c => c.name === name);
    setForm(f => ({ ...f, category: exists ? name : (updated?.[0]?.name || 'General') }));
    setAddingCat(false);
    setNewCatName('');
    toast.success(`Category "${name}" added!`);
  };

  const handleCancelAddCat = () => {
    setAddingCat(false);
    setNewCatName('');
  };

  // ── Manage Categories modal ──────────────────────────────────────
  const handleDeleteCat = async (cat) => {
    if (confirmAction(`Delete category "${cat.name}"? Existing expenses in this category will keep the category name.`)) {
      const res = await window.api.deleteExpenseCategory(cat.id);
      if (res?.error) { toast.error(res.error); return; }
      loadCategories();
      toast.success(`Category deleted`);
    }
  };

  // ── Computed values ──────────────────────────────────────────────
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const catTotals = expenses.reduce((acc, e) => {
    const c = e.category || 'General';
    acc[c] = (acc[c] || 0) + (e.amount || 0);
    return acc;
  }, {});

  const getCatIdx = (name) => categories.findIndex(c => c.name === name);

  const handleExport = async (format) => {
    if (expenses.length === 0) return;
    const columns = ['#', 'Date', 'Category', 'Amount (PKR)', 'Notes'];
    const rows = expenses.map((e, i) => [
      i + 1,
      formatDate(e.date),
      e.category || 'General',
      formatPKR(e.amount),
      e.notes || '—',
    ]);
    rows.push(['', '', 'Total — کل خرچہ', formatPKR(totalExpenses), '']);
    const summary = [
      { label: 'Total Expenses — کل خرچہ', value: formatPKR(totalExpenses) },
      { label: 'Entries', value: String(expenses.length) },
    ];
    const exportData = {
      title: 'Expenses Report — روزانہ خرچہ', columns, rows, summary,
      dateRange: filterFrom && filterTo ? `${formatDate(filterFrom)} – ${formatDate(filterTo)}` : '',
    };
    let saved = false;
    const ts = fileTimestamp();
    if (format === 'pdf')       saved = await exportToPDF({ ...exportData, fileName: `Expenses_Report_${ts}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `Expenses_Report_${ts}.xlsx` });
    else if (format === 'csv')  saved = await exportToCSV({ ...exportData, fileName: `Expenses_Report_${ts}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h2>
          Expenses — <span className="urdu">روزانہ خرچہ</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10, verticalAlign: 'middle' }}>
            (Managed from Rokar Khata — روکڑ کھاتہ)
          </span>
        </h2>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowManageCats(true)}>
            <MdLabel /> Categories
          </button>
          <ExportDropdown onExport={handleExport} disabled={expenses.length === 0} />
          <button className="btn btn-primary" onClick={openAdd}>
            <MdAdd /> Add Expense<ShortcutBadge actionId="page.new" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon red"><MdMoneyOff /></div>
          <div className="stat-info">
            <h3>Total Expenses — کل خرچہ</h3>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{formatPKR(totalExpenses)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon indigo">📋</div>
          <div className="stat-info">
            <h3>Total Entries — کل اندراج</h3>
            <div className="stat-value">{expenses.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>☕</div>
          <div className="stat-info">
            <h3>Top Category</h3>
            <div className="stat-value" style={{ fontSize: '0.9rem', color: '#a78bfa' }}>
              {Object.keys(catTotals).length > 0
                ? Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0][0]
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, padding: '12px 16px',
        background: 'var(--glass)', borderRadius: 12, border: '1px solid var(--border)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <MdFilterList style={{ color: 'var(--accent)', fontSize: '1.2rem' }} />
        <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
          <label style={{ fontSize: '0.7rem' }}>From Date</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem' }} />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
          <label style={{ fontSize: '0.7rem' }}>To Date</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem' }} />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
          <label style={{ fontSize: '0.7rem' }}>Category</label>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem' }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        {(filterFrom || filterTo || filterCat) && (
          <button className="btn btn-sm btn-secondary" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterCat(''); }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Date</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Notes</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, i) => {
              const idx = getCatIdx(exp.category);
              const cc = catColor(exp.category, idx);
              return (
                <tr key={exp.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(exp.date)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                      fontSize: '0.72rem', fontWeight: 600,
                      color: cc.color, background: cc.bg, border: `1px solid ${cc.border}`,
                    }}>
                      {exp.category || 'General'}
                    </span>
                  </td>
                  <td className="amount" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>
                    {formatPKR(exp.amount)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{exp.notes || '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-sm btn-secondary" title="Edit" onClick={() => openEdit(exp)}><MdEdit /></button>
                      <button className="btn btn-sm btn-danger" title="Delete" onClick={() => handleDelete(exp.id)}><MdDelete /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <MdMoneyOff style={{ fontSize: '2.5rem', display: 'block', margin: '0 auto 8px' }} />
                  No expenses recorded — <span className="urdu">کوئی خرچہ نہیں</span>
                </td>
              </tr>
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', padding: '12px 16px' }}>
                  Total — کل
                </td>
                <td className="amount" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--red)', fontSize: '1rem' }}>
                  {formatPKR(totalExpenses)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Add / Edit Expense Modal ── */}
      <Modal
        show={showForm}
        onClose={() => setShowForm(false)}
        title={editId
          ? <><MdEdit style={{ marginRight: 8 }} />Edit Expense — <span className="urdu">خرچہ ترمیم</span></>
          : <><MdAdd style={{ marginRight: 8 }} />Add Expense — <span className="urdu">نیا خرچہ</span></>}
      >
        <form onSubmit={handleSave}>
          <div className="form-grid">
            {/* Date */}
            <div className="form-group">
              <label>Date &amp; Time</label>
              <input
                type="datetime-local"
                required
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* Amount */}
            <div className="form-group">
              <label>Amount (PKR) — <span className="urdu">رقم</span> <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onKeyDown={blockInvalidChars}
                onWheel={preventScrollChange}
                onChange={e => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            {/* Category — full width with inline add */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Category — <span className="urdu">زمرہ</span></span>
                {!addingCat && (
                  <button
                    type="button"
                    onClick={handleStartAddCat}
                    style={{
                      fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(167,139,250,0.12)', color: '#a78bfa',
                      border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <MdAdd style={{ fontSize: '0.9rem' }} /> Add New
                  </button>
                )}
              </div>

              {!addingCat ? (
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    ref={newCatRef}
                    type="text"
                    placeholder="Type new category name..."
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleSaveNewCat(); }
                      if (e.key === 'Escape') handleCancelAddCat();
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewCat}
                    disabled={!newCatName.trim()}
                    style={{
                      padding: '8px 10px', borderRadius: 8, border: 'none',
                      background: 'rgba(52,211,153,0.15)', color: 'var(--green)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}
                    title="Save category"
                  >
                    <MdCheck style={{ fontSize: '1.1rem' }} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddCat}
                    style={{
                      padding: '8px 10px', borderRadius: 8, border: 'none',
                      background: 'rgba(248,113,113,0.12)', color: 'var(--red)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}
                    title="Cancel"
                  >
                    <MdClose style={{ fontSize: '1.1rem' }} />
                  </button>
                </div>
              )}
            </div>

            {/* Notes — optional, full width */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Notes — <span className="urdu">نوٹس</span> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>(Optional)</span></label>
              <input
                placeholder="Optional remarks"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)',
            fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8,
          }}>
            💡 This expense will be automatically deducted from <strong style={{ color: 'var(--red)' }}>Rokar Khata</strong> — <span className="urdu">یہ خرچہ روکڑ کھاتے سے کٹے گا</span>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {editId ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Manage Categories Modal ── */}
      <Modal
        show={showManageCats}
        onClose={() => { setShowManageCats(false); setManageCatName(''); }}
        title={<><MdLabel style={{ marginRight: 8 }} />Manage Categories — <span className="urdu">زمرے</span></>}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Default categories cannot be deleted. Custom ones can be removed anytime.
          </p>

          {/* Add new category */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>New Category — <span className="urdu">نیا زمرہ</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Type new category name..."
                value={manageCatName}
                onChange={e => setManageCatName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!manageCatName.trim()) return;
                    const res = await window.api.addExpenseCategory(manageCatName.trim());
                    if (res?.error) { toast.error(res.error); return; }
                    setManageCatName('');
                    loadCategories();
                    toast.success('Category added!');
                  }
                }}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                style={{ flexShrink: 0 }}
                onClick={async () => {
                  if (!manageCatName.trim()) return;
                  const res = await window.api.addExpenseCategory(manageCatName.trim());
                  if (res?.error) { toast.error(res.error); return; }
                  setManageCatName('');
                  loadCategories();
                  toast.success('Category added!');
                }}
              >
                <MdAdd /> Add
              </button>
            </div>
          </div>

          {/* Category list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {categories.map((cat, idx) => {
              const cc = catColor(cat.name, idx);
              return (
                <div key={cat.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: cc.color, display: 'inline-block', flexShrink: 0,
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cat.name}</span>
                    {cat.is_default ? (
                      <span style={{
                        fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(212,160,23,0.12)', color: 'var(--accent)',
                        border: '1px solid rgba(212,160,23,0.25)',
                      }}>Default</span>
                    ) : (
                      <span style={{
                        fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                        border: '1px solid rgba(167,139,250,0.25)',
                      }}>Custom</span>
                    )}
                  </div>
                  {!cat.is_default && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteCat(cat)}
                      title="Delete category"
                    >
                      <MdDelete />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => setShowManageCats(false)}>Done</button>
        </div>
      </Modal>
    </div>
  );
}
