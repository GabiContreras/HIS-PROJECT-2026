import { displayName } from '../shared/format';
import { http } from '../shared/http';

export type MedicationStatus = 'PENDIENTE' | 'ADMINISTRADA';

export interface Medication {
  id: string;
  indicacionId: string;
  paciente: string;
  medicamento: string;
  dosis: string;
  indicacion: string;
  programadaAt: string;
  estado: MedicationStatus;
  insumoId: string | null;
  administradaPor: string | null;
  administradaAt: string | null;
}

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
}

interface IndicationDto {
  id: string;
  paciente: string;
  insumoId: string;
  insumo: string;
  dosis: string;
  frecuencia: string;
  dosisDelDia: DoseDto[];
}

export async function listMedications(): Promise<Medication[]> {
  const indications = await http.get<IndicationDto[]>('/indicaciones');
  return indications
    .flatMap((ind) =>
      ind.dosisDelDia.map((dose, n) => ({
        id: `${ind.id}:${n}`,
        indicacionId: ind.id,
        paciente: displayName(ind.paciente),
        medicamento: ind.insumo,
        dosis: ind.dosis,
        indicacion: ind.frecuencia,
        programadaAt: dose.programadaPara,
        estado: dose.estado,
        insumoId: ind.insumoId,
        administradaPor: dose.administradaPor ? displayName(dose.administradaPor) : null,
        administradaAt: dose.administradaEn ?? null,
      })),
    )
    .sort((a, b) => a.programadaAt.localeCompare(b.programadaAt));
}

export async function administerMedication(id: string): Promise<void> {
  const indicacionId = id.split(':')[0]!;
  await http.post(`/indicaciones/${encodeURIComponent(indicacionId)}/administraciones`, {});
}
