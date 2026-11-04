import { ApiError } from './http';

/** Texto legible para mostrar al usuario a partir de cualquier error. */
export function messageFrom(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}
