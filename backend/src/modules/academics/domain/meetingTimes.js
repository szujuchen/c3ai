const DAYS = { U: 0, M: 1, T: 2, W: 3, R: 4, F: 5, S: 6 }; // R is Thursday, as on campus schedules

// "MWF 10:00-10:50" -> a weekly meeting on Mon, Wed and Fri, in minutes from midnight (24-hour clock).
// Returns [] for anything that is not in that form (e.g. courses imported from Canvas, which has no meeting times).
export function parseMeetingTimes(text) {
  const m = /^\s*([MTWRFSU]+)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(text || '');
  if (!m) return [];
  const startMin = Number(m[2]) * 60 + Number(m[3]);
  const endMin = Number(m[4]) * 60 + Number(m[5]);
  if (endMin <= startMin) return [];
  return [...m[1]].map((ch) => ({ dow: DAYS[ch], startMin, endMin }));
}
