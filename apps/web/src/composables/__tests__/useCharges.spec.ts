import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharges } from '../useCharges';
import { listCharges, type Charge } from '../../services/charges';

vi.mock('../../services/charges', () => ({
  listCharges: vi.fn(),
}));

vi.mock('../../shared/http', () => ({
  ApiError: class ApiError extends Error {},
}));

const cargosPrueba = [
  { id: 'a', importePesos: 1000, tipoAtencion: 'REGULAR' },
  { id: 'b', importePesos: 2500, tipoAtencion: 'URGENCIA' },
  { id: 'c', importePesos: 500, tipoAtencion: 'URGENCIA' },
] as Charge[];

describe('useCharges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicia con la lista vacia', () => {
    const { charges, loading, error } = useCharges();

    expect(charges.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('carga todos los cargos como arreglo plano', async () => {
    vi.mocked(listCharges).mockResolvedValue(cargosPrueba);

    const { charges, load } = useCharges();
    await load();

    expect(charges.value).toEqual(cargosPrueba);
    expect(listCharges).toHaveBeenCalledOnce();
  });

  it('calcula el total y la cantidad de urgencias', async () => {
    vi.mocked(listCharges).mockResolvedValue(cargosPrueba);

    const { total, urgentCount, load } = useCharges();
    await load();

    expect(total.value).toBe(4000);
    expect(urgentCount.value).toBe(2);
  });

  it('informa el mensaje del error cuando la carga falla', async () => {
    vi.mocked(listCharges).mockRejectedValue(new Error('Sin conexion'));

    const { error, loading, load } = useCharges();
    await load();

    expect(error.value).toBe('Sin conexion');
    expect(loading.value).toBe(false);
  });

  it('usa el mensaje por defecto cuando el rechazo no es un error', async () => {
    vi.mocked(listCharges).mockRejectedValue('boom');

    const { error, load } = useCharges();
    await load();

    expect(error.value).toBe('No se pudieron cargar los cargos.');
  });

  it('limpia el error cuando una carga posterior sale bien', async () => {
    vi.mocked(listCharges).mockRejectedValueOnce(new Error('boom'));
    const { error, load } = useCharges();
    await load();
    expect(error.value).not.toBeNull();

    vi.mocked(listCharges).mockResolvedValue(cargosPrueba);
    await load();

    expect(error.value).toBeNull();
  });
});
