import React, { useState, useEffect, useRef } from 'react';
import { MdFileDownload, MdPictureAsPdf, MdTableChart, MdTextSnippet, MdExpandMore } from 'react-icons/md';

export default function ExportDropdown({ onExport, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
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
          <button className="export-menu-item" onClick={() => { onExport('pdf'); setOpen(false); }}>
            <MdPictureAsPdf style={{ color: 'var(--red)', fontSize: '1.1rem' }} /> Export as PDF
          </button>
          <button className="export-menu-item" onClick={() => { onExport('xlsx'); setOpen(false); }}>
            <MdTableChart style={{ color: 'var(--green)', fontSize: '1.1rem' }} /> Export as Excel
          </button>
          <button className="export-menu-item" onClick={() => { onExport('csv'); setOpen(false); }}>
            <MdTextSnippet style={{ color: 'var(--blue)', fontSize: '1.1rem' }} /> Export as CSV
          </button>
        </div>
      )}
    </div>
  );
}
