// Client-only state for the host view. Mock events live here and nowhere else: they are never sent to be stored.
export const hostState = {
  kind: 'everyone',   // 'everyone' | 'major' | 'year' | 'course'
  audience: 'all',    // "all", "major:CS", "year:3" or "course:101"
  from: null,
  to: null,
  hostType: 'recruiting',
  mocks: [],          // [{ type, date }]
  pinned: null,       // "2026-12-10|18" : a day and the start hour of a slot
  mode: '2d',         // '2d' hour-by-hour slots, or '3d' month of columns
  metric: 'fit',      // 3D: 'fit' (how well a day suits the event) or 'workload' (campus stress)
  rotation: 30,       // 3D: degrees, 20 to 60
  day: null,          // 3D: the selected day
  animate: false,     // 3D: play the rise animation on the next draw
  focus: null,        // a selector to focus after the next draw
};
