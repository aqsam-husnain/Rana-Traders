import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useShortcuts, ALL_ACTIONS, formatCombo } from '../context/ShortcutContext';

/**
 * Command Palette — Ctrl+K searchable overlay.
 * Lists all available actions, lets user search and execute.
 */
export default function CommandPalette() {
  const { paletteOpen, setPaletteOpen, getBinding, executeAction, helpOpen, setHelpOpen } = useShortcuts();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset state when opened
  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  // Filter actions by search query
  const filteredActions = useMemo(() => {
    if (!query.trim()) return ALL_ACTIONS;
    const q = query.toLowerCase();
    return ALL_ACTIONS.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.urdu.includes(query) ||
      a.category.toLowerCase().includes(q) ||
      (getBinding(a.id) || '').toLowerCase().includes(q)
    );
  }, [query, getBinding]);

  // Clamp selection
  useEffect(() => {
    if (selectedIndex >= filteredActions.length) {
      setSelectedIndex(Math.max(0, filteredActions.length - 1));
    }
  }, [filteredActions, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredActions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = filteredActions[selectedIndex];
      if (action) {
        setPaletteOpen(false);
        setTimeout(() => executeAction(action.id), 50);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPaletteOpen(false);
    }
  };

  // ── Shortcut Help / Cheat Sheet ──
  if (helpOpen) {
    const categories = {};
    ALL_ACTIONS.forEach(a => {
      if (!categories[a.category]) categories[a.category] = [];
      categories[a.category].push(a);
    });

    return createPortal(
      <div className="cmd-palette-overlay" onClick={() => setHelpOpen(false)}>
        <div className="cmd-palette cmd-palette-help" onClick={e => e.stopPropagation()}>
          <div className="cmd-palette-header">
            <div className="cmd-palette-title">
              <span style={{ fontSize: '1.2rem' }}>⌨️</span>
              <span>Keyboard Shortcuts — <span className="urdu">شارٹ کٹ کیز</span></span>
            </div>
            <button className="cmd-palette-close" onClick={() => setHelpOpen(false)}>✕</button>
          </div>
          <div className="cmd-palette-help-body">
            {Object.entries(categories).map(([cat, actions]) => (
              <div key={cat} className="cmd-help-category">
                <div className="cmd-help-category-title">{cat}</div>
                <div className="cmd-help-grid">
                  {actions.map(a => {
                    const combo = getBinding(a.id);
                    return (
                      <div key={a.id} className="cmd-help-row">
                        <span className="cmd-help-label">
                          <span className="cmd-help-icon">{a.icon}</span>
                          {a.label}
                        </span>
                        <kbd className="cmd-kbd">{combo ? formatCombo(combo) : '—'}</kbd>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="cmd-palette-footer">
            Press <kbd className="cmd-kbd-inline">Ctrl + /</kbd> to toggle this help
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!paletteOpen) return null;

  return createPortal(
    <div className="cmd-palette-overlay" onClick={() => setPaletteOpen(false)}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div className="cmd-palette-search">
          <span className="cmd-palette-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command... — کمانڈ ٹائپ کریں"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            className="cmd-palette-input"
            autoComplete="off"
          />
          <kbd className="cmd-kbd-esc">ESC</kbd>
        </div>

        {/* Actions List */}
        <div className="cmd-palette-list" ref={listRef}>
          {filteredActions.length === 0 ? (
            <div className="cmd-palette-empty">
              No commands found — <span className="urdu">کوئی کمانڈ نہیں ملی</span>
            </div>
          ) : (
            filteredActions.map((action, i) => {
              const combo = getBinding(action.id);
              return (
                <div
                  key={action.id}
                  className={`cmd-palette-item ${i === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    setPaletteOpen(false);
                    setTimeout(() => executeAction(action.id), 50);
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className="cmd-palette-item-icon">{action.icon}</span>
                  <span className="cmd-palette-item-label">
                    {action.label}
                    <span className="cmd-palette-item-category">{action.category}</span>
                  </span>
                  {combo && <kbd className="cmd-kbd">{formatCombo(combo)}</kbd>}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="cmd-palette-footer">
          <span><kbd className="cmd-kbd-inline">↑↓</kbd> Navigate</span>
          <span><kbd className="cmd-kbd-inline">Enter</kbd> Execute</span>
          <span><kbd className="cmd-kbd-inline">Esc</kbd> Close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
