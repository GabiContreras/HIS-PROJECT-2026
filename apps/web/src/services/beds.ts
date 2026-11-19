import { ApiError, http } from '../shared/http';
import { readSseMessages } from '../shared/sse';

export type BedStatus = 'DISPONIBLE' | 'OCUPADA' | 'EN_LIMPIEZA' | 'MANTENIMIENTO';

export const BED_STATUS_LABELS: Record<BedStatus, string> = {
  DISPONIBLE: 'Libre',
  OCUPADA: 'Ocupada',
  EN_LIMPIEZA: 'En limpieza',
  MANTENIMIENTO: 'Bloqueada',
};

export type ApiBedStatus = 'LIBRE' | 'OCUPADA' | 'EN_LIMPIEZA' | 'BLOQUEADA';

const STATUS_FROM_API: Record<ApiBedStatus, BedStatus> = {
  LIBRE: 'DISPONIBLE',
  OCUPADA: 'OCUPADA',
  EN_LIMPIEZA: 'EN_LIMPIEZA',
  BLOQUEADA: 'MANTENIMIENTO',
};

export function fromApiStatus(value: unknown): BedStatus | null {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(STATUS_FROM_API, value)) return null;
  return STATUS_FROM_API[value as ApiBedStatus];
}

export interface BedPatient {
  id: string;
  nombre: string;
}

export interface Bed {
  id: string;
  numero: string;
  sector: string | null;
  habitacion: string | null;
  estado: BedStatus;
  paciente: BedPatient | null;
  motivoBloqueo: string | null;
  activa: boolean;
}

interface ApiBed {
  id: string;
  numero: string;
  sector: string | null;
  habitacion: { numero: string } | null;
  estado: ApiBedStatus;
  paciente: { id: string; nombre: string; apellido: string } | null;
  motivoBloqueo: string | null;
  activa: boolean;
}

export interface AssignBedInput {
  pacienteId: string;
  medicoId?: string;
  motivoIngreso?: string;
}

export interface BedChange {
  camaId: string;
  numero: string;
  estado: BedStatus;
  at: string;
}

export class BedConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BedConflictError';
  }
}

export function toBed(api: ApiBed): Bed {
  const estado = fromApiStatus(api.estado);
  if (!estado) throw new Error(`Estado de cama desconocido: ${String(api.estado)}`);
  return {
    id: api.id,
    numero: api.numero,
    sector: api.sector,
    habitacion: api.habitacion?.numero ?? null,
    estado,
    paciente: api.paciente ? { id: api.paciente.id, nombre: `${api.paciente.nombre} ${api.paciente.apellido}` } : null,
    motivoBloqueo: api.motivoBloqueo,
    activa: api.activa,
  };
}

async function transition(request: Promise<ApiBed>): Promise<Bed> {
  try {
    return toBed(await request);
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 409) throw new BedConflictError(reason.message);
    throw reason;
  }
}

export async function listBeds(): Promise<Bed[]> {
  return (await http.get<ApiBed[]>('/camas')).map(toBed);
}

export async function getBed(id: string): Promise<Bed | undefined> {
  try {
    return toBed(await http.get<ApiBed>(`/camas/${id}`));
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404) return undefined;
    throw reason;
  }
}

export function assignBed(id: string, input: AssignBedInput): Promise<Bed> {
  return transition(http.post<ApiBed>(`/camas/${id}/asignar`, input));
}

export function dischargeBed(id: string): Promise<Bed> {
  return transition(http.post<ApiBed>(`/camas/${id}/alta`));
}

export function confirmCleaning(id: string): Promise<Bed> {
  return transition(http.post<ApiBed>(`/camas/${id}/limpieza/confirmar`));
}

export function blockBed(id: string, motivo: string): Promise<Bed> {
  return transition(http.post<ApiBed>(`/camas/${id}/bloquear`, { motivo }));
}

export function unblockBed(id: string): Promise<Bed> {
  return transition(http.post<ApiBed>(`/camas/${id}/desbloquear`));
}

export function parseBedChange(data: string): BedChange | null {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { camaId, numero, estado, at } = raw as Record<string, unknown>;
  const mapped = fromApiStatus(estado);
  if (typeof camaId !== 'string' || typeof numero !== 'string' || typeof at !== 'string' || !mapped) return null;
  return { camaId, numero, estado: mapped, at };
}

export async function* streamBedChanges(signal: AbortSignal, onOpen?: () => void): AsyncGenerator<BedChange> {
  const response = await http.stream('/camas/eventos', signal);
  if (!response.body) throw new Error('El servidor no devolvió el flujo de camas.');
  onOpen?.();
  for await (const message of readSseMessages(response.body)) {
    if (message.event === 'ping') continue;
    const change = parseBedChange(message.data);
    if (change) yield change;
  }
}
