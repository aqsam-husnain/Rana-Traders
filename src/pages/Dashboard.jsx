import React, { useState, useEffect } from 'react';
import { MdPeople, MdStore, MdPointOfSale, MdShoppingCart, MdAccountBalanceWallet, MdCallReceived, MdInventory } from 'react-icons/md';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters';

const UNIT_OPTIONS = [
  { name: 'KG',   kg: 1 },
  { name: 'Mann', kg: 40 },
  { name: 'Bori', kg: 100 },
];

function convertStock(totalKg, unitKg) {
  if (!unitKg || unitKg <= 0 || unitKg === 1) return { whole: totalKg, remainderKg: 0 };
  const absKg = Math.abs(totalKg);
  const sign = totalKg < 0 ? -1 : 1;
  const whole = Math.floor(absKg / unitKg);
  const remainderKg = Math.round((absKg - whole * unitKg) * 100) / 100;
  return { whole: sign * whole, remainderKg: sign >= 0 ? remainderKg : -remainderKg };
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState([]);
  const [stockUnit, setStockUnit] = useState(UNIT_OPTIONS[1]); // Mann by default

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [data, stockRows] = await Promise.all([
        window.api.getDashboardStats(),
        window.api.getStockOverview()
      ]);
      setStats(data);
      setStockData(stockRows);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;

  const renderStockValue = (availableStockKg) => {
    if (stockUnit.name === 'KG') {
      return <>{formatNumber(availableStockKg)}<span className="dashboard-stock-item-unit">KG</span></>;
    }
    const { whole, remainderKg } = convertStock(availableStockKg, stockUnit.kg);
    return (
      <>
        {formatNumber(whole)}
        <span className="dashboard-stock-item-unit">{stockUnit.name}</span>
        {remainderKg !== 0 && (
          <span className="dashboard-stock-remainder">{formatNumber(remainderKg)}<span className="dashboard-stock-item-unit">KG</span></span>
        )}
      </>
    );
  };

  const cards = [
    { label: 'Active Buyers', urdu: 'فعال خریدار', value: stats?.activeBuyers || 0, icon: MdPeople, color: 'indigo' },
    { label: 'Active Suppliers', urdu: 'فعال سپلائرز', value: stats?.activeSuppliers || 0, icon: MdStore, color: 'blue' },
    { label: "Today's Sale", urdu: 'آج کی فروخت', value: formatPKR(stats?.todaySale), icon: MdPointOfSale, color: 'green' },
    { label: "Today's Purchase", urdu: 'آج کی خریداری', value: formatPKR(stats?.todayPurchase), icon: MdShoppingCart, color: 'amber' },
    { label: 'Total Payable', urdu: 'کل واجب الادا', value: formatPKR(stats?.totalPayable), icon: MdAccountBalanceWallet, color: 'red' },
    { label: 'Total Receivable', urdu: 'کل وصولی', value: formatPKR(stats?.totalReceivable), icon: MdCallReceived, color: 'green' },
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

      {/* ── Quick Stock Overview ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="dashboard-stock-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <MdInventory style={{ color: 'var(--accent)', fontSize: '1.15rem' }} />
            Product Stock — <span className="urdu">اجناس اسٹاک</span>
          </h3>
          <div className="stock-unit-btns">
            {UNIT_OPTIONS.map(u => (
              <button
                key={u.name}
                type="button"
                className={`stock-unit-btn ${stockUnit.name === u.name ? 'active' : ''}`}
                onClick={() => setStockUnit(u)}
                title={u.kg === 1 ? 'Kilogram' : `1 ${u.name} = ${u.kg} KG`}
              >
                {u.name}
                {u.kg > 1 && <span className="stock-unit-hint">{u.kg}kg</span>}
              </button>
            ))}
          </div>
        </div>
        {stockData.length > 0 ? (
          <div className="dashboard-stock-grid">
            {stockData.map((p, i) => {
              const isNegative = p.available_stock < 0;
              const isZero = p.available_stock === 0;
              return (
                <div
                  key={p.id}
                  className={`dashboard-stock-item ${isNegative ? 'stock-negative' : isZero ? 'stock-zero' : 'stock-positive'}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="dashboard-stock-item-name">
                    {p.name}
                    {p.name_urdu && <span className="urdu" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>({p.name_urdu})</span>}
                  </div>
                  <div className="dashboard-stock-item-value">
                    {renderStockValue(p.available_stock)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No products added yet — ابھی تک کوئی جنس شامل نہیں
          </div>
        )}
      </div>

      {/* ── Recent Transactions ── */}
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
