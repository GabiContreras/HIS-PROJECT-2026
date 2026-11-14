export type Role = 'MEDICO' | 'ENFERMERO' | 'ADMINISTRATIVO';
export type AccountStatus =
  | 'PENDIENTE_VERIFICACION'
  | 'PENDIENTE_HABILITACION'
  | 'ACTIVO'
  | 'DESHABILITADO'
  /** Baja lógica: archivada por el superadmin. */
  | 'BAJA';

export const ROLE_LABELS: Record<Role, string> = {
  MEDICO: 'Médico',
  ENFERMERO: 'Enfermero',
  ADMINISTRATIVO: 'Administrativo',
};

// Provisorio: se ajusta con la respuesta real de /auth/login
export interface Account {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Role;
  estado: AccountStatus;
  esSuperadmin: boolean;
  /** Solo médicos: jornada de atención 'HH:MM'. */
  horaInicio?: string;
  horaFin?: string;
  /** Solo cuentas dadas de baja (ISO). */
  dadoDeBajaEn?: string | null;
}

export interface Session {
  accessToken: string;
  account: Account;
}