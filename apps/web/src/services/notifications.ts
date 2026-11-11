import { http } from '../shared/http';

export interface RemoteNotification {
  id: string;
  tipo: string;
  prioridad: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

export const listMyNotifications = (): Promise<RemoteNotification[]> =>
  http.get<RemoteNotification[]>('/notificaciones');

export const markNotificationRead = (id: string): Promise<RemoteNotification> =>
  http.patch<RemoteNotification>(`/notificaciones/${id}/leer`);
