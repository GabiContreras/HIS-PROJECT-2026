import type { Role } from '../iam/types';

// --- Capa 1: toast (confirmaciones volátiles de acciones propias) ---
export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  severity: ToastSeverity;
  message: string;
  title?: string;
  /** ms; null = no se cierra solo. Si falta, se calcula por gravedad y largo del mensaje. */
  duration?: number | null;
  /** Mismo key en menos de 3 s = se suma al contador del toast existente en vez de crear otro. */
  key?: string;
  /** Salta la cola cuando hay 3 toasts visibles (alertas críticas). */
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
  /** Cuántas veces se disparó el mismo aviso en la ventana de duplicados. */
  count: number;
  action?: ToastInput['action'];
  createdAt: number;
  /** Cambia cuando llega un duplicado: el toast reinicia su cuenta regresiva. */
  touchedAt: number;
}

// --- Capa 2: notificaciones del sistema (campana) ---
export type NotificationLevel = 'critical' | 'warning' | 'info';
export type NotificationCategory = 'turno' | 'lista_espera' | 'clinico' | 'triaje' | 'sistema';

export interface SystemNotification {
  id: string;
  level: NotificationLevel;
  category: NotificationCategory;
  title: string;
  detail: string;
  /** ISO */
  createdAt: string;
  read: boolean;
  readAt: string | null;
  /** Destino al hacer clic (ruta del router). */
  link?: { name: string; params?: Record<string, string> };
  /** 'local' = la genera el front (temperatura, triaje) hasta que exista su backend. */
  source: 'server' | 'local';
  /** Solo notificaciones locales: qué roles las ven. Las del servidor ya vienen filtradas por usuario. */
  roles?: Role[];
  /** Identifica el evento de origen (ej. 'promo:<turnoId>'): evita mostrarlo dos veces si el servidor manda el mismo. */
  eventKey?: string;
}

export type NotifyInput = Pick<SystemNotification, 'level' | 'category' | 'title' | 'detail' | 'link' | 'roles'> & {
  /** Por defecto, las críticas también muestran un toast que no se cierra solo. */
  toast?: boolean;
  key?: string;
};

// --- Capa 3: modal de confirmación ---
export interface ConfirmOptions {
  title: string;
  message: string;
  /** Qué pasa al confirmar (lista corta). */
  consequences?: string[];
  /** Verbo concreto: "Dar de baja", "Cancelar turno". Nunca "Aceptar". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'info';
  /** Sin botón de cancelar ni Esc ni clic afuera (por ejemplo, sesión expirada). */
  blocking?: boolean;
  /**
   * Si se pasa, el modal queda abierto con el botón en carga hasta que termine; si falla,
   * el error se muestra adentro del modal y no se cierra.
   */
  run?: () => Promise<void>;
}

export interface ConfirmRequest extends ConfirmOptions {
  id: string;
  resolve: (confirmed: boolean) => void;
}
