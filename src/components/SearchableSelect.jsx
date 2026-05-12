import React, { useState, useRef, useEffect } from 'react';
import { MdSearch, MdClose, MdKeyboardArrowDown } from 'react-icons/md';

/**
 * SearchableSelect – a searchable dropdown that matches native <select> styling.
 */
export default function SearchableSelect({ options = [], value, onChange, placeholder = 'Select...', required, id }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedOption = options.find(o => String(o.value) === String(value));

  // Search against label + searchText (which can include urdu name)
  const filtered = search.trim()
    ? options.filter(o => {
        const q = search.toLowerCase();
        if (o.label.toLowerCase().includes(q)) return true;
        if (o.searchText && o.searchText.toLowerCase().includes(q)) return true;
        // Also search urdu directly
        if (o.labelUrdu && o.labelUrdu.includes(search)) return true;
        return false;
      })
    : options;

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setHighlightIdx(0); }, [filtered.length, search]);

  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightIdx];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx, open]);

  const openDropdown = () => {
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const selectOption = (opt) => {
    onChange(String(opt.value));
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIdx]) selectOption(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  };

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 2,
          padding: '0 1px',
          fontWeight: 600,
        }}>{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // Styles matching native .form-group input / .form-group select
  const baseInput = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    minHeight: 42,
    boxSizing: 'border-box',
  };

  return (
    <div ref={wrapperRef} id={id} style={{ position: 'relative' }}>
      {!open ? (
        /* ── Closed: looks like a native select ── */
        <div
          onClick={openDropdown}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); } }}
          style={{
            ...baseInput,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'var(--border)'; }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-glow)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? (
              <>{selectedOption.label}{selectedOption.labelUrdu ? <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontFamily: "'Noto Nastaliq Urdu', serif", direction: 'rtl', fontSize: '0.82rem' }}>{selectedOption.labelUrdu}</span> : ''}</>
            ) : placeholder}
          </span>
          <MdKeyboardArrowDown style={{ fontSize: '1.2rem', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }} />
        </div>
      ) : (
        /* ── Open: search input ── */
        <div style={{ position: 'relative' }}>
          <MdSearch style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: '1rem', color: 'var(--accent)', pointerEvents: 'none', zIndex: 1,
          }} />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={{
              ...baseInput,
              paddingLeft: 34,
              paddingRight: 32,
              borderColor: 'var(--accent)',
              boxShadow: '0 0 0 3px var(--accent-glow)',
              borderRadius: filtered.length > 0 ? '10px 10px 0 0' : 10,
              cursor: 'text',
            }}
          />
          {(search || value) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); setOpen(false); }}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex',
                alignItems: 'center', fontSize: '1rem', zIndex: 1,
              }}
              title="Clear"
            >
              <MdClose />
            </button>
          )}
        </div>
      )}

      {/* ── Dropdown list ── */}
      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 999,
            maxHeight: 200,
            overflowY: 'auto',
            background: 'var(--bg-input)',
            border: '1px solid var(--accent)',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{
              padding: '12px 14px',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              textAlign: 'center',
              fontStyle: 'italic',
            }}>
              No match found
            </div>
          ) : (
            filtered.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = i === highlightIdx;
              return (
                <div
                  key={opt.value}
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  style={{
                    padding: '9px 14px',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 700 : 400,
                    background: isHighlighted ? 'var(--accent-glow)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <span>{highlightMatch(opt.label, search)}</span>
                  {opt.labelUrdu && <span style={{ float: 'right', fontFamily: "'Noto Nastaliq Urdu', serif", direction: 'rtl', fontSize: '0.82rem', color: isSelected ? 'var(--accent)' : 'var(--text-muted)', opacity: 0.85 }}>{opt.labelUrdu}</span>}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Hidden required input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={value || ''}
          onChange={() => {}}
          tabIndex={-1}
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
