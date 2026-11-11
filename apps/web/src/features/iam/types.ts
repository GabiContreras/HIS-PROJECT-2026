export type Role = 'MEDICO' | 'ENFERMERO' | 'ADMINISTRATIVO';
export type AccountStatus =
  | 'PENDIENTE_VERIFICACION'
  | 'PENDIENTE_HABILITACION'
  | 'ACTIVO'
  | 'DESHABILITADO'
  | 'BAJA';

export const ROLE_LABELS: Record<Role, string> = {
  MEDICO: 'Médico',
  ENFERMERO: 'Enfermero',
  ADMINISTRATIVO: 'Administrativo',
};

export interface Account {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Role;
  estado: AccountStatus;
  esSuperadmin: boolean;
  horaInicio?: string;
  horaFin?: string;
  dadoDeBajaEn?: string | null;
}

export interface Session {
  accessToken: string;
  account: Account;
}