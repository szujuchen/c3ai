// The logged-in session ({ token, role, studentId, views }). Kept in sessionStorage so a reload stays logged in,
// and in memory for when storage is unavailable.
const KEY = 'crunch-calendar-session';
let current = null;

export function getSession() {
  if (current) return current;
  try { current = JSON.parse(sessionStorage.getItem(KEY)); } catch { current = null; }
  return current;
}

export function setSession(session) {
  current = session;
  try { sessionStorage.setItem(KEY, JSON.stringify(session)); } catch { /* storage may be blocked; memory still works */ }
}

export function clearSession() {
  current = null;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
