// Client-only state for the student view: what the student has connected and what they are looking at.
// `pending` holds exam dates being reviewed before they are added for the class.
export const studentState = {
  studentId: 's1',
  canvas: false,
  view: 'month',      // 'day' | 'week' | 'month'
  selectedDay: null,
  done: {},
  pending: {},
  imported: {},       // studentId -> true once their real Canvas data was imported
  tokenForm: false,   // the paste-a-token form is open
  filter: 'all',      // events sidebar filter
  openEventId: null,  // the event whose details are open
};
