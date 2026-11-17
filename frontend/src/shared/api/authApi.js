import { request } from './client.js';

export const getLoginStudents = () => request('/auth/students').then((r) => r.students);
export const login = (credentials) => request('/auth/login', { method: 'POST', body: credentials });
export const logout = () => request('/auth/logout', { method: 'POST' }).catch(() => {});
