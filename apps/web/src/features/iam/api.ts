import { http } from '../../shared/http';
import type { Account, Session } from './types';

export const authApi = {
  login: (email: string, password: string) => http.post<Session>('/auth/login', { email, password }),
  refresh: () => http.post<Session>('/auth/refresh'),
  logout: () => http.post<void>('/auth/logout'),
  me: () => http.get<Account>('/auth/me'),
};