import React, { useState, useEffect } from 'react';
import { MdPeople, MdStore, MdPointOfSale, MdShoppingCart, MdAccountBalanceWallet, MdCallReceived, MdInventory } from 'react-icons/md';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await window.api.getDashboardStats();
      setStats(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;

  const cards = [
    { label: 'Active Buyers', urdu: 'فعال خریدار', value: stats?.activeBuyers || 0, icon: MdPeople, color: 'indigo' },
    { label: 'Active Suppliers', urdu: 'فعال سپلائرز', value: stats?.activeSuppliers || 0, icon: MdStore, color: 'blue' },
    { label: "Today's Sale", urdu: 'آج کی فروخت', value: formatPKR(stats?.todaySale), icon: MdPointOfSale, color: 'green' },
    { label: "Today's Purchase", urdu: 'آج کی خریداری', value: formatPKR(stats?.todayPurchase), icon: MdShoppingCart, color: 'amber' },
    { label: 'Total Payable', urdu: 'کل واجب الادا', value: formatPKR(stats?.totalPayable), icon: MdAccountBalanceWallet, color: 'red' },
    { label: 'Total Receivable', urdu: 'کل وصولی', value: formatPKR(stats?.totalReceivable), icon: MdCallReceived, color: 'green' },
    { label: 'Total Stock', urdu: 'کل اسٹاک', value: formatNumber(stats?.totalStock), icon: MdInventory, color: 'blue' },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Dashboard — <span className="urdu">ڈیش بورڈ</span></h2>
      </div>

      <div className="stats-grid">
        {cards.map((c, i) => (
          <div className="stat-card" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
            <div className={`stat-icon ${c.color}`}><c.icon /></div>
            <div className="stat-info">
              <h3>{c.label}</h3>
              <div className="stat-value">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 600 }}>Recent Transactions — <span className="urdu">حالیہ لین دین</span></h3>
        {stats?.recentTransactions?.length > 0 ? (
          <div className="data-table-wrapper" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Party</th>
                  <th>Product</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTransactions.map((t, i) => (
                  <tr key={i}>
                    <td><span className={`badge ${t.type === 'Sale' ? 'badge-active' : 'badge-walkin'}`}>{t.type}</span></td>
                    <td>{formatDate(t.date)}</td>
                    <td>{t.party_name || '—'}{t.party_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.party_name_urdu}</span></> : ''}</td>
                    <td>{t.product_name || '—'}{t.product_name_urdu ? <><br/><span className="urdu" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.product_name_urdu}</span></> : ''}</td>
                    <td className="text-right amount">{formatPKR(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><p>No transactions yet — ابھی تک کوئی لین دین نہیں</p></div>
        )}
      </div>
    </div>
  );
}
