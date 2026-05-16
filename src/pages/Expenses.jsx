import React, { useState, useEffect } from 'react';
import { MdAdd, MdDelete, MdEdit, MdMoneyOff, MdFilterList } from 'react-icons/md';
import { formatPKR, formatDate, todayISO, todayDateOnly } from '../utils/formatters';
import { confirmAction } from '../utils/confirmDialog';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';

const CATEGORIES = [
  'General',
  'Chaye-Pani — چائے پانی',
  'Labour — مزدوری',
  'Transport — ٹرانسپورٹ',
  'Repair — مرمت',
  'Utility — یوٹیلیٹی',
  'Office — دفتر',
  'Other — دیگر',
];

const emptyForm = () => ({
  date: todayISO(),
  description: '',
  description_urdu: '',
  category: 'General',
  amount: '',
  notes: '',
});

export default function Expenses() {
  const [expenses, setExpenses]   = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(emptyForm());
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo]   = useState('');
  const [filterCat, setFilterCat] = useState('');
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    const f = {};
    if (filterFrom) f.dateFrom = filterFrom;
    if (filterTo)   f.dateTo   = filterTo;
    if (filterCat)  f.category = filterCat;
    setExpenses(await window.api.getExpenses(f));
  };

  // Re-load when filters change
  useEffect(() => { load(); }, [filterFrom, filterTo, filterCat]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (exp) => {
    setEditId(exp.id);
    setForm({
      date: exp.date,
      description: exp.description,
      description_urdu: exp.description_urdu || '',
      category: exp.category || 'General',
      amount: String(exp.amount),
      notes: exp.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const data = { ...form, amount: parseFloat(form.amount) };
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

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Category breakdown for summary
  const catTotals = expenses.reduce((acc, e) => {
    const cat = e.category || 'General';
    acc[cat] = (acc[cat] || 0) + (e.amount || 0);
    return acc;
  }, {});

  // Badge color by category
  const getCatColor = (cat) => {
    if (cat?.includes('Chaye') || cat?.includes('چائے')) return { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' };
    if (cat?.includes('Labour') || cat?.includes('مزدوری')) return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' };
    if (cat?.includes('Transport') || cat?.includes('ٹرانسپورٹ')) return { color: '#4fc3f7', bg: 'rgba(79,195,247,0.1)', border: 'rgba(79,195,247,0.2)' };
    if (cat?.includes('Repair') || cat?.includes('مرمت')) return { color: '#ff9800', bg: 'rgba(255,152,0,0.1)', border: 'rgba(255,152,0,0.2)' };
    return { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };
  };

  const handleExport = async (format) => {
    if (expenses.length === 0) return;
    const columns = ['#', 'Date', 'Category', 'Description', 'Amount (PKR)', 'Notes'];
    const rows = expenses.map((e, i) => [
      i + 1,
      formatDate(e.date),
      e.category || 'General',
      e.description + (e.description_urdu ? '\n' + e.description_urdu : ''),
      formatPKR(e.amount),
      e.notes || '—',
    ]);
    rows.push(['', '', '', 'Total — کل خرچہ', formatPKR(totalExpenses), '']);
    const summary = [
      { label: 'Total Expenses — کل خرچہ', value: formatPKR(totalExpenses) },
      { label: 'Entries', value: String(expenses.length) },
    ];
    const exportData = { title: 'Expenses Report — روزانہ خرچہ', columns, rows, summary, dateRange: filterFrom && filterTo ? `${formatDate(filterFrom)} – ${formatDate(filterTo)}` : '' };
    let saved = false;
    const ts = fileTimestamp();
    if (format === 'pdf')  saved = await exportToPDF({ ...exportData, fileName: `Expenses_Report_${ts}.pdf` });
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
          <ExportDropdown onExport={handleExport} disabled={expenses.length === 0} />
          <button className="btn btn-primary" id="add-expense-btn" onClick={openAdd}>
            <MdAdd /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary Card */}
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
            <div className="stat-value" style={{ fontSize: '0.85rem', color: '#a78bfa' }}>
              {Object.keys(catTotals).length > 0
                ? Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0][0].split(' — ')[0]
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
        <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
          <label style={{ fontSize: '0.7rem' }}>Category</label>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem' }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
              <th>Description — تفصیل</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Notes</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, i) => {
              const cc = getCatColor(exp.category);
              return (
                <tr key={exp.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(exp.date)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                      fontSize: '0.68rem', fontWeight: 600,
                      color: cc.color, background: cc.bg, border: `1px solid ${cc.border}`,
                    }}>
                      {exp.category?.split(' — ')[0] || 'General'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {exp.description}
                    {exp.description_urdu && (
                      <><br /><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{exp.description_urdu}</span></>
                    )}
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
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <MdMoneyOff style={{ fontSize: '2.5rem', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  No expenses recorded — <span className="urdu">کوئی خرچہ نہیں</span>
                </td>
              </tr>
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', padding: '12px 16px' }}>
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

      {/* Add / Edit Modal */}
      <Modal
        show={showForm}
        onClose={() => setShowForm(false)}
        title={editId
          ? <><MdEdit style={{ marginRight: 8 }} />Edit Expense — <span className="urdu">خرچہ ترمیم</span></>
          : <><MdAdd style={{ marginRight: 8 }} />Add Expense — <span className="urdu">نیا خرچہ</span></>}
      >
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label>Date &amp; Time</label>
              <input
                type="datetime-local"
                required
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Category — زمرہ</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description — تفصیل <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                required
                placeholder="e.g. Chai for labourers, Petrol, etc."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description (Urdu) — <span className="urdu">اردو تفصیل</span></label>
              <input
                className="urdu"
                placeholder="مثال: مزدوروں کی چائے"
                value={form.description_urdu}
                onChange={e => setForm({ ...form, description_urdu: e.target.value })}
              />
            </div>
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
            <div className="form-group">
              <label>Notes — <span className="urdu">نوٹس</span></label>
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
            fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8
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
    </div>
  );
}
