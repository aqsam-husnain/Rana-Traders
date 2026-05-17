import React, { useState, useEffect } from 'react';
import { formatNumber, formatPKR, todayISO } from '../utils/formatters';
import { exportToPDF, exportToXLSX, exportToCSV, fileTimestamp } from '../utils/exportReport';
import ExportDropdown from '../components/ExportDropdown';
import { useToast } from '../components/Toast';
import { MdSearch, MdAdd, MdClose } from 'react-icons/md';
import { blockInvalidChars, preventScrollChange } from '../utils/inputHelpers';
import { useShortcuts } from '../context/ShortcutContext';

/**
 * Default conversion units (name → kg value).
 * Users can also add custom units via the + button.
 */
const DEFAULT_CONVERSIONS = [
  { name: 'KG',   kg: 1 },
  { name: 'Mann', kg: 40 },
  { name: 'Bori', kg: 100 },
];

/**
 * Convert a total KG value into a given unit, returning
 * whole units + remainder in KG (no decimals).
 * E.g. 1675 KG with Mann (40kg) → { whole: 41, remainderKg: 35 }
 */
function convertStock(totalKg, unitKg) {
  if (!unitKg || unitKg <= 0) return { whole: totalKg, remainderKg: 0 };
  if (unitKg === 1) return { whole: totalKg, remainderKg: 0 };
  const absKg = Math.abs(totalKg);
  const sign = totalKg < 0 ? -1 : 1;
  const whole = Math.floor(absKg / unitKg);
  const remainderKg = Math.round((absKg - whole * unitKg) * 100) / 100;
  return { whole: sign * whole, remainderKg: sign >= 0 ? remainderKg : -remainderKg };
}

