// Who can do what. Enforced by the API on every request, not just hidden in the UI.
//   student  their own calendar, workload, exams and registrations
//   host     campus-wide aggregates and mock events; never an individual student
//   admin    everything
export const ROLES = ['student', 'host', 'admin'];

export const VIEWS = { student: ['student'], host: ['host'], admin: ['student', 'host'] };
