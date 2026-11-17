const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Day keys are 'YYYY-MM-DD' strings.
export const dow = (k) => new Date(k + 'T00:00:00Z').getUTCDay();
export const fmt = (k) => `${DOW[dow(k)]}, ${MONTHS[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8))}`;
export const short = (k) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8))}`;
export const dayOfMonth = (k) => Number(k.slice(8));

// '2026-12-04T10:00:00-05:00' -> '10 AM'. Reads the wall-clock time in the string; no timezone conversion.
export const time = (iso) => {
  const h = Number(iso.slice(11, 13)), m = iso.slice(14, 16);
  return `${((h + 11) % 12) + 1}${m === '00' ? '' : ':' + m} ${h < 12 ? 'AM' : 'PM'}`;
};

export const addDays = (k, n) => {
  const d = new Date(k + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
