import { http } from '../shared/http';
import type { Account, Role } from '../features/iam/types';

export type Usuario = Account;
export type StaffRole = Exclude<Role, 'ADMINISTRATIVO'>;

export interface CrearUsuarioInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: StaffRole;
}

interface CrearUsuarioResponse {
  message: string;
}

export function crearUsuario(datos: CrearUsuarioInput): Promise<CrearUsuarioResponse> {
  return http.post<CrearUsuarioResponse>('/usuarios', datos);
}

export function listarUsuarios(): Promise<Usuario[]> {
  return http.get<Usuario[]>('/usuarios');
}

export function obtenerUsuario(id: string): Promise<Usuario> {
  return http.get<Usuario>(`/usuarios/${id}`);
}