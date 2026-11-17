export const TAG = { recruiting: 'Recruiting', relax: 'Relax', general: 'Social' };

// The backend decides how an event fits the student (`note`); this only words it.
export function renderNote(note) {
  if (!note) return '';
  if (note.type === 'recommended-break') return '<span class="note good">Recommended break</span>';
  if (note.type === 'heavy-day') return `<span class="note bad">Heavy day for you (${note.hours} h)</span>`;
  return '<span class="note warn">Pushes you over your cap</span>';
}
