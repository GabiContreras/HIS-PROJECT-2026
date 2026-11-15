import { displayName } from '../shared/format';
import { http } from '../shared/http';

export type MedicationStatus = 'PENDIENTE' | 'ADMINISTRADA' | 'OMITIDA';

export interface Medication {
  /** Una fila por dosis programada del día: `<indicacionId>:<n>`. */
  id: string;
  /** Indicación médica de la dosis (la API administra la dosis vigente de la indicación). */
  indicacionId: string;
  paciente: string;
  medicamento: string;
  dosis: string;
  indicacion: string;
  programadaAt: string; // ISO
  estado: MedicationStatus;
  /** Insumo del inventario que se descuenta al administrar (si corresponde). */
  insumoId: string | null;
  internacionId: string | null;
  administradaPor: string | null;
  administradaAt: string | null;
  motivoOmision: string | null;
}

/** Margen permitido para administrar respecto del horario indicado. */
export const ADMIN_WINDOW_MIN = 30;

export function minutesToSchedule(medication: Medication, now = new Date()): number {
  return Math.round((new Date(medication.programadaAt).getTime() - now.getTime()) / 60_000);
}

export function withinWindow(medication: Medication, now = new Date()): boolean {
  return Math.abs(minutesToSchedule(medication, now)) <= ADMIN_WINDOW_MIN;
}

interface DoseDto {
  programadaPara: string;
  estado: MedicationStatus;
  administradaPor?: string;
  administradaEn?: string;
  motivoOmision?: string | null;
}

interface IndicationDto {
  id: string;
  paciente: string;
  insumoId: string | null;
  insumo: string | null;
  tipo: 'MEDICACION' | 'DIETA' | 'CURACION' | 'ESTUDIO' | 'CUIDADO';
  internacionId: string | null;
  dosis: string;
  frecuencia: string;
  dosisDelDia: DoseDto[];
}

export async function listMedications(): Promise<Medication[]> {
  const indications = await http.get<IndicationDto[]>('/indicaciones');
  return indications
    .filter((ind) => ind.tipo === 'MEDICACION')
    .flatMap((ind) => {
      const insumoId = ind.insumoId;
      const insumo = ind.insumo;
      if (!insumoId || !insumo) {
        throw new Error(`La indicación de medicación ${ind.id} no tiene un insumo asociado.`);
      }
      return ind.dosisDelDia.map((dose, n) => ({
        id: `${ind.id}:${n}`,
        indicacionId: ind.id,
        paciente: displayName(ind.paciente),
        medicamento: insumo,
        dosis: ind.dosis,
        indicacion: ind.frecuencia,
        programadaAt: dose.programadaPara,
        estado: dose.estado,
        insumoId,
        internacionId: ind.internacionId,
        administradaPor: dose.administradaPor ? displayName(dose.administradaPor) : null,
        administradaAt: dose.administradaEn ?? null,
        motivoOmision: dose.motivoOmision ?? null,
      }));
    })
    .sort((a, b) => a.programadaAt.localeCompare(b.programadaAt));
}

/** El backend toma al enfermero de la sesión, valida la ventana de ±30 min y descuenta el insumo (409 si ya se administró). */
export async function administerMedication(id: string): Promise<void> {
  const indicacionId = id.split(':')[0]!;
  await http.post(`/indicaciones/${encodeURIComponent(indicacionId)}/administraciones`, {});
}
