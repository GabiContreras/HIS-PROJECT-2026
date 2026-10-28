export type BedStatus = 'DISPONIBLE' | 'OCUPADA' | 'EN_LIMPIEZA' | 'MANTENIMIENTO';

export const BED_STATUS_LABELS: Record<BedStatus, string> = {
  DISPONIBLE: 'Libre',
  OCUPADA: 'Ocupada',
  EN_LIMPIEZA: 'En limpieza',
  MANTENIMIENTO: 'Bloqueada',
};

export interface BedPatient {
  id: string;
  nombre: string;
}

export interface Bed {
  id: string;
  numero: string;
  sector: string;
  estado: BedStatus;
  paciente: BedPatient | null;
  ingresoAt: string | null;
  /** Versión para bloqueo optimista: si cambió, otra persona modificó la cama. */
  version: number;
}

export class BedConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BedConflictError';
  }
}

// Máquina de estados de la cama: no se puede pasar de "ocupada" a "libre" sin limpieza.
const TRANSITIONS: Record<BedStatus, BedStatus[]> = {
  DISPONIBLE: ['OCUPADA', 'MANTENIMIENTO'],
  OCUPADA: ['EN_LIMPIEZA'],
  EN_LIMPIEZA: ['DISPONIBLE'],
  MANTENIMIENTO: ['DISPONIBLE'],
};

const STATES: BedStatus[] = ['OCUPADA', 'DISPONIBLE', 'DISPONIBLE', 'OCUPADA', 'EN_LIMPIEZA', 'DISPONIBLE', 'MANTENIMIENTO'];
const NAMES = ['Carlos López', 'Ana Rojas', 'Laura Gómez', 'Marta Pérez', 'Luis Rossi', 'Raúl Benítez', 'Carla Molina', 'Tomás Herrera'];

// Datos de prueba en memoria mientras no exista el endpoint de camas.
const beds: Bed[] = Array.from({ length: 30 }, (_, i) => {
  const estado = STATES[i % STATES.length] ?? 'DISPONIBLE';
  const nombre = NAMES[i % NAMES.length] ?? 'Paciente';
  return {
    id: String(i + 1),
    numero: String(i + 1).padStart(2, '0'),
    sector: i < 15 ? 'Clínica médica' : 'Cirugía',
    estado,
    paciente: estado === 'OCUPADA' ? { id: `mock-${i}`, nombre } : null,
    ingresoAt: estado === 'OCUPADA' ? new Date(Date.now() - (i + 2) * 3_600_000).toISOString() : null,
    version: 1,
  };
});

function find(id: string): Bed {
  const bed = beds.find((b) => b.id === id);
  if (!bed) throw new Error('No se encontró la cama.');
  return bed;
}

function move(bed: Bed, next: BedStatus): void {
  if (!TRANSITIONS[bed.estado].includes(next)) {
    throw new BedConflictError(
      `Una cama "${BED_STATUS_LABELS[bed.estado]}" no puede pasar a "${BED_STATUS_LABELS[next]}".`,
    );
  }
  bed.estado = next;
  bed.version += 1;
}

const copy = (bed: Bed): Bed => ({ ...bed, paciente: bed.paciente ? { ...bed.paciente } : null });

export async function listBeds(): Promise<Bed[]> {
  return beds.map(copy); // TODO: http.get<Bed[]>('/camas') cuando exista el endpoint
}

export async function getBed(id: string): Promise<Bed | undefined> {
  const bed = beds.find((b) => b.id === id);
  return bed ? copy(bed) : undefined;
}

/** Solo una cama libre y sin cambios desde que se leyó puede ocuparse (evita la doble asignación). */
export async function assignBed(id: string, patient: BedPatient, expectedVersion: number): Promise<Bed> {
  const bed = find(id);
  if (bed.version !== expectedVersion || bed.estado !== 'DISPONIBLE') {
    throw new BedConflictError('La cama acaba de ser ocupada o cambió de estado. Actualizamos el mapa para que elijas otra.');
  }
  if (beds.some((b) => b.paciente?.id === patient.id)) {
    throw new BedConflictError('Ese paciente ya tiene una cama asignada.');
  }
  move(bed, 'OCUPADA');
  bed.paciente = { ...patient };
  bed.ingresoAt = new Date().toISOString();
  return copy(bed);
}

/** Alta o traslado: la cama pasa automáticamente a limpieza y no puede asignarse hasta higienizarla. */
export async function dischargeBed(id: string): Promise<Bed> {
  const bed = find(id);
  move(bed, 'EN_LIMPIEZA');
  bed.paciente = null;
  bed.ingresoAt = null;
  return copy(bed);
}

export async function confirmCleaning(id: string): Promise<Bed> {
  const bed = find(id);
  move(bed, 'DISPONIBLE');
  return copy(bed);
}

export async function toggleBlocked(id: string): Promise<Bed> {
  const bed = find(id);
  move(bed, bed.estado === 'MANTENIMIENTO' ? 'DISPONIBLE' : 'MANTENIMIENTO');
  return copy(bed);
}
