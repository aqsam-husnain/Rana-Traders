export function formatPKR(amount) {
  if (amount == null || isNaN(amount)) return 'PKR 0';
  return 'PKR ' + Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * For dashboard stat cards: if |amount| >= 1 Crore (10,000,000),
 * returns { compact: 'PKR 89.91M', exact: 'PKR 89,910,000,000', isLarge: true }
 * Otherwise returns { compact: formatPKR(amount), exact: null, isLarge: false }
 */
export function formatCompact(amount) {
  if (amount == null || isNaN(amount)) return { compact: 'PKR 0', exact: null, isLarge: false };
  const abs = Math.abs(Number(amount));
  const sign = Number(amount) < 0 ? '-' : '';
  const exact = formatPKR(amount);
  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    return { compact: `${sign}PKR ${val}B`, exact, isLarge: true };
  }
  if (abs >= 10_000_000) { // 1 Crore
    const val = (abs / 1_000_000).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    return { compact: `${sign}PKR ${val}M`, exact, isLarge: true };
  }
  return { compact: exact, exact: null, isLarge: false };
}

export function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-PK', { maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  // Always use only the date portion (strip any time component)
  const datePart = typeof dateStr === 'string' ? dateStr.split('T')[0].split(' ')[0] : dateStr;
  const d = new Date(datePart + 'T00:00:00');
  if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Returns date-only string YYYY-MM-DD (for date filter comparisons)
 */
export function todayDateOnly() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Returns current date+time as YYYY-MM-DDTHH:MM for datetime-local inputs
 */
export function todayISO() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
