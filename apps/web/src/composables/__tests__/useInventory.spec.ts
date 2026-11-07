
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInventory } from '../useInventory';
import { listInventory, type InventoryItem } from '../../services/inventory';

vi.mock('../../services/inventory', () => ({
  listInventory: vi.fn(),
}));

const insumosPrueba = [
  { cantidadDisponible: 5 },
  { cantidadDisponible: 9 },
  { cantidadDisponible: 10 },
  { cantidadDisponible: 15 },
] as InventoryItem[];

describe('useInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe iniciar con la lista vacía', () => {
    const { items, loading, error } = useInventory();

    expect(items.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('debe cargar correctamente los insumos', async () => {
    vi.mocked(listInventory).mockResolvedValue(insumosPrueba);

    const { items, load } = useInventory();

    await load();

    expect(items.value).toEqual(insumosPrueba);
    expect(listInventory).toHaveBeenCalledOnce();
  });

  it('debe detectar los insumos con stock bajo', async () => {
    vi.mocked(listInventory).mockResolvedValue(insumosPrueba);

    const { lowStock, load } = useInventory();

    await load();

    expect(lowStock.value).toHaveLength(2);
  });

  it('no debe considerar bajo el stock de exactamente 10 unidades', async () => {
    vi.mocked(listInventory).mockResolvedValue(insumosPrueba);

    const { lowStock, load } = useInventory();

    await load();

    expect(
      lowStock.value.some(
        (item) => item.cantidadDisponible === 10,
      ),
    ).toBe(false);
  });

  it('debe manejar errores al cargar el inventario', async () => {
    vi.mocked(listInventory).mockRejectedValue(
      new Error('Error de prueba'),
    );

    const { error, load, loading } = useInventory();

    await load();

    expect(error.value).toBe('No se pudo cargar el inventario.');
    expect(loading.value).toBe(false);
  });

  it('debe limpiar el error cuando la carga es exitosa', async () => {
    vi.mocked(listInventory).mockRejectedValueOnce(
      new Error('Error de prueba'),
    );

    const { error, load } = useInventory();

    await load();

    expect(error.value).not.toBeNull();

    vi.mocked(listInventory).mockResolvedValue(insumosPrueba);

    await load();

    expect(error.value).toBeNull();
  });
});
