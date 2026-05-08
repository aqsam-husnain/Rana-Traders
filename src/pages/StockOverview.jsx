import React, { useState, useEffect } from 'react';
import { formatNumber, formatPKR, todayISO } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';

export default function StockOverview() {
  const [stock, setStock] = useState([]);
  useEffect(() => { window.api.getStockOverview().then(setStock); }, []);

  const handleExport = (format) => {
    if (stock.length === 0) return;
    const columns = ['#', 'Product / جنس', 'Unit', 'Opening Stock', 'Total Purchased', 'Total Sold', 'Available Stock'];
    const rows = stock.map((s, i) => [i + 1, s.name + (s.name_urdu ? '\n' + s.name_urdu : ''), s.unit, formatNumber(s.opening_stock || 0), formatNumber(s.total_purchased), formatNumber(s.total_sold), formatNumber(s.available_stock)]);
    const summary = [{ label: 'Total Products / کل اجناس', value: String(stock.length) }, { label: 'Total Available Stock / دستیاب اسٹاک', value: formatNumber(stock.reduce((s, r) => s + (r.available_stock || 0), 0)) }];
    const exportData = { title: 'Stock Overview — اسٹاک رپورٹ', columns, rows, summary, dateRange: '' };
    if (format === 'pdf') exportToPDF({ ...exportData, fileName: `Stock_Overview_${todayISO()}.pdf` });
    else if (format === 'xlsx') exportToXLSX({ ...exportData, fileName: `Stock_Overview_${todayISO()}.xlsx` });
    else if (format === 'csv') exportToCSV({ ...exportData, fileName: `Stock_Overview_${todayISO()}.csv` });
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Stock Overview — <span className="urdu">اسٹاک</span></h2>
        <ExportDropdown onExport={handleExport} disabled={stock.length === 0} />
      </div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Product</th><th>Unit</th><th>Opening Stock</th><th>Total Purchased</th><th>Total Sold</th><th>Available Stock</th></tr></thead>
          <tbody>
            {stock.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{s.name} {s.name_urdu ? <span className="urdu" style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({s.name_urdu})</span> : ''}</td>
                <td>{s.unit}</td>
                <td className="amount">{formatNumber(s.opening_stock || 0)} {s.unit}</td>
                <td className="amount">{formatNumber(s.total_purchased)}</td>
                <td className="amount">{formatNumber(s.total_sold)}</td>
                <td className={`amount ${s.available_stock > 0 ? 'positive' : s.available_stock < 0 ? 'negative' : ''}`} style={{ fontWeight: 700 }}>{formatNumber(s.available_stock)} {s.unit}</td>
              </tr>
            ))}
            {stock.length === 0 && <tr><td colSpan={7} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>No products in stock</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
