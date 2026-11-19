import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http } from '../../shared/http';
import {
  BED_STATUS_LABELS,
  BedConflictError,
  assignBed,
  blockBed,
  confirmCleaning,
  dischargeBed,
  fromApiStatus,
  getBed,
  listBeds,
  parseBedChange,
  streamBedChanges,
  toBed,
  unblockBed,
  type BedChange,
} from '../beds';

vi.mock('../../shared/http', () => {
  class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError, http: { get: vi.fn(), post: vi.fn(), stream: vi.fn() } };
});

const apiBed = (overrides: Record<string, unknown> = {}) => ({
  id: 'b1',
  numero: 'A-12',
  sector: 'Clínica Médica',
  habitacion: { id: 'h1', numero: '101', sectorId: 's1', sector: 'Clínica Médica', capacidad: 4 },
  estado: 'LIBRE',
  paciente: null,
  version: 3,
  activa: true,
  motivoBloqueo: null,
  ...overrides,
});

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok: true, body } as Response;
}

async function collect(signal: AbortSignal, onOpen?: () => void): Promise<BedChange[]> {
  const changes: BedChange[] = [];
  for await (const change of streamBedChanges(signal, onOpen)) changes.push(change);
  return changes;
}

describe('beds service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapeo de estados', () => {
    it('traduce cada estado de la API al del frontend', () => {
      expect(fromApiStatus('LIBRE')).toBe('DISPONIBLE');
      expect(fromApiStatus('OCUPADA')).toBe('OCUPADA');
      expect(fromApiStatus('EN_LIMPIEZA')).toBe('EN_LIMPIEZA');
      expect(fromApiStatus('BLOQUEADA')).toBe('MANTENIMIENTO');
    });

    it('devuelve null para un estado desconocido o no textual', () => {
      expect(fromApiStatus('DISPONIBLE')).toBeNull();
      expect(fromApiStatus('toString')).toBeNull();
      expect(fromApiStatus(undefined)).toBeNull();
      expect(fromApiStatus(3)).toBeNull();
    });

    it('conserva las etiquetas que ve el usuario', () => {
      expect(BED_STATUS_LABELS.DISPONIBLE).toBe('Libre');
      expect(BED_STATUS_LABELS.MANTENIMIENTO).toBe('Bloqueada');
    });
  });

  describe('toBed', () => {
    it('convierte una cama libre', () => {
      expect(toBed(apiBed() as never)).toEqual({
        id: 'b1',
        numero: 'A-12',
        sector: 'Clínica Médica',
        habitacion: '101',
        estado: 'DISPONIBLE',
        paciente: null,
        motivoBloqueo: null,
        activa: true,
      });
    });

    it('arma el nombre del paciente y tolera cama sin habitación ni sector', () => {
      const bed = toBed(
        apiBed({
          estado: 'OCUPADA',
          sector: null,
          habitacion: null,
          paciente: { id: 'p1', nombre: 'María', apellido: 'Gómez', documento: '30123456' },
        }) as never,
      );

      expect(bed.paciente).toEqual({ id: 'p1', nombre: 'María Gómez' });
      expect(bed.sector).toBeNull();
      expect(bed.habitacion).toBeNull();
      expect(bed.estado).toBe('OCUPADA');
    });

    it('lanza error si el estado no existe', () => {
      expect(() => toBed(apiBed({ estado: 'ROTA' }) as never)).toThrow('Estado de cama desconocido');
    });
  });

  describe('lectura', () => {
    it('lista las camas desde GET /camas', async () => {
      vi.mocked(http.get).mockResolvedValue([apiBed(), apiBed({ id: 'b2', estado: 'BLOQUEADA', motivoBloqueo: 'Pintura' })]);

      const beds = await listBeds();

      expect(http.get).toHaveBeenCalledWith('/camas');
      expect(beds.map((b) => b.estado)).toEqual(['DISPONIBLE', 'MANTENIMIENTO']);
      expect(beds[1]?.motivoBloqueo).toBe('Pintura');
    });

    it('devuelve una lista vacía si no hay camas', async () => {
      vi.mocked(http.get).mockResolvedValue([]);

      expect(await listBeds()).toEqual([]);
    });

    it('pide el detalle a GET /camas/{id}', async () => {
      vi.mocked(http.get).mockResolvedValue(apiBed());

      const bed = await getBed('b1');

      expect(http.get).toHaveBeenCalledWith('/camas/b1');
      expect(bed?.numero).toBe('A-12');
    });

    it('devuelve undefined cuando la cama no existe (404)', async () => {
      vi.mocked(http.get).mockRejectedValue(new ApiError(404, 'La cama no existe.'));

      expect(await getBed('nada')).toBeUndefined();
    });

    it('propaga cualquier otro error', async () => {
      vi.mocked(http.get).mockRejectedValue(new ApiError(500, 'Error del servidor.'));

      await expect(getBed('b1')).rejects.toThrow('Error del servidor.');
    });
  });

  describe('acciones', () => {
    it('asigna con pacienteId, medicoId y motivoIngreso', async () => {
      vi.mocked(http.post).mockResolvedValue(apiBed({ estado: 'OCUPADA' }));

      const bed = await assignBed('b1', { pacienteId: 'p1', medicoId: 'm1', motivoIngreso: 'Cirugía programada' });

      expect(http.post).toHaveBeenCalledWith('/camas/b1/asignar', {
        pacienteId: 'p1',
        medicoId: 'm1',
        motivoIngreso: 'Cirugía programada',
      });
      expect(bed.estado).toBe('OCUPADA');
    });

    it('da el alta con POST /camas/{id}/alta', async () => {
      vi.mocked(http.post).mockResolvedValue(apiBed({ estado: 'EN_LIMPIEZA' }));

      const bed = await dischargeBed('b1');

      expect(http.post).toHaveBeenCalledWith('/camas/b1/alta');
      expect(bed.estado).toBe('EN_LIMPIEZA');
    });

    it('confirma la limpieza con POST /camas/{id}/limpieza/confirmar', async () => {
      vi.mocked(http.post).mockResolvedValue(apiBed());

      const bed = await confirmCleaning('b1');

      expect(http.post).toHaveBeenCalledWith('/camas/b1/limpieza/confirmar');
      expect(bed.estado).toBe('DISPONIBLE');
    });

    it('bloquea enviando el motivo', async () => {
      vi.mocked(http.post).mockResolvedValue(apiBed({ estado: 'BLOQUEADA', motivoBloqueo: 'Pintura' }));

      const bed = await blockBed('b1', 'Pintura');

      expect(http.post).toHaveBeenCalledWith('/camas/b1/bloquear', { motivo: 'Pintura' });
      expect(bed.estado).toBe('MANTENIMIENTO');
    });

    it('desbloquea con POST /camas/{id}/desbloquear', async () => {
      vi.mocked(http.post).mockResolvedValue(apiBed());

      await unblockBed('b1');

      expect(http.post).toHaveBeenCalledWith('/camas/b1/desbloquear');
    });

    it('traduce el 409 de la API a BedConflictError con su mensaje', async () => {
      vi.mocked(http.post).mockRejectedValue(new ApiError(409, 'La cama A-12 ya fue ocupada por otro operador.'));

      const error = await assignBed('b1', { pacienteId: 'p1' }).catch((reason) => reason);

      expect(error).toBeInstanceOf(BedConflictError);
      expect(error.message).toBe('La cama A-12 ya fue ocupada por otro operador.');
    });

    it('deja pasar los demás errores sin convertirlos', async () => {
      vi.mocked(http.post).mockRejectedValue(new ApiError(403, 'Tu rol no permite esta operación'));

      const error = await dischargeBed('b1').catch((reason) => reason);

      expect(error).not.toBeInstanceOf(BedConflictError);
      expect(error.message).toBe('Tu rol no permite esta operación');
    });
  });

  describe('parseBedChange', () => {
    it('lee el evento de la API y traduce el estado', () => {
      const data = JSON.stringify({ tipo: 'bed.blocked', camaId: 'b1', numero: 'A-12', estado: 'BLOQUEADA', at: '2026-11-10T13:30:00.000Z' });

      expect(parseBedChange(data)).toEqual({ camaId: 'b1', numero: 'A-12', estado: 'MANTENIMIENTO', at: '2026-11-10T13:30:00.000Z' });
    });

    it('descarta JSON inválido, campos faltantes y estados desconocidos', () => {
      expect(parseBedChange('no es json')).toBeNull();
      expect(parseBedChange('null')).toBeNull();
      expect(parseBedChange(JSON.stringify({ camaId: 'b1', numero: '1', estado: 'LIBRE' }))).toBeNull();
      expect(parseBedChange(JSON.stringify({ camaId: 'b1', numero: '1', estado: 'ROTA', at: 'x' }))).toBeNull();
    });
  });

  describe('streamBedChanges', () => {
    const event = (camaId: string, estado: string) =>
      `data: ${JSON.stringify({ tipo: 'x', camaId, numero: '1', estado, at: '2026-11-10T13:30:00.000Z' })}\n\n`;

    it('entrega los cambios, ignora el ping y arma mensajes partidos entre chunks', async () => {
      const first = event('b1', 'OCUPADA');
      const second = event('b2', 'LIBRE');
      vi.mocked(http.stream).mockResolvedValue(
        sseResponse([first.slice(0, 30), first.slice(30) + 'event: ping\ndata: {"at":"x"}\n\n' + second.slice(0, 10), second.slice(10)]),
      );
      const onOpen = vi.fn();

      const changes = await collect(new AbortController().signal, onOpen);

      expect(http.stream).toHaveBeenCalledWith('/camas/eventos', expect.any(AbortSignal));
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(changes.map((c) => [c.camaId, c.estado])).toEqual([
        ['b1', 'OCUPADA'],
        ['b2', 'DISPONIBLE'],
      ]);
    });

    it('omite los mensajes que no son un cambio de cama', async () => {
      vi.mocked(http.stream).mockResolvedValue(sseResponse(['data: basura\n\n', event('b1', 'EN_LIMPIEZA')]));

      const changes = await collect(new AbortController().signal);

      expect(changes).toHaveLength(1);
      expect(changes[0]?.estado).toBe('EN_LIMPIEZA');
    });

    it('propaga el error si no se pudo abrir el stream', async () => {
      vi.mocked(http.stream).mockRejectedValue(new ApiError(403, 'Tu rol no permite esta operación'));

      await expect(collect(new AbortController().signal)).rejects.toThrow('Tu rol no permite esta operación');
    });
  });
});
