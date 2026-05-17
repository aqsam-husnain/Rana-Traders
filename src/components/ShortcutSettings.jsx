import React, { useState, useRef, useEffect } from 'react';
import { useShortcuts, ALL_ACTIONS, eventToCombo, formatCombo } from '../context/ShortcutContext';
import { MdKeyboard, MdRestartAlt, MdEdit, MdCheck, MdClose, MdWarning } from 'react-icons/md';

/**
 * Shortcut customization UI — used inside Settings page.
 * Lets users rebind every shortcut key.
 */
export default function ShortcutSettings() {
  const { getBinding, customBindings, defaultBindings, saveBindings, resetAllBindings } = useShortcuts();
  const [editingAction, setEditingAction] = useState(null);
  const [recordedCombo, setRecordedCombo] = useState('');
  const [conflict, setConflict] = useState(null);
  const recorderRef = useRef(null);

  // Group actions by category
  const categories = {};
  ALL_ACTIONS.forEach(a => {
    if (!categories[a.category]) categories[a.category] = [];
    categories[a.category].push(a);
  });

  // Start recording mode
  const startEditing = (actionId) => {
    setEditingAction(actionId);
    setRecordedCombo('');
    setConflict(null);
    setTimeout(() => recorderRef.current?.focus(), 50);
  };

  // Check for conflicts
  const checkConflict = (combo, currentActionId) => {
    if (!combo) return null;
    for (const action of ALL_ACTIONS) {
      if (action.id === currentActionId) continue;
      const existing = customBindings[action.id] || defaultBindings[action.id];
      if (existing === combo) {
        // Only conflict if same scope
        const currentMeta = ALL_ACTIONS.find(a => a.id === currentActionId);
        if (currentMeta?.scope === action.scope || action.scope === 'global' || currentMeta?.scope === 'global') {
          return action;
        }
      }
    }
    return null;
  };

  const handleRecordKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setEditingAction(null);
      setRecordedCombo('');
      setConflict(null);
      return;
    }
    const combo = eventToCombo(e);
    if (!combo) return;
    setRecordedCombo(combo);
    const conflictAction = checkConflict(combo, editingAction);
    setConflict(conflictAction);
  };

  const saveBinding = () => {
    if (!recordedCombo || !editingAction) return;
    const newBindings = { ...customBindings, [editingAction]: recordedCombo };
    saveBindings(newBindings);
    setEditingAction(null);
    setRecordedCombo('');
    setConflict(null);
  };

  const resetBinding = (actionId) => {
    const newBindings = { ...customBindings };
    delete newBindings[actionId];
    saveBindings(newBindings);
  };

  const handleResetAll = () => {
    if (confirm('Reset all keyboard shortcuts to defaults?\nتمام شارٹ کٹ کیز ڈیفالٹ پر سیٹ کریں؟')) {
      resetAllBindings();
    }
  };

  const categoryIcons = {
    'Navigation': '🔵',
    'App': '🟢',
    'Page': '🟡',
    'Day Book': '📒',
    'Form': '🔴',
  };

  return (
    <div className="shortcut-settings">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MdKeyboard style={{ fontSize: '1.3rem', color: 'var(--accent)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Keyboard Shortcuts — <span className="urdu">شارٹ کٹ کیز</span></h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Click any key binding to customize — Press <kbd className="cmd-kbd-inline">Ctrl + K</kbd> to open Command Palette
            </p>
          </div>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={handleResetAll} title="Reset all shortcuts to defaults">
          <MdRestartAlt /> Reset All
        </button>
      </div>

      {Object.entries(categories).map(([cat, actions]) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
            color: 'var(--text-muted)', padding: '8px 0 6px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{categoryIcons[cat] || '⚡'}</span> {cat}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {actions.map(action => {
              const currentCombo = getBinding(action.id);
              const isCustomized = !!customBindings[action.id];
              const isEditing = editingAction === action.id;

              return (
                <div key={action.id} className={`shortcut-row ${isEditing ? 'editing' : ''}`}>
                  <div className="shortcut-row-label">
                    <span className="shortcut-row-icon">{action.icon}</span>
                    <span className="shortcut-row-name">{action.label}</span>
                  </div>
                  <div className="shortcut-row-key">
                    {isEditing ? (
                      <div className="shortcut-recorder">
                        <input
                          ref={recorderRef}
                          className="shortcut-recorder-input"
                          value={recordedCombo ? formatCombo(recordedCombo) : ''}
                          placeholder="Press keys..."
                          readOnly
                          onKeyDown={handleRecordKey}
                        />
                        {conflict && (
                          <span className="shortcut-conflict">
                            <MdWarning /> Conflicts with "{conflict.label}"
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={saveBinding}
                            disabled={!recordedCombo || !!conflict}
                            style={{ padding: '4px 10px', minWidth: 28 }}
                          >
                            <MdCheck />
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => { setEditingAction(null); setRecordedCombo(''); setConflict(null); }}
                            style={{ padding: '4px 10px', minWidth: 28 }}
                          >
                            <MdClose />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <kbd
                          className={`cmd-kbd shortcut-key-btn ${isCustomized ? 'customized' : ''}`}
                          onClick={() => startEditing(action.id)}
                          title="Click to change shortcut"
                        >
                          {currentCombo ? formatCombo(currentCombo) : '—'}
                        </kbd>
                        <button
                          className="shortcut-edit-btn"
                          onClick={() => startEditing(action.id)}
                          title="Edit shortcut"
                        >
                          <MdEdit />
                        </button>
                        {isCustomized && (
                          <button
                            className="shortcut-reset-btn"
                            onClick={() => resetBinding(action.id)}
                            title="Reset to default"
                          >
                            <MdRestartAlt />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
