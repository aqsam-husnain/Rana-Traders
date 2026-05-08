export function formatPKR(amount) {
  if (amount == null || isNaN(amount)) return 'PKR 0';
  return 'PKR ' + Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-PK', { maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  // Check if the value has a time component (not midnight or date-only)
  const hasTime = dateStr.includes('T') || dateStr.includes(' ');
  const dateOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  if (hasTime) {
    return d.toLocaleDateString('en-GB', dateOptions) + ', ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return d.toLocaleDateString('en-GB', dateOptions);
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
