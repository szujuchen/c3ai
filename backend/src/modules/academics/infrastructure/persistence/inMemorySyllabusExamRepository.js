// Exam dates students added from syllabi. Shared by everyone in the course. Held in memory.
export function createInMemorySyllabusExamRepository(initial = []) {
  const exams = [...initial];
  return {
    list: () => [...exams],
    add: (exam) => { exams.push(exam); return exam; },
  };
}
