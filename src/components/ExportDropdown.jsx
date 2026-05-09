import React, { useState, useEffect, useRef } from 'react';
import { MdFileDownload, MdPictureAsPdf, MdTableChart, MdTextSnippet, MdExpandMore, MdCheckBox, MdCheckBoxOutlineBlank, MdClose } from 'react-icons/md';

export default function ExportDropdown({ onExport, disabled, columns, defaultHidden = ['Rate'] }) {
  const [open, setOpen] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [pendingFormat, setPendingFormat] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState(defaultHidden);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleFormatClick = (format) => {
    setOpen(false);
    if (columns && columns.length > 0) {
      setPendingFormat(format);
      setShowColumnSelector(true);
    } else {
      // No columns provided — export directly (backward compatible)
      onExport(format);
    }
  };

  const toggleColumn = (col) => {
    setHiddenColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const confirmExport = () => {
    setShowColumnSelector(false);
    onExport(pendingFormat, hiddenColumns);
    setPendingFormat(null);
  };

  const cancelExport = () => {
    setShowColumnSelector(false);
    setPendingFormat(null);
  };

  const formatLabels = { pdf: 'PDF', xlsx: 'Excel', csv: 'CSV' };

  return (
    <>
      <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
        <button className="btn btn-success" onClick={() => setOpen(!open)} disabled={disabled} style={{ gap: 6 }}>
          <MdFileDownload /> Export <MdExpandMore style={{ marginLeft: 2 }} />
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: 'var(--shadow-lg)', minWidth: 180, overflow: 'hidden',
            animation: 'scaleIn 0.15s ease'
          }}>
            <button className="export-menu-item" onClick={() => handleFormatClick('pdf')}>
              <MdPictureAsPdf style={{ color: 'var(--red)', fontSize: '1.1rem' }} /> Export as PDF
            </button>
            <button className="export-menu-item" onClick={() => handleFormatClick('xlsx')}>
              <MdTableChart style={{ color: 'var(--green)', fontSize: '1.1rem' }} /> Export as Excel
            </button>
            <button className="export-menu-item" onClick={() => handleFormatClick('csv')}>
              <MdTextSnippet style={{ color: 'var(--blue)', fontSize: '1.1rem' }} /> Export as CSV
            </button>
          </div>
        )}
      </div>

      {/* Column Selector Modal */}
      {showColumnSelector && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, animation: 'fadeIn 0.15s ease'
        }} onClick={cancelExport}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 0, minWidth: 340, maxWidth: 420,
            boxShadow: 'var(--shadow-lg)', animation: 'scaleIn 0.2s ease'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  Select Columns — <span className="urdu">کالم منتخب کریں</span>
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Exporting as <strong style={{ color: 'var(--accent)' }}>{formatLabels[pendingFormat]}</strong> — Unchecked columns will show "—"
                </p>
              </div>
              <button onClick={cancelExport} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '1.2rem', padding: 4, borderRadius: 8,
                display: 'flex', alignItems: 'center'
              }}>
                <MdClose />
              </button>
            </div>

            {/* Column Checkboxes */}
            <div style={{ padding: '12px 20px', maxHeight: 320, overflowY: 'auto' }}>
              {columns.map(col => {
                const isChecked = !hiddenColumns.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => toggleColumn(col)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '10px 12px', marginBottom: 4,
                      background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer', color: 'var(--text)',
                      fontSize: '0.85rem', fontWeight: 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isChecked
                      ? <MdCheckBox style={{ color: 'var(--accent)', fontSize: '1.2rem', flexShrink: 0 }} />
                      : <MdCheckBoxOutlineBlank style={{ color: 'var(--text-muted)', fontSize: '1.2rem', flexShrink: 0 }} />
                    }
                    <span>{col}</span>
                    {!isChecked && (
                      <span style={{
                        marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)',
                        background: 'var(--glass)', padding: '2px 8px', borderRadius: 6
                      }}>shows "—"</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 8, justifyContent: 'flex-end',
              padding: '12px 20px', borderTop: '1px solid var(--border)'
            }}>
              <button className="btn btn-secondary" onClick={cancelExport} style={{ fontSize: '0.82rem' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmExport} style={{ fontSize: '0.82rem' }}>
                <MdFileDownload style={{ marginRight: 4 }} /> Export {formatLabels[pendingFormat]}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
