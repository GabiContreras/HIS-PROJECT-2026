export type Role = 'MEDICO' | 'ENFERMERO' | 'ADMINISTRATIVO';
export type AccountStatus =
  | 'PENDIENTE_VERIFICACION'
  | 'PENDIENTE_HABILITACION'
  | 'ACTIVO'
  | 'DESHABILITADO';

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
}

export interface Session {
  accessToken: string;
  account: Account;
}