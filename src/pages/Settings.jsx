import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { MdBackup, MdRestore, MdDeleteForever, MdLightMode, MdDarkMode, MdInfo, MdStorage, MdWarning, MdCheckCircle, MdError, MdWarningAmber } from 'react-icons/md';
import Modal from '../components/Modal';
import logo from '../assets/logo.png';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState('');

  // Confirmation modals
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Result/feedback modal
  const [resultModal, setResultModal] = useState({ show: false, type: '', title: '', message: '', detail: '' });

  const showResult = (type, title, message, detail = '') => {
    setResultModal({ show: true, type, title, message, detail });
  };
  const closeResult = () => setResultModal({ show: false, type: '', title: '', message: '', detail: '' });

  useEffect(() => {
    loadDbInfo();
  }, []);

  const loadDbInfo = async () => {
    try {
      const info = await window.api.getDatabaseInfo();
      setDbInfo(info);
    } catch (e) { /* ignore if not available */ }
  };

  const handleBackup = async () => {
    setLoading('backup');
    const result = await window.api.backupDatabase();
    setLoading('');
    if (result.success) {
      showResult('success', 'Backup Complete', 'Your database backup has been saved successfully.', result.path);
    } else {
      showResult('info', 'Backup Cancelled', 'No backup file was created.');
    }
  };

  const handleRestore = async () => {
    setShowRestoreConfirm(false);
    setLoading('restore');
    const result = await window.api.restoreDatabase();
    setLoading('');
    if (result.success) {
      showResult('success', 'Restore Complete', 'Database restored successfully! The app will reload now.');
    } else if (result.message) {
      showResult('error', 'Restore Failed', result.message);
    }
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    setLoading('reset');
    const result = await window.api.resetDatabase();
    setLoading('');
    if (result.success) {
      showResult('success', 'Reset Complete', 'Database has been reset. All data cleared. The app will reload now.');
    } else if (result.message) {
      showResult('error', 'Reset Failed', result.message);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>Settings — <span className="urdu">ترتیبات</span></h2></div>

      <div style={{ display: 'grid', gap: 18, maxWidth: 700 }}>
        {/* Theme */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Theme — <span className="urdu">تھیم</span></h3>
          <div className="flex gap-3">
            <button className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { if (theme !== 'dark') toggleTheme(); }}><MdDarkMode /> Dark</button>
            <button className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { if (theme !== 'light') toggleTheme(); }}><MdLightMode /> Light</button>
          </div>
        </div>

        {/* Database Info */}
        {dbInfo && (
          <div className="card">
            <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><MdStorage /> Database Info — <span className="urdu">ڈیٹا بیس معلومات</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Total Records</div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {Object.values(dbInfo.counts).reduce((a, b) => a + b, 0)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Last Modified</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {new Date(dbInfo.lastModified).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <span style={{ marginRight: 16 }}>👤 Buyers: <strong>{dbInfo.counts.buyers}</strong></span>
              <span style={{ marginRight: 16 }}>🏪 Suppliers: <strong>{dbInfo.counts.suppliers}</strong></span>
              <span style={{ marginRight: 16 }}>📦 Products: <strong>{dbInfo.counts.products}</strong></span>
              <br/>
              <span style={{ marginRight: 16 }}>📤 Sales: <strong>{dbInfo.counts.sales}</strong></span>
              <span style={{ marginRight: 16 }}>📥 Purchases: <strong>{dbInfo.counts.purchases}</strong></span>
              <span style={{ marginRight: 16 }}>💰 Payments: <strong>{dbInfo.counts.payments}</strong></span>
            </div>
            {/* Path intentionally hidden from UI */}
          </div>
        )}

        {/* Backup Database */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Backup Database — <span className="urdu">بیک اپ</span></h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
            Export a copy of your database to a safe location. You can use this backup to restore your data later.
            <br/><span className="urdu" style={{ fontSize: '0.8rem' }}>اپنے ڈیٹا بیس کی کاپی محفوظ جگہ پر بنائیں۔</span>
          </p>
          <button className="btn btn-success" onClick={handleBackup} disabled={!!loading}>
            <MdBackup /> {loading === 'backup' ? 'Creating...' : 'Create Backup'}
          </button>
        </div>

        {/* Restore Database */}
        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <h3 style={{ marginBottom: 14 }}>Restore Database — <span className="urdu">بیک اپ بحال کریں</span></h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
            Import a previously backed-up database file. This will <strong>replace</strong> your current data with the backup data. The app will reload after restore.
            <br/><span className="urdu" style={{ fontSize: '0.8rem' }}>پہلے سے بنائی گئی بیک اپ فائل سے ڈیٹا بحال کریں۔ موجودہ ڈیٹا بدل جائے گا۔</span>
          </p>
          <button className="btn btn-primary" onClick={() => setShowRestoreConfirm(true)} disabled={!!loading}>
            <MdRestore /> {loading === 'restore' ? 'Restoring...' : 'Restore from Backup'}
          </button>
        </div>

        {/* Reset Database — Danger Zone */}
        <div className="card" style={{ borderLeft: '3px solid #ef4444' }}>
          <h3 style={{ marginBottom: 14, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdWarning /> Danger Zone — <span className="urdu">خطرناک</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
            Reset the database to start fresh. This will <strong style={{ color: '#ef4444' }}>permanently delete ALL data</strong> including buyers, suppliers, products, sales, purchases, and payments.
            <br/><span className="urdu" style={{ fontSize: '0.8rem' }}>ڈیٹا بیس ری سیٹ کریں۔ تمام ڈیٹا مستقل طور پر حذف ہو جائے گا۔</span>
          </p>
          <button className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={() => setShowResetConfirm(true)} disabled={!!loading}>
            <MdDeleteForever /> {loading === 'reset' ? 'Resetting...' : 'Reset Database'}
          </button>
        </div>

        {/* About */}
        <div className="card" style={{ textAlign: 'center' }}>
          <img src={logo} alt="Rana Traders" style={{ width: 100, margin: '0 auto 16px', display: 'block', borderRadius: 12 }} />
          <h3 style={{ marginBottom: 14 }}><MdInfo style={{ verticalAlign: 'middle' }} /> About</h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <p><strong>App:</strong> رانا ٹریڈرز — Rana Traders</p>
            <p><strong>Version:</strong> 1.0.0</p>

          </div>
        </div>

        {/* About Developer */}
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{
            marginBottom: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: "'Poppins', sans-serif", fontSize: '1.15rem', fontWeight: 700,
            letterSpacing: '0.02em',
          }}>
            👨‍💻 About Developer
          </h3>
          <p className="urdu" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 18 }}>ڈویلپر</p>

          {/* Developer Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {/* Team Leader */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(59,130,246,0.08))',
              border: '1px solid rgba(16,185,129,0.22)',
              borderRadius: 14,
              padding: '20px 14px 16px',
            }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em',
                color: '#10b981', marginBottom: 10,
                fontFamily: "'Poppins', sans-serif",
              }}>Team Leader</div>
              <div style={{
                fontSize: '1.05rem', fontWeight: 700, marginBottom: 10,
                fontFamily: "'Poppins', sans-serif",
                color: 'var(--text-primary)',
                lineHeight: 1.8,
              }}>Wajid Raza <span className="urdu" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>(واجد رضا)</span></div>
              <div style={{
                fontSize: '0.8rem', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span style={{ fontSize: '1rem' }}>📱</span> <span>0301-6314479</span>
              </div>
            </div>

            {/* Senior Developer & Designer */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(168,85,247,0.08))',
              border: '1px solid rgba(99,102,241,0.22)',
              borderRadius: 14,
              padding: '20px 14px 16px',
            }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em',
                color: '#8b5cf6', marginBottom: 10,
                fontFamily: "'Poppins', sans-serif",
              }}>Senior Developer & Designer</div>
              <div style={{
                fontSize: '1.05rem', fontWeight: 700, marginBottom: 10,
                fontFamily: "'Poppins', sans-serif",
                color: 'var(--text-primary)',
                lineHeight: 1.8,
              }}>Aqsam Husnain <span className="urdu" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>(اقسم حسنین)</span></div>
              <div style={{
                fontSize: '0.8rem', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span style={{ fontSize: '1rem' }}>📱</span> <span>0303-6487829</span>
              </div>
            </div>
          </div>

          {/* Location */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: '0.82rem', color: 'var(--text-muted)',
            fontFamily: "'Poppins', sans-serif", fontWeight: 500,
            padding: '10px 0 4px',
            borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '1rem' }}>📍</span> Karor Lal-Esan, District Layyah
          </div>
        </div>
      </div>

      {/* ── Restore Confirmation Modal ── */}
      <Modal show={showRestoreConfirm} onClose={() => setShowRestoreConfirm(false)} title="Confirm Restore">
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--accent-glow)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', margin: '0 auto 16px'
          }}>
            <MdRestore />
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            Are you sure you want to restore the database?
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            This will <strong style={{ color: 'var(--accent)' }}>replace all current data</strong> with the backup file. The app will reload after restore.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowRestoreConfirm(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleRestore}>
            <MdRestore /> Restore
          </button>
        </div>
      </Modal>

      {/* ── Reset Confirmation Modal ── */}
      <Modal show={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Confirm Reset">
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--red-glow)', color: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', margin: '0 auto 16px'
          }}>
            <MdWarningAmber />
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            Are you sure you want to reset the database?
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            This will <strong style={{ color: 'var(--red)' }}>permanently delete ALL data</strong> including buyers, suppliers, products, sales, purchases, and payments.
          </p>
          <p className="urdu" style={{ fontSize: '0.8rem', color: 'var(--red)', opacity: 0.8 }}>
            تمام ڈیٹا مستقل طور پر حذف ہو جائے گا۔ یہ عمل واپس نہیں ہو سکتا۔
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleReset}>
            <MdDeleteForever /> Reset Database
          </button>
        </div>
      </Modal>

      {/* ── Result/Feedback Modal ── */}
      <Modal show={resultModal.show} onClose={closeResult} title={resultModal.title}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: resultModal.type === 'success' ? 'var(--green-glow)'
              : resultModal.type === 'error' ? 'var(--red-glow)'
              : 'var(--accent-glow)',
            color: resultModal.type === 'success' ? 'var(--green)'
              : resultModal.type === 'error' ? 'var(--red)'
              : 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', margin: '0 auto 16px'
          }}>
            {resultModal.type === 'success' ? <MdCheckCircle />
              : resultModal.type === 'error' ? <MdError />
              : <MdInfo />}
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            {resultModal.message}
          </p>
          {resultModal.detail && (
            <p style={{
              fontSize: '0.78rem', color: 'var(--text-muted)',
              background: 'var(--bg-input)', padding: '8px 12px',
              borderRadius: 8, marginTop: 10, wordBreak: 'break-all'
            }}>
              {resultModal.detail}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={closeResult}>OK</button>
        </div>
      </Modal>
    </div>
  );
}
