import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';

// ── Default key bindings ──────────────────────────────────────────
const DEFAULT_BINDINGS = {
  // Global Navigation
  'nav.dashboard':    'Alt+1',
  'nav.buyers':       'Alt+2',
  'nav.suppliers':    'Alt+3',
  'nav.products':     'Alt+4',
  'nav.stock':        'Alt+5',
  'nav.sales':        'Alt+6',
  'nav.purchases':    'Alt+7',
  'nav.daybook':      'Alt+8',
  'nav.expenses':     'Alt+9',
  'nav.commission':   'Alt+0',
  'nav.reports':      'Alt+R',
  'nav.settings':     'Alt+S',
  // Global App
  'app.palette':      'Ctrl+K',
  'app.shortcuts':    'Ctrl+/',
  'app.theme':        'Ctrl+Shift+T',
  'app.backup':       'Ctrl+Shift+B',
  'app.search':       'Ctrl+F',
  'app.logout':       'Ctrl+Shift+Q',
  // Page-Specific (context-dependent)
  'page.new':         'Ctrl+N',
  'page.exportPdf':   'Ctrl+P',
  'page.exportXlsx':  'Ctrl+E',
  'page.search':      'Ctrl+F',
  'page.manage':      'Ctrl+M',
  'page.generate':    'Ctrl+G',
  'page.tab1':        'Ctrl+1',
  'page.tab2':        'Ctrl+2',
  // DayBook-specific
  'daybook.prevDay':  'Alt+Left',
  'daybook.nextDay':  'Alt+Right',
  'daybook.today':    'Ctrl+D',
  'daybook.tabToggle':'Ctrl+`',
  // Modal/Form
  'modal.save':       'Ctrl+Enter',
  'modal.fullAmount': 'Ctrl+Shift+F',
};

// Navigation route map
const NAV_ROUTES = {
  'nav.dashboard':  '/dashboard',
  'nav.buyers':     '/buyers',
  'nav.suppliers':  '/suppliers',
  'nav.products':   '/products',
  'nav.stock':      '/stock',
  'nav.sales':      '/sales',
  'nav.purchases':  '/purchases',
  'nav.daybook':    '/daybook',
  'nav.expenses':   '/expenses',
  'nav.commission': '/commission',
  'nav.reports':    '/reports',
  'nav.settings':   '/settings',
};

// All action metadata (for the command palette + settings UI)
export const ALL_ACTIONS = [
  // Navigation
  { id: 'nav.dashboard',    label: 'Go to Dashboard',       urdu: 'ڈیش بورڈ',       icon: '📊', category: 'Navigation', scope: 'global' },
  { id: 'nav.buyers',       label: 'Go to Buyers',          urdu: 'خریدار',          icon: '👥', category: 'Navigation', scope: 'global' },
  { id: 'nav.suppliers',    label: 'Go to Suppliers',       urdu: 'سپلائرز',         icon: '🏪', category: 'Navigation', scope: 'global' },
  { id: 'nav.products',     label: 'Go to Products',        urdu: 'اجناس',           icon: '📦', category: 'Navigation', scope: 'global' },
  { id: 'nav.stock',        label: 'Go to Stock Overview',  urdu: 'اسٹاک',           icon: '📦', category: 'Navigation', scope: 'global' },
  { id: 'nav.sales',        label: 'Go to Sales',           urdu: 'فروخت',           icon: '💰', category: 'Navigation', scope: 'global' },
  { id: 'nav.purchases',    label: 'Go to Purchases',       urdu: 'خریداری',         icon: '🛒', category: 'Navigation', scope: 'global' },
  { id: 'nav.daybook',      label: 'Go to Day Book',        urdu: 'روزنامچہ',        icon: '📒', category: 'Navigation', scope: 'global' },
  { id: 'nav.expenses',     label: 'Go to Expenses',        urdu: 'خرچہ',            icon: '💸', category: 'Navigation', scope: 'global' },
  { id: 'nav.commission',   label: 'Go to Commission',      urdu: 'آڑت',             icon: '%',  category: 'Navigation', scope: 'global' },
  { id: 'nav.reports',      label: 'Go to Reports',         urdu: 'رپورٹس',          icon: '📈', category: 'Navigation', scope: 'global' },
  { id: 'nav.settings',     label: 'Go to Settings',        urdu: 'ترتیبات',         icon: '⚙️', category: 'Navigation', scope: 'global' },
  // Global App
  { id: 'app.palette',      label: 'Open Command Palette',  urdu: 'کمانڈ پیلٹ',      icon: '🔍', category: 'App',        scope: 'global' },
  { id: 'app.shortcuts',    label: 'Show Shortcut Help',    urdu: 'شارٹ کٹ',         icon: '⌨️', category: 'App',        scope: 'global' },
  { id: 'app.theme',        label: 'Toggle Theme',          urdu: 'تھیم تبدیل',      icon: '🌓', category: 'App',        scope: 'global' },
  { id: 'app.backup',       label: 'Backup Database',       urdu: 'بیک اپ',          icon: '💾', category: 'App',        scope: 'global' },
  { id: 'app.search',       label: 'Focus Search',          urdu: 'تلاش',            icon: '🔎', category: 'App',        scope: 'global' },
  { id: 'app.logout',       label: 'Logout',                urdu: 'لاگ آؤٹ',         icon: '🚪', category: 'App',        scope: 'global' },
  // Page-Specific
  { id: 'page.new',         label: 'New / Add Item',        urdu: 'نیا شامل کریں',   icon: '➕', category: 'Page',       scope: 'page' },
  { id: 'page.exportPdf',   label: 'Export to PDF',         urdu: 'پی ڈی ایف',       icon: '📄', category: 'Page',       scope: 'page' },
  { id: 'page.exportXlsx',  label: 'Export to Excel',       urdu: 'ایکسل',           icon: '📊', category: 'Page',       scope: 'page' },
  { id: 'page.search',      label: 'Focus Page Search',     urdu: 'صفحہ تلاش',       icon: '🔎', category: 'Page',       scope: 'page' },
  { id: 'page.manage',      label: 'Manage / Categories',   urdu: 'زمرے',            icon: '🏷️', category: 'Page',       scope: 'page' },
  { id: 'page.generate',    label: 'Generate Report',       urdu: 'رپورٹ بنائیں',    icon: '▶️', category: 'Page',       scope: 'page' },
  { id: 'page.tab1',        label: 'Switch to Tab 1',       urdu: 'ٹیب 1',           icon: '1️⃣', category: 'Page',       scope: 'page' },
  { id: 'page.tab2',        label: 'Switch to Tab 2',       urdu: 'ٹیب 2',           icon: '2️⃣', category: 'Page',       scope: 'page' },
  // DayBook
  { id: 'daybook.prevDay',  label: 'Previous Day',          urdu: 'پچھلا دن',        icon: '⬅️', category: 'Day Book',   scope: 'page' },
  { id: 'daybook.nextDay',  label: 'Next Day',              urdu: 'اگلا دن',         icon: '➡️', category: 'Day Book',   scope: 'page' },
  { id: 'daybook.today',    label: 'Go to Today',           urdu: 'آج',              icon: '📅', category: 'Day Book',   scope: 'page' },
  { id: 'daybook.tabToggle',label: 'Toggle Roznamcha/Rokar',urdu: 'ٹیب تبدیل',       icon: '🔄', category: 'Day Book',   scope: 'page' },
  // Modal
  { id: 'modal.save',       label: 'Save / Submit Form',    urdu: 'محفوظ کریں',      icon: '✅', category: 'Form',       scope: 'modal' },
  { id: 'modal.fullAmount', label: 'Fill Full Amount',      urdu: 'پوری رقم',        icon: '💯', category: 'Form',       scope: 'modal' },
];

