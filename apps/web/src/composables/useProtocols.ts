import { ref } from 'vue';
import { ApiError } from '../shared/http';
import { listProtocols, type Protocol } from '../services/protocols';

export function useProtocols() {
  const protocols = ref<Protocol[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(pacienteId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      protocols.value = await listProtocols(pacienteId);
    } catch (e) {
      protocols.value = [];
      error.value = e instanceof ApiError ? e.message : 'No se pudo cargar el protocolo del paciente.';
    } finally {
      loading.value = false;
    }
  }

  function clear(): void {
    protocols.value = [];
    error.value = null;
  }

  return { protocols, loading, error, load, clear };
}
