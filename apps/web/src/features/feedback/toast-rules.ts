import type { ToastSeverity } from './types';

export const MAX_VISIBLE_TOASTS = 3;
export const DEDUPE_WINDOW_MS = 3000;
const MAX_DURATION_MS = 12_000;

const BASE_MS: Record<ToastSeverity, number> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 8000,
};

/**
 * Tiempo en pantalla: base por gravedad + 40 ms por cada carácter pasados los 60, con tope de 12 s.
 * Con botón de acción no se cierra solo (null): la persona tiene que poder usarlo.
 */
export function toastDuration(severity: ToastSeverity, message: string, hasAction = false): number | null {
  if (hasAction) return null;
  const extra = Math.max(0, message.length - 60) * 40;
  return Math.min(BASE_MS[severity] + extra, MAX_DURATION_MS);
}
