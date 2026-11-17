// Which campus events each student registered for in the app. Held in memory.
export function createInMemoryRegistrationRepository(initial = {}) {
  const byStudent = new Map(Object.entries(initial).map(([id, events]) => [id, [...events]]));
  return {
    forStudent: (studentId) => [...(byStudent.get(studentId) ?? [])],
    add(studentId, eventId) {
      const list = this.forStudent(studentId);
      if (!list.includes(eventId)) list.push(eventId);
      byStudent.set(studentId, list);
    },
    remove(studentId, eventId) {
      byStudent.set(studentId, this.forStudent(studentId).filter((id) => id !== eventId));
    },
  };
}