export default function StockOverview() {
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState('');
  // Global selected unit — applies to ALL products
  const [selectedUnit, setSelectedUnit] = useState(DEFAULT_CONVERSIONS[0]); // KG by default
  // Custom unit form
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customKg, setCustomKg] = useState('');
  // Extra conversion units added by user (per session)
  const [extraUnits, setExtraUnits] = useState([]);

  const toast = useToast();
  const { registerPageHandlers, unregisterPageHandlers } = useShortcuts();

  useEffect(() => {
    window.api.getStockOverview().then(setStock);
  }, []);

  // Register keyboard shortcuts for this page
  useEffect(() => {
    registerPageHandlers({
      'page.exportPdf': () => handleExport('pdf'),
    });
    return () => unregisterPageHandlers();
  }, [stock]);

  const allConversions = [...DEFAULT_CONVERSIONS, ...extraUnits];

  // Filter products by search
  const filtered = stock.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.name_urdu || '').includes(search)
  );

  const handleAddCustomUnit = () => {
    const name = customName.trim();
    const kg = parseFloat(customKg);
    if (!name) return toast.error('Unit name is required — اکائی کا نام ضروری ہے');
    if (!kg || kg <= 0) return toast.error('KG value must be greater than 0 — کلوگرام کی مقدار ضروری ہے');
    if (allConversions.find(u => u.name.toLowerCase() === name.toLowerCase())) {
      return toast.error(`"${name}" already exists — یہ اکائی پہلے سے موجود ہے`);
    }
    const newUnit = { name, kg };
    setExtraUnits(prev => [...prev, newUnit]);
    setSelectedUnit(newUnit); // auto-select the new unit
    setCustomName('');
    setCustomKg('');
    setShowCustomUnit(false);
    toast.success(`Unit "${name}" (${kg} KG) added — اکائی شامل ہو گئی`);
  };

  const formatStockForExport = (availableStockKg) => {
    if (!selectedUnit || selectedUnit.name === 'KG') {
      return `${formatNumber(availableStockKg)} KG`;
    }
    const { whole, remainderKg } = convertStock(availableStockKg, selectedUnit.kg);
    let result = `${formatNumber(whole)} ${selectedUnit.name}`;
    if (remainderKg !== 0) result += ` ${formatNumber(remainderKg)} KG`;
    return result;
  };

  const handleExport = async (format) => {
    if (filtered.length === 0) return;
    const unitLabel = selectedUnit && selectedUnit.name !== 'KG' ? ` (${selectedUnit.name})` : '';
    const columns = ['#', 'Product / جنس', 'Unit', 'Opening Stock', 'Total Purchased', 'Total Sold', `Available Stock${unitLabel}`];
    const rows = filtered.map((s, i) => [i + 1, s.name + (s.name_urdu ? '\n' + s.name_urdu : ''), s.unit, formatNumber(s.opening_stock || 0), formatNumber(s.total_purchased), formatNumber(s.total_sold), formatStockForExport(s.available_stock)]);
    const summary = [{ label: 'Total Products / کل اجناس', value: String(filtered.length) }, { label: 'Total Available Stock / دستیاب اسٹاک', value: formatNumber(filtered.reduce((s, r) => s + (r.available_stock || 0), 0)) + ' KG' }];
    const titleSuffix = search ? ` — "${search}"` : '';
    const exportData = { title: `Stock Overview — اسٹاک رپورٹ${titleSuffix}`, columns, rows, summary, dateRange: '' };
    let saved = false; const ts = fileTimestamp();
    if (format === 'pdf') saved = await exportToPDF({ ...exportData, fileName: `Stock_Overview_${ts}.pdf` });
    else if (format === 'xlsx') saved = await exportToXLSX({ ...exportData, fileName: `Stock_Overview_${ts}.xlsx` });
    else if (format === 'csv') saved = await exportToCSV({ ...exportData, fileName: `Stock_Overview_${ts}.csv` });
    if (saved) toast.success('File exported successfully!');
  };

  const renderConvertedStock = (availableStockKg) => {
    if (!selectedUnit || selectedUnit.name === 'KG') {
      return <span style={{ fontWeight: 700 }}>{formatNumber(availableStockKg)} KG</span>;
    }
    const { whole, remainderKg } = convertStock(availableStockKg, selectedUnit.kg);
    return (
      <span style={{ fontWeight: 700 }}>
        {formatNumber(whole)} {selectedUnit.name}
        {remainderKg !== 0 && (
          <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.82rem' }}>
            {formatNumber(remainderKg)} KG
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Stock Overview — <span className="urdu">اسٹاک</span></h2>
        <ExportDropdown onExport={handleExport} disabled={filtered.length === 0} />
      </div>

      {/* ── Search + Unit Conversion Filter Bar ── */}
      <div className="stock-filter-bar">
        <div className="stock-filter-search">
          <MdSearch />
          <input
            placeholder="Search product... — جنس تلاش کریں"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="stock-filter-units">
          <span className="stock-filter-label">Convert Unit — اکائی تبدیل</span>
          <div className="stock-unit-btns">
            {allConversions.map(u => (
              <button
                key={u.name}
                type="button"
                className={`stock-unit-btn ${selectedUnit?.name === u.name ? 'active' : ''}`}
                onClick={() => setSelectedUnit(u)}
                title={u.kg === 1 ? 'Kilogram' : `1 ${u.name} = ${u.kg} KG`}
              >
                {u.name}
                {u.kg > 1 && <span className="stock-unit-hint">{u.kg}kg</span>}
              </button>
            ))}
            <button
              type="button"
              className="stock-unit-btn stock-unit-add"
              onClick={() => setShowCustomUnit(!showCustomUnit)}
              title="Add custom unit — حسب ضرورت اکائی شامل کریں"
            >
              <MdAdd />
            </button>
          </div>
        </div>
      </div>

      {/* Custom unit inline form */}
      {showCustomUnit && (
        <div className="stock-custom-unit-bar">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>New Unit:</span>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder="Unit name, e.g. Ton"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddCustomUnit(); }
              if (e.key === 'Escape') { setShowCustomUnit(false); setCustomName(''); setCustomKg(''); }
            }}
            style={{ flex: 1, minWidth: 80 }}
          />
          <input
            type="number"
            value={customKg}
            onChange={e => setCustomKg(e.target.value)}
            placeholder="= ? KG"
            onKeyDown={e => {
              blockInvalidChars(e);
              if (e.key === 'Enter') { e.preventDefault(); handleAddCustomUnit(); }
              if (e.key === 'Escape') { setShowCustomUnit(false); setCustomName(''); setCustomKg(''); }
            }}
            onWheel={preventScrollChange}
            style={{ width: 90, minWidth: 0 }}
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={handleAddCustomUnit} style={{ minWidth: 34, height: 36 }}><MdAdd /></button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setShowCustomUnit(false); setCustomName(''); setCustomKg(''); }} style={{ minWidth: 34, height: 36 }}><MdClose /></button>
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Product</th><th>Unit</th><th>Opening Stock</th><th>Total Purchased</th><th>Total Sold</th><th>Available Stock</th></tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{s.name} {s.name_urdu ? <span className="urdu" style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({s.name_urdu})</span> : ''}</td>
                <td>{s.unit}</td>
                <td className="amount">{formatNumber(s.opening_stock || 0)} {s.unit}</td>
                <td className="amount">{formatNumber(s.total_purchased)}</td>
                <td className="amount">{formatNumber(s.total_sold)}</td>
                <td className={`amount ${s.available_stock > 0 ? 'positive' : s.available_stock < 0 ? 'negative' : ''}`} style={{ fontWeight: 700 }}>
                  {renderConvertedStock(s.available_stock)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>{search ? 'No matching products — کوئی جنس نہیں ملی' : 'No products in stock'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
