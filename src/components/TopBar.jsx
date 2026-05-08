import React from 'react';
import { useLocation } from 'react-router-dom';
import { MdLightMode, MdDarkMode } from 'react-icons/md';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

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

  const title = pageTitles[location.pathname] || 'Rana Traders';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2>{title}</h2>
      </div>
      <div className="topbar-right">
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
