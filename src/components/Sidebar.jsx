import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MdDashboard, MdPeople, MdStore, MdInventory, MdPointOfSale, MdShoppingCart, MdMenuBook, MdPercent, MdBarChart, MdSettings, MdLogout, MdWarningAmber, MdAccountBalanceWallet } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import logo from '../assets/logo.png';

const menuSections = [
  { title: 'Main', items: [
    { path: '/dashboard', icon: MdDashboard, label: 'Dashboard', urdu: 'ڈیش بورڈ' },
  ]},
  { title: 'Parties', items: [
    { path: '/buyers', icon: MdPeople, label: 'Buyers', urdu: 'خریدار' },
    { path: '/suppliers', icon: MdStore, label: 'Suppliers', urdu: 'سپلائرز' },
  ]},
  { title: 'Inventory', items: [
    { path: '/products', icon: MdInventory, label: 'Products', urdu: 'اجناس' },
    { path: '/stock', icon: MdInventory, label: 'Stock Overview', urdu: 'اسٹاک' },
  ]},
  { title: 'Transactions', items: [
    { path: '/sales', icon: MdPointOfSale, label: 'Sales', urdu: 'فروخت' },
    { path: '/purchases', icon: MdShoppingCart, label: 'Purchases', urdu: 'خریداری' },
  ]},
  { title: 'Ledger', items: [
    { path: '/daybook', icon: MdMenuBook, label: 'Day Book', urdu: 'روزنامچہ' },
    { path: '/expenses', icon: MdAccountBalanceWallet, label: 'Expenses', urdu: 'روزانہ خرچہ' },
  ]},
  { title: 'Commission', items: [
    { path: '/commission', icon: MdPercent, label: 'Commission', urdu: 'آڑت' },
  ]},
  { title: 'Analytics', items: [
    { path: '/reports', icon: MdBarChart, label: 'Reports', urdu: 'رپورٹس' },
  ]},
  { title: 'System', items: [
    { path: '/settings', icon: MdSettings, label: 'Settings', urdu: 'ترتیبات' },
  ]},
];

export default function Sidebar() {
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => setShowLogoutConfirm(true);
  const handleLogoutCancel = () => setShowLogoutConfirm(false);
  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logo} alt="Rana Traders" className="sidebar-logo" />
        <div className="sidebar-brand-text">
          <h1 className="urdu">رانا ٹریڈرز</h1>
          <p>Rana Traders</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {menuSections.map(section => (
          <div className="sidebar-section" key={section.title}>
            <div className="sidebar-section-title">{section.title}</div>
            {section.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <item.icon />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={handleLogoutClick} style={{ width: '100%', border: 'none', background: 'none' }}>
          <MdLogout />
          <span>Logout</span>
        </button>
      </div>

      {/* Logout Confirmation Dialog */}
      <Modal show={showLogoutConfirm} onClose={handleLogoutCancel} title="Confirm Logout">
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
            Are you sure you want to logout?
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            You will need to sign in again to access the system.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleLogoutCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={handleLogoutConfirm}>
            <MdLogout /> Logout
          </button>
        </div>
      </Modal>
    </aside>
  );
}
