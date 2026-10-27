export type Role = 'MEDICO' | 'ENFERMERO' | 'ADMINISTRATIVO';

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
}

export interface Session {
  accessToken: string;
  account: Account;
}