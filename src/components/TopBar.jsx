import React from 'react';
import { useLocation } from 'react-router-dom';
import { MdLightMode, MdDarkMode, MdKeyboard } from 'react-icons/md';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useShortcuts } from '../context/ShortcutContext';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/buyers': 'Buyers — خریدار',
  '/suppliers': 'Suppliers — سپلائرز',
  '/products': 'Products — اجناس',
  '/stock': 'Stock Overview — اسٹاک',
  '/sales': 'Sales — فروخت',
  '/purchases': 'Purchases — خریداری',
  '/payments': 'Payments — ادائیگی',
  '/ledger': 'Khata / Ledger — کھاتا',
  '/daybook': 'Day Book — روزنامچہ',
  '/commission': 'Commission — آڑت',
  '/reports': 'Reports — رپورٹس',
  '/settings': 'Settings — ترتیبات',
};

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const { setPaletteOpen, setHelpOpen } = useShortcuts();

  const title = pageTitles[location.pathname] || 'Rana Traders';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2>{title}</h2>
      </div>
      <div className="topbar-right">
        <div className="topbar-shortcut-hint" onClick={() => setPaletteOpen(true)} title="Command Palette (Ctrl+K)">
          🔍 <span>Search commands</span> <kbd>Ctrl+K</kbd>
        </div>
        <button className="topbar-btn" onClick={() => setHelpOpen(true)} title="Keyboard Shortcuts (Ctrl+/)">
          <MdKeyboard />
        </button>
        <button className="topbar-btn" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <MdLightMode /> : <MdDarkMode />}
        </button>
        <div className="user-badge">
          <div className="user-avatar">{user?.name?.charAt(0) || 'A'}</div>
          <span>{user?.name || 'User'}</span>
        </div>
      </div>
    </header>
  );
}
