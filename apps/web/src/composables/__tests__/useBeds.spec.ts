import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBeds } from '../useBeds';
import { listBeds, type Bed } from '../../services/beds';

vi.mock('../../services/beds', () => ({
  listBeds: vi.fn(),
}));

const bed = (id: string, numero: string, estado: Bed['estado']): Bed => ({
  id,
  numero,
  sector: 'A',
  habitacion: null,
  estado,
  paciente: null,
  motivoBloqueo: null,
  activa: true,
});

const mockBeds: Bed[] = [bed('1', '101', 'OCUPADA'), bed('2', '102', 'DISPONIBLE'), bed('3', '103', 'OCUPADA')];

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
    vi.mocked(listBeds).mockResolvedValue(mockBeds);

    const bedsState = useBeds();
    await bedsState.load();

    expect(bedsState.occupied.value).toBe(2);
  });

  it('debe cargar correctamente las camas', async () => {
    vi.mocked(listBeds).mockResolvedValue(mockBeds);

    const bedsState = useBeds();
    await bedsState.load();

    expect(listBeds).toHaveBeenCalledTimes(1);
    expect(bedsState.beds.value).toEqual(mockBeds);
    expect(bedsState.error.value).toBeNull();
    expect(bedsState.loading.value).toBe(false);
  });

  it('debe quedar sin camas cuando la API devuelve una lista vacía', async () => {
    vi.mocked(listBeds).mockResolvedValue([]);

    const bedsState = useBeds();
    await bedsState.load();

    expect(bedsState.beds.value).toEqual([]);
    expect(bedsState.occupied.value).toBe(0);
    expect(bedsState.error.value).toBeNull();
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
