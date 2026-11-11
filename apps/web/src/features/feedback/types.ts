import type { Role } from '../iam/types';

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  severity: ToastSeverity;
  message: string;
  title?: string;
  duration?: number | null;
  key?: string;
  priority?: boolean;
  action?: { label: string; handler: () => void };
}

export interface Toast {
  id: string;
  severity: ToastSeverity;
  message: string;
  title?: string;
  duration: number | null;
  key?: string;
  count: number;
  action?: ToastInput['action'];
  createdAt: number;
  touchedAt: number;
}

export type NotificationLevel = 'critical' | 'warning' | 'info';
export type NotificationCategory = 'turno' | 'lista_espera' | 'clinico' | 'triaje' | 'sistema';

export interface SystemNotification {
  id: string;
  level: NotificationLevel;
  category: NotificationCategory;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
  readAt: string | null;
  link?: { name: string; params?: Record<string, string> };
  source: 'server' | 'local';
  roles?: Role[];
  eventKey?: string;
}

export type NotifyInput = Pick<SystemNotification, 'level' | 'category' | 'title' | 'detail' | 'link' | 'roles'> & {
  toast?: boolean;
  key?: string;
};

export interface ConfirmOptions {
  title: string;
  message: string;
  consequences?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'info';
  blocking?: boolean;
  run?: () => Promise<void>;
}

export interface ConfirmRequest extends ConfirmOptions {
  id: string;
  resolve: (confirmed: boolean) => void;
}
