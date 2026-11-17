// How available is an audience in each 2-hour slot of a day, and how many would turn up to an optional event?
// Per student and slot we estimate the chance they are free:
//   - a class, an event or an exam covering the slot: not free
//   - otherwise a baseline chance of being busy with things we cannot see, higher on weekend mornings
//   - then deadline pressure that day: up to half their free time gone when about 10 hours of work is due
//   - after finals end (break): busy 85% of the time
export const SLOTS = [8, 10, 12, 14, 16, 18, 20].map((h) => ({ startHour: h, endHour: h + 2, startMin: h * 60, endMin: (h + 2) * 60 }));

const BASE_BUSY = [0.35, 0.30, 0.35, 0.30, 0.30, 0.25, 0.30];
const WEEKEND_MORNING_EXTRA = [0.30, 0.20];
const BREAK_BUSY = 0.85;
const MIN_OVERLAP_MIN = 30;
const FULL_PRESSURE_HOURS = 10;
const MAX_PRESSURE = 0.5;
// Share of the free students who show up to a typical optional event, by slot: from 5% at 8-10 AM to 30% at 6-8 PM.
const ATTEND = [0.05, 0.10, 0.15, 0.15, 0.20, 0.30, 0.25];
const WEEKEND_ATTEND = 0.85;

export const isWeekend = (date) => [0, 6].includes(new Date(date + 'T00:00:00Z').getUTCDay());

const overlap = (a, b) => Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin);

// `blocks` are the student's classes, events and exams that day (startMin / endMin).
export function freeChance({ slotIndex, date, blocks, loadHours, afterFinals }) {
  if (afterFinals) return 1 - BREAK_BUSY;
  if (blocks.some((b) => overlap(b, SLOTS[slotIndex]) >= MIN_OVERLAP_MIN)) return 0;
  const busy = Math.min(0.95, BASE_BUSY[slotIndex] + (isWeekend(date) ? WEEKEND_MORNING_EXTRA[slotIndex] ?? 0 : 0));
  const pressure = MAX_PRESSURE * Math.min(1, loadHours / FULL_PRESSURE_HOURS);
  return (1 - busy) * (1 - pressure);
}

// `perStudent` is one array of 7 free chances per student.
export function slotSummary(perStudent, slotIndex, date) {
  const free = perStudent.map((chances) => chances[slotIndex]);
  const expectedFree = free.reduce((a, b) => a + b, 0);
  const availability = free.length ? Math.round((expectedFree / free.length) * 100) : 0;
  const turnout = Math.round(expectedFree * ATTEND[slotIndex] * (isWeekend(date) ? WEEKEND_ATTEND : 1) * 10) / 10;
  return { startHour: SLOTS[slotIndex].startHour, endHour: SLOTS[slotIndex].endHour, availability, turnout };
}