// ── Helpers ───────────────────────────────────────────────────────

/** Convert a KeyboardEvent to a normalized key combo string */
export function eventToCombo(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  // Normalize special keys
  if (key === ' ') key = 'Space';
  if (key === 'ArrowLeft') key = 'Left';
  if (key === 'ArrowRight') key = 'Right';
  if (key === 'ArrowUp') key = 'Up';
  if (key === 'ArrowDown') key = 'Down';
  if (key === 'Escape') key = 'Escape';
  if (key === 'Enter') key = 'Enter';
  if (key === 'Tab') key = 'Tab';
  if (key === '/') key = '/';

  // Don't add modifier-only combos
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return '';

  // Capitalize single letters
  if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join('+');
}

/** Format a combo for display */
export function formatCombo(combo) {
  if (!combo) return '';
  return combo
    .replace(/Ctrl/g, 'Ctrl')
    .replace(/Alt/g, 'Alt')
    .replace(/Shift/g, 'Shift')
    .replace(/\+/g, ' + ');
}

/** Format with keyboard symbols */
export function formatComboShort(combo) {
  if (!combo) return '';
  return combo
    .replace('Ctrl+', '⌃')
    .replace('Alt+', '⌥')
    .replace('Shift+', '⇧');
}

// ── Context ──────────────────────────────────────────────────────

const ShortcutContext = createContext(null);

export function useShortcuts() {
  const ctx = useContext(ShortcutContext);
  if (!ctx) throw new Error('useShortcuts must be used within ShortcutProvider');
  return ctx;
}

