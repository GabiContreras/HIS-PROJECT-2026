import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBeds } from '../useBeds';
import { listBeds } from '../../services/beds';

vi.mock('../../services/beds', () => ({
  listBeds: vi.fn(),
}));

const mockBeds = [
  {
    id: '1',
    numero: '101',
    sector: 'A',
    estado: 'OCUPADA',
  },
  {
    id: '2',
    numero: '102',
    sector: 'A',
    estado: 'DISPONIBLE',
  },
  {
    id: '3',
    numero: '103',
    sector: 'B',
    estado: 'OCUPADA',
  },
];

describe('useBeds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe comenzar con una lista vacía', () => {
    const bedsState = useBeds();

    expect(bedsState.beds.value).toEqual([]);
    expect(bedsState.loading.value).toBe(false);
    expect(bedsState.error.value).toBeNull();
    expect(bedsState.occupied.value).toBe(0);
  });

  it('debe calcular correctamente las camas ocupadas', async () => {
    vi.mocked(listBeds).mockResolvedValue(mockBeds as never);

    const bedsState = useBeds();
    await bedsState.load();

    expect(bedsState.occupied.value).toBe(2);
  });

  it('debe cargar correctamente las camas', async () => {
    vi.mocked(listBeds).mockResolvedValue(mockBeds as never);

    const bedsState = useBeds();
    await bedsState.load();

    expect(listBeds).toHaveBeenCalledTimes(1);
    expect(bedsState.beds.value).toEqual(mockBeds);
    expect(bedsState.error.value).toBeNull();
    expect(bedsState.loading.value).toBe(false);
  });

  it('debe mostrar un error si falla la carga', async () => {
    vi.mocked(listBeds).mockRejectedValue(new Error('Error de conexión'));

    const bedsState = useBeds();
    await bedsState.load();

    expect(bedsState.error.value).toBe('No se pudieron cargar las camas.');
    expect(bedsState.loading.value).toBe(false);
    expect(bedsState.beds.value).toEqual([]);
  });
});