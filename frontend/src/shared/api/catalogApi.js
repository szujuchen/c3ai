import { request } from './client.js';

// Reference data. What comes back depends on the role: a student gets only their own, a host gets none of it.
export const getTerm = () => request('/term');
export const getStudents = () => request('/students').then((r) => r.students);
export const getCourses = () => request('/canvas/courses').then((r) => r.courses);
export const getCanvasAssignments = () => request('/canvas/assignments').then((r) => r.assignments);
export const getCampusFeed = () => request('/campus/events').then((r) => r.events);
export const getAudiences = () => request('/audiences');

// Whether the server has its own Canvas token (from backend/.env), so students can import with one click.
export const getCanvasStatus = () => request('/canvas/status').then((r) => r.configured).catch(() => false);
