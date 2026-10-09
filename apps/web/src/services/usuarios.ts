const API_URL = 'http://localhost:3000';

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  createdAt: string;
}

export interface CrearUsuarioInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: string;
}

export async function crearUsuario(datos: CrearUsuarioInput): Promise<Usuario> {
  const res = await fetch(`${API_URL}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!res.ok) throw new Error('Error al crear usuario');
  return res.json();
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const res = await fetch(`${API_URL}/usuarios`);
  if (!res.ok) throw new Error('Error al listar usuarios');
  return res.json();
}