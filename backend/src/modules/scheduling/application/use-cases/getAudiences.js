// What a host can target, and how many students are in each group. Counts only, never names.
export function getAudiences({ academics }) {
  const students = academics.students();
  const count = (pick) => students.filter(pick).length;
  const uniq = (xs) => [...new Set(xs)];
  return {
    total: students.length,
    majors: uniq(students.map((s) => s.major)).map((major) => ({ major, count: count((s) => s.major === major) })),
    years: uniq(students.map((s) => s.year)).sort().map((year) => ({ year, count: count((s) => s.year === year) })),
    courses: academics.courses().map((c) => ({ id: c.id, code: c.course_code, name: c.name, count: count((s) => s.course_ids.includes(c.id)) })).filter((c) => c.count > 0),
  };
}
