import { ref } from 'vue';
import { ApiError } from '../../shared/http';
import {
  crearUsuario,
  listarUsuarios,
  obtenerUsuario,
  type CrearUsuarioInput,
  type Usuario,
} from '../../services/users';

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operación.';
}

export function useUsers() {
  const usuarios = ref<Usuario[]>([]);
  const usuario = ref<Usuario | null>(null);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  async function execute<T>(operation: () => Promise<T>): Promise<T | null> {
    cargando.value = true;
    error.value = null;
    try {
      return await operation();
    } catch (reason) {
      error.value = messageFrom(reason);
      return null;
    } finally {
      cargando.value = false;
    }
  }

  async function cargar(): Promise<boolean> {
    const result = await execute(listarUsuarios);
    if (result === null) return false;
    usuarios.value = result;
    return true;
  }

  async function cargarPorId(id: string): Promise<boolean> {
    usuario.value = null;
    const result = await execute(() => obtenerUsuario(id));
    if (result === null) return false;
    usuario.value = result;
    return true;
  }

  async function crear(datos: CrearUsuarioInput): Promise<boolean> {
    const result = await execute(() => crearUsuario(datos));
    return result !== null && cargar();
  }

  return { usuarios, usuario, cargando, error, cargar, cargarPorId, crear };
}
