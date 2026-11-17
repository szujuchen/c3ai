const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Finds "Final Exam ... December 15 ... 10:00 AM" in syllabus text. Returns null when there is no exam date.
// Defaults: year 2026, 9:00 AM. This is the part to replace with a PDF reader or an LLM later.
export function parseExam(text) {
  const re = /(final|midterm)[^\n]{0,80}?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?([^\n]{0,30})/i;
  const m = text.match(re);
  if (!m) return null;
  const mon = MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase())) + 1;
  const year = m[4] || '2026';
  const t = (m[5] || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  let hh = 9, mm = '00';
  if (t) { hh = (Number(t[1]) % 12) + (t[3].toLowerCase() === 'pm' ? 12 : 0); mm = t[2] || '00'; }
  return {
    type: m[1].toLowerCase(),
    date: `${year}-${String(mon).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`,
    time: `${String(hh).padStart(2, '0')}:${mm}`,
    quote: m[0].trim(),
  };
}
