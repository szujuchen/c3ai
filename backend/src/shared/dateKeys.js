// Day keys are 'YYYY-MM-DD' strings in UTC. All date math in the domain goes through here.
export const dayKey = (d) => d.toISOString().slice(0, 10);

export const addDays = (key, n) => {
  const x = new Date(key + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return dayKey(x);
};

export const monthKeys = (from, days) => {
  const out = [];
  for (let i = 0; i < days; i++) out.push(addDays(from, i));
  return out;
};

export const round1 = (x) => Math.round(x * 10) / 10;

export const isDayKey = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && dayKey(d) === s;
};
