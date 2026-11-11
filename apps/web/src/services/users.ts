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

export function listarUsuarios(incluirBajas = false): Promise<Usuario[]> {
  return http.get<Usuario[]>(`/usuarios${incluirBajas ? '?incluirBajas=true' : ''}`);
}

export function obtenerUsuario(id: string): Promise<Usuario> {
  return http.get<Usuario>(`/usuarios/${id}`);
}

export interface HorarioMedico {
  horaInicio: string;
  horaFin: string;
}

export function actualizarHorario(id: string, horario: HorarioMedico): Promise<Usuario> {
  return http.patch<Usuario>(`/usuarios/${id}/horario`, horario);
}

export function actualizarUsuario(id: string, datos: { nombre?: string; apellido?: string }): Promise<Usuario> {
  return http.patch<Usuario>(`/usuarios/${id}`, datos);
}

export function habilitarUsuario(id: string): Promise<Usuario> {
  return http.patch<Usuario>(`/usuarios/${id}/habilitar`);
}

export function deshabilitarUsuario(id: string): Promise<Usuario> {
  return http.patch<Usuario>(`/usuarios/${id}/deshabilitar`);
}

export function darDeBajaUsuario(id: string): Promise<Usuario> {
  return http.patch<Usuario>(`/usuarios/${id}/baja`);
}

export function restaurarUsuario(id: string): Promise<Usuario> {
  return http.patch<Usuario>(`/usuarios/${id}/restaurar`);
}
