import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  assignBed,
  getBed,
  listBeds,
  streamBedChanges,
  type Bed,
  type BedChange,
} from '../../services/beds';
import { RECONNECT_MAX_MS, RECONNECT_MIN_MS, useBedsStore } from '../beds.store';

vi.mock('../../shared/errors', () => ({
  messageFrom: (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback),
}));

vi.mock('../../services/beds', () => ({
  assignBed: vi.fn(),
  blockBed: vi.fn(),
  confirmCleaning: vi.fn(),
  dischargeBed: vi.fn(),
  getBed: vi.fn(),
  listBeds: vi.fn(),
  streamBedChanges: vi.fn(),
  unblockBed: vi.fn(),
}));

const bed = (overrides: Partial<Bed> = {}): Bed => ({
  id: 'b1',
  numero: '01',
  sector: 'Clínica Médica',
  habitacion: '101',
  estado: 'DISPONIBLE',
  paciente: null,
  motivoBloqueo: null,
  activa: true,
  ...overrides,
});

const change = (overrides: Partial<BedChange> = {}): BedChange => ({
  camaId: 'b1',
  numero: '01',
  estado: 'EN_LIMPIEZA',
  at: '2026-11-10T13:30:00.000Z',
  ...overrides,
});

describe('beds store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('carga y estado vacío', () => {
    it('no marca el estado vacío antes de cargar', () => {
      const store = useBedsStore();

      expect(store.beds).toEqual([]);
      expect(store.empty).toBe(false);
    });

    it('marca el estado vacío cuando la API no devuelve camas', async () => {
      vi.mocked(listBeds).mockResolvedValue([]);
      const store = useBedsStore();

      await store.load();

      expect(store.empty).toBe(true);
      expect(store.total).toBe(0);
      expect(store.occupied).toBe(0);
      expect(store.error).toBeNull();
    });

    it('cuenta camas por estado con datos de la API', async () => {
      vi.mocked(listBeds).mockResolvedValue([
        bed({ id: 'a' }),
        bed({ id: 'b', estado: 'OCUPADA' }),
        bed({ id: 'c', estado: 'OCUPADA' }),
        bed({ id: 'd', estado: 'MANTENIMIENTO' }),
      ]);
      const store = useBedsStore();

      await store.load();

      expect(store.empty).toBe(false);
      expect(store.total).toBe(4);
      expect(store.occupied).toBe(2);
      expect(store.counts).toEqual({ DISPONIBLE: 1, OCUPADA: 2, EN_LIMPIEZA: 0, MANTENIMIENTO: 1 });
    });

    it('muestra el error y no el estado vacío si falla la carga', async () => {
      vi.mocked(listBeds).mockRejectedValue(new Error('Error del servidor.'));
      const store = useBedsStore();

      await store.load();

      expect(store.error).toBe('Error del servidor.');
      expect(store.empty).toBe(false);
      expect(store.loading).toBe(false);
    });
  });

  describe('pacientes internados', () => {
    const occupiedBy = (id: string, patientId: string) => bed({ id, estado: 'OCUPADA', paciente: { id: patientId, nombre: 'Ana Rojas' } });

    it('no devuelve ninguno mientras el listado no se cargó', () => {
      expect(useBedsStore().admittedPatientIds).toEqual([]);
    });

    it('incluye solo a los pacientes de camas ocupadas', async () => {
      vi.mocked(listBeds).mockResolvedValue([occupiedBy('b1', 'p1'), bed({ id: 'b2' }), bed({ id: 'b3', estado: 'EN_LIMPIEZA' })]);
      const store = useBedsStore();

      await store.load();

      expect(store.admittedPatientIds).toEqual(['p1']);
    });

    it('refleja los cambios del stream: tras un alta vuelve a poder elegirse y tras una asignación desaparece', async () => {
      vi.mocked(listBeds).mockResolvedValue([occupiedBy('b1', 'p1'), bed({ id: 'b2' })]);
      const store = useBedsStore();
      await store.load();

      await store.applyChange(change({ camaId: 'b1', estado: 'EN_LIMPIEZA' }));
      expect(store.admittedPatientIds).toEqual([]);

      vi.mocked(getBed).mockResolvedValue(occupiedBy('b2', 'p2'));
      await store.applyChange(change({ camaId: 'b2', estado: 'OCUPADA' }));
      expect(store.admittedPatientIds).toEqual(['p2']);
    });
  });

  describe('acciones', () => {
    it('refresca el mapa aunque la acción falle con un conflicto', async () => {
      vi.mocked(assignBed).mockRejectedValue(new Error('La cama 01 ya fue ocupada por otro operador.'));
      vi.mocked(listBeds).mockResolvedValue([bed({ estado: 'OCUPADA' })]);
      const store = useBedsStore();

      await expect(store.assign('b1', { pacienteId: 'p1' })).rejects.toThrow('ya fue ocupada');

      expect(assignBed).toHaveBeenCalledWith('b1', { pacienteId: 'p1' });
      expect(listBeds).toHaveBeenCalledTimes(1);
      expect(store.beds[0]?.estado).toBe('OCUPADA');
    });
  });

  describe('eventos en tiempo real', () => {
    async function loaded(beds: Bed[]) {
      vi.mocked(listBeds).mockResolvedValue(beds);
      const store = useBedsStore();
      await store.load();
      return store;
    }

    it('aplica el estado nuevo de esa cama sin pedir el detalle cuando alcanza', async () => {
      const store = await loaded([bed({ estado: 'OCUPADA', paciente: { id: 'p1', nombre: 'Ana Rojas' } }), bed({ id: 'b2', numero: '02' })]);

      await store.applyChange(change({ estado: 'EN_LIMPIEZA' }));

      expect(store.beds[0]).toMatchObject({ id: 'b1', estado: 'EN_LIMPIEZA', paciente: null });
      expect(store.beds[1]?.estado).toBe('DISPONIBLE');
      expect(getBed).not.toHaveBeenCalled();
    });

    it('pide el detalle de la cama cuando queda ocupada para conocer al paciente', async () => {
      const store = await loaded([bed()]);
      vi.mocked(getBed).mockResolvedValue(bed({ estado: 'OCUPADA', paciente: { id: 'p1', nombre: 'Ana Rojas' } }));

      await store.applyChange(change({ estado: 'OCUPADA' }));

      expect(getBed).toHaveBeenCalledWith('b1');
      expect(store.beds[0]).toMatchObject({ estado: 'OCUPADA', paciente: { nombre: 'Ana Rojas' } });
    });

    it('pide el detalle cuando queda bloqueada para conocer el motivo', async () => {
      const store = await loaded([bed()]);
      vi.mocked(getBed).mockResolvedValue(bed({ estado: 'MANTENIMIENTO', motivoBloqueo: 'Pintura' }));

      await store.applyChange(change({ estado: 'MANTENIMIENTO' }));

      expect(store.beds[0]).toMatchObject({ estado: 'MANTENIMIENTO', motivoBloqueo: 'Pintura' });
    });

    it('agrega una cama que no estaba en el mapa', async () => {
      const store = await loaded([bed()]);
      vi.mocked(getBed).mockResolvedValue(bed({ id: 'b9', numero: '09' }));

      await store.applyChange(change({ camaId: 'b9', estado: 'DISPONIBLE' }));

      expect(store.beds.map((b) => b.id)).toEqual(['b1', 'b9']);
    });

    it('quita del mapa una cama que la API informa como inactiva', async () => {
      const store = await loaded([bed(), bed({ id: 'b2', numero: '02' })]);
      vi.mocked(getBed).mockResolvedValue(bed({ id: 'b2', activa: false }));

      await store.applyChange(change({ camaId: 'b2', estado: 'OCUPADA' }));

      expect(store.beds.map((b) => b.id)).toEqual(['b1']);
    });

    it('es idempotente: aplicar dos veces el mismo evento deja el mismo resultado', async () => {
      const store = await loaded([bed({ estado: 'OCUPADA', paciente: { id: 'p1', nombre: 'Ana Rojas' } })]);
      const event = change({ estado: 'EN_LIMPIEZA' });

      await store.applyChange(event);
      const once = JSON.parse(JSON.stringify(store.beds));
      await store.applyChange(event);
      await store.applyChange(event);

      expect(JSON.parse(JSON.stringify(store.beds))).toEqual(once);
      expect(store.counts).toEqual({ DISPONIBLE: 0, OCUPADA: 0, EN_LIMPIEZA: 1, MANTENIMIENTO: 0 });
    });

    it('es idempotente también cuando hay que pedir el detalle', async () => {
      const store = await loaded([bed()]);
      vi.mocked(getBed).mockResolvedValue(bed({ estado: 'OCUPADA', paciente: { id: 'p1', nombre: 'Ana Rojas' } }));
      const event = change({ estado: 'OCUPADA' });

      await store.applyChange(event);
      await store.applyChange(event);

      expect(store.beds).toHaveLength(1);
      expect(store.occupied).toBe(1);
      expect(store.beds[0]?.paciente?.nombre).toBe('Ana Rojas');
    });

    it('ignora un evento repetido más viejo que el último ya aplicado', async () => {
      const store = await loaded([bed({ estado: 'OCUPADA' })]);

      await store.applyChange(change({ estado: 'EN_LIMPIEZA', at: '2026-11-10T13:31:00.000Z' }));
      await store.applyChange(change({ estado: 'DISPONIBLE', at: '2026-11-10T13:30:00.000Z' }));

      expect(store.beds[0]?.estado).toBe('EN_LIMPIEZA');
    });

    it('descarta la respuesta del detalle si llegó un evento más nuevo mientras tanto', async () => {
      const store = await loaded([bed()]);
      let resolveDetail: (value: Bed) => void = () => undefined;
      vi.mocked(getBed).mockReturnValue(new Promise<Bed>((resolve) => (resolveDetail = resolve)));

      const pending = store.applyChange(change({ estado: 'OCUPADA', at: '2026-11-10T13:30:00.000Z' }));
      await store.applyChange(change({ estado: 'EN_LIMPIEZA', at: '2026-11-10T13:31:00.000Z' }));
      resolveDetail(bed({ estado: 'OCUPADA', paciente: { id: 'p1', nombre: 'Ana Rojas' } }));
      await pending;

      expect(store.beds[0]).toMatchObject({ estado: 'EN_LIMPIEZA', paciente: null });
    });

    it('conserva el estado local si falla el pedido del detalle', async () => {
      const store = await loaded([bed()]);
      vi.mocked(getBed).mockRejectedValue(new Error('sin conexión'));

      await store.applyChange(change({ estado: 'OCUPADA' }));

      expect(store.beds[0]?.estado).toBe('OCUPADA');
    });
  });

  describe('conexión del stream', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function hold(signal: AbortSignal): Promise<void> {
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve()));
    }

    it('abre una sola conexión para varios suscriptores y la cierra con el último', async () => {
      let signal!: AbortSignal;
      vi.mocked(streamBedChanges).mockImplementation(async function* (received) {
        signal = received;
        await hold(received);
      });
      const store = useBedsStore();

      store.connect();
      store.connect();
      await vi.advanceTimersByTimeAsync(0);
      expect(streamBedChanges).toHaveBeenCalledTimes(1);

      store.disconnect();
      expect(signal.aborted).toBe(false);
      store.disconnect();
      expect(signal.aborted).toBe(true);
    });

    it('aplica los eventos que llegan por el stream', async () => {
      vi.mocked(listBeds).mockResolvedValue([bed({ estado: 'OCUPADA' })]);
      vi.mocked(streamBedChanges).mockImplementation(async function* (received) {
        yield change({ estado: 'EN_LIMPIEZA' });
        await hold(received);
      });
      const store = useBedsStore();
      await store.load();

      store.connect();
      await vi.advanceTimersByTimeAsync(0);

      expect(store.beds[0]?.estado).toBe('EN_LIMPIEZA');
      store.disconnect();
    });

    it('reconecta con espera creciente y refresca el listado al reconectar', async () => {
      const starts: number[] = [];
      vi.mocked(listBeds).mockResolvedValue([bed()]);
      vi.mocked(streamBedChanges).mockImplementation(async function* (received, onOpen) {
        starts.push(Date.now());
        if (starts.length === 1) throw new Error('sin conexión');
        if (starts.length === 2) {
          onOpen?.();
          throw new Error('se cortó');
        }
        onOpen?.();
        await hold(received);
      });
      const store = useBedsStore();

      store.connect();
      await vi.advanceTimersByTimeAsync(0);
      expect(streamBedChanges).toHaveBeenCalledTimes(1);
      expect(listBeds).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS);
      expect(streamBedChanges).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(RECONNECT_MIN_MS);
      expect(streamBedChanges).toHaveBeenCalledTimes(3);
      expect(listBeds).toHaveBeenCalled();
      expect(starts[1]! - starts[0]!).toBe(RECONNECT_MIN_MS);
      expect(starts[2]! - starts[1]!).toBe(RECONNECT_MIN_MS);

      store.disconnect();
    });

    it('duplica la espera sin pasar del máximo cuando la conexión sigue fallando', async () => {
      const starts: number[] = [];
      vi.mocked(streamBedChanges).mockImplementation(async function* () {
        starts.push(Date.now());
        throw new Error('sin conexión');
      });
      const store = useBedsStore();

      store.connect();
      await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS * 8);
      store.disconnect();

      const gaps = starts.slice(1).map((time, index) => time - starts[index]!);
      expect(gaps.slice(0, 4)).toEqual([1_000, 2_000, 4_000, 8_000]);
      expect(Math.max(...gaps)).toBe(RECONNECT_MAX_MS);
    });

    it('deja de reconectar al desmontar', async () => {
      vi.mocked(streamBedChanges).mockImplementation(async function* () {
        throw new Error('sin conexión');
      });
      const store = useBedsStore();

      store.connect();
      await vi.advanceTimersByTimeAsync(0);
      store.disconnect();
      await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS * 4);

      expect(streamBedChanges).toHaveBeenCalledTimes(1);
    });
  });
});