export function ShortcutProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleTheme } = useTheme();

  // Custom bindings (overrides stored in SQLite)
  const [customBindings, setCustomBindings] = useState({});
  // Command palette visibility
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Shortcut help visibility
  const [helpOpen, setHelpOpen] = useState(false);

  // Page-specific action handlers registered by each page
  const pageHandlersRef = useRef({});
  // Modal-specific handlers
  const modalHandlersRef = useRef({});

  // ── Load custom bindings from SQLite on mount ──
  useEffect(() => {
    const loadBindings = async () => {
      try {
        const saved = await window.api.getSetting('keyboard_shortcuts');
        if (saved) {
          setCustomBindings(typeof saved === 'string' ? JSON.parse(saved) : saved);
        }
      } catch (e) { /* no saved bindings — use defaults */ }
    };
    loadBindings();
  }, []);

  // ── Resolve binding: custom overrides default ──
  const getBinding = useCallback((actionId) => {
    return customBindings[actionId] || DEFAULT_BINDINGS[actionId] || '';
  }, [customBindings]);

  // ── Build reverse map: combo → actionId ──
  const comboMapRef = useRef({});
  useEffect(() => {
    const map = {};
    for (const actionId of Object.keys(DEFAULT_BINDINGS)) {
      const combo = customBindings[actionId] || DEFAULT_BINDINGS[actionId];
      if (combo) {
        if (!map[combo]) map[combo] = [];
        map[combo].push(actionId);
      }
    }
    comboMapRef.current = map;
  }, [customBindings]);

  // ── Register page-specific handlers ──
  const registerPageHandlers = useCallback((handlers) => {
    pageHandlersRef.current = handlers;
  }, []);

  const unregisterPageHandlers = useCallback(() => {
    pageHandlersRef.current = {};
  }, []);

  // ── Register modal-specific handlers ──
  const registerModalHandlers = useCallback((handlers) => {
    modalHandlersRef.current = handlers;
  }, []);

  const unregisterModalHandlers = useCallback(() => {
    modalHandlersRef.current = {};
  }, []);

  // ── Execute an action by ID ──
  const executeAction = useCallback((actionId) => {
    // Navigation
    if (NAV_ROUTES[actionId]) {
      navigate(NAV_ROUTES[actionId]);
      return true;
    }
    // App actions
    if (actionId === 'app.palette') { setPaletteOpen(true); return true; }
    if (actionId === 'app.shortcuts') { setHelpOpen(p => !p); return true; }
    if (actionId === 'app.theme') { toggleTheme(); return true; }
    if (actionId === 'app.backup') {
      window.api.backupDatabase().then(r => {
        if (r.success) alert('Backup saved: ' + r.path);
      });
      return true;
    }
    if (actionId === 'app.search' || actionId === 'page.search') {
      // Try to find a search input on the current page
      const searchInput = document.querySelector('.search-bar input, .stock-filter-search input');
      if (searchInput) { searchInput.focus(); return true; }
      return false;
    }
    // Page-specific
    const pageH = pageHandlersRef.current[actionId];
    if (pageH) { pageH(); return true; }
    // Modal-specific
    const modalH = modalHandlersRef.current[actionId];
    if (modalH) { modalH(); return true; }

    return false;
  }, [navigate, toggleTheme]);

  // ── Global keydown handler ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't fire shortcuts on the login page — no layout means no navigation targets
      if (!document.querySelector('.app-layout')) return;

      // Don't intercept if user is in a text input (unless it's a Ctrl/Alt combo)
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const hasModifier = e.ctrlKey || e.altKey || e.metaKey;

      // Allow Escape always
      if (e.key === 'Escape') {
        if (paletteOpen) { setPaletteOpen(false); e.preventDefault(); return; }
        if (helpOpen) { setHelpOpen(false); e.preventDefault(); return; }
        return; // Let Modal's own Escape handler work
      }

      // In text inputs, only intercept if modifier is pressed
      if (inInput && !hasModifier) return;

      const combo = eventToCombo(e);
      if (!combo) return;

      const actionIds = comboMapRef.current[combo] || [];
      if (actionIds.length === 0) return;

      // Check if a modal is open
      const modalOpen = !!document.querySelector('.modal-overlay');

      for (const actionId of actionIds) {
        const actionMeta = ALL_ACTIONS.find(a => a.id === actionId);
        if (!actionMeta) continue;

        // Scope filtering
        if (actionMeta.scope === 'modal' && !modalOpen) continue;
        if (actionMeta.scope === 'page' && modalOpen) continue;

        // Check if modal handler exists
        if (actionMeta.scope === 'modal') {
          const handler = modalHandlersRef.current[actionId];
          if (handler) {
            e.preventDefault();
            e.stopPropagation();
            handler();
            return;
          }
          continue;
        }

        // Check if page handler exists
        if (actionMeta.scope === 'page') {
          const handler = pageHandlersRef.current[actionId];
          if (handler) {
            e.preventDefault();
            e.stopPropagation();
            handler();
            return;
          }
          continue;
        }

        // Global scope — always execute
        if (actionMeta.scope === 'global') {
          e.preventDefault();
          e.stopPropagation();
          executeAction(actionId);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [customBindings, paletteOpen, helpOpen, executeAction]);

  // ── Save custom bindings ──
  const saveBindings = useCallback(async (newBindings) => {
    setCustomBindings(newBindings);
    try {
      await window.api.setSetting('keyboard_shortcuts', JSON.stringify(newBindings));
    } catch (e) { console.error('Failed to save shortcuts:', e); }
  }, []);

  const resetAllBindings = useCallback(async () => {
    setCustomBindings({});
    try {
      await window.api.setSetting('keyboard_shortcuts', '{}');
    } catch (e) { console.error('Failed to reset shortcuts:', e); }
  }, []);

  const value = {
    // Bindings
    getBinding,
    customBindings,
    defaultBindings: DEFAULT_BINDINGS,
    saveBindings,
    resetAllBindings,
    // Registration
    registerPageHandlers,
    unregisterPageHandlers,
    registerModalHandlers,
    unregisterModalHandlers,
    // Palette
    paletteOpen,
    setPaletteOpen,
    // Help
    helpOpen,
    setHelpOpen,
    // Execute
    executeAction,
  };

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
}
