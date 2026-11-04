import { http } from '../shared/http';

export type AdmissionReason = 'PRE_QUIRURGICO' | 'INFECCION_RESPIRATORIA';

export const ADMISSION_REASONS: Record<AdmissionReason, string> = {
  PRE_QUIRURGICO: 'Ingreso pre-quirúrgico (cirugía programada)',
  INFECCION_RESPIRATORIA: 'Ingreso por infección respiratoria (neumonía)',
};

export interface CareTask {
  id: string;
  descripcion: string;
  hecha: boolean;
}

export interface CareProtocol {
  nombre: string;
  motivo: AdmissionReason;
  tareas: CareTask[];
}

/** Patrón Builder: arma el plan de cuidados paso a paso según el motivo de ingreso. */
class ProtocolBuilder {
  private readonly tasks: string[] = [];

  constructor(
    private readonly name: string,
    private readonly reason: AdmissionReason,
  ) {}

  addTask(description: string): this {
    this.tasks.push(description);
    return this;
  }

  build(): CareProtocol {
    return {
      nombre: this.name,
      motivo: this.reason,
      tareas: this.tasks.map((descripcion, i) => ({ id: `${this.reason}-${i}`, descripcion, hecha: false })),
    };
  }
}

export function buildProtocol(reason: AdmissionReason): CareProtocol {
  if (reason === 'PRE_QUIRURGICO') {
    return new ProtocolBuilder('Protocolo pre-quirúrgico', reason)
      .addTask('Verificar ayuno de 8 horas')
      .addTask('Colocar vía intravenosa periférica')
      .addTask('Realizar control de signos vitales cada 2 horas')
      .build();
  }
  return new ProtocolBuilder('Protocolo de infección respiratoria', reason)
    .addTask('Monitoreo de saturación de oxígeno continuo')
    .addTask('Indicación de aislamiento de contacto y gotas')
    .build();
}

// --- API de protocolos generados por el backend al admitir al paciente ---
export type TipoIngreso = 'PRE_QUIRURGICO' | 'RESPIRATORIO';

/** Etiquetas de pantalla para cada tipo de ingreso de la API. */
export const INGRESO_TYPE_LABELS: Record<TipoIngreso, string> = {
  PRE_QUIRURGICO: 'Ingreso pre-quirúrgico',
  RESPIRATORIO: 'Ingreso por infección respiratoria',
};

export const ingresoTypeLabel = (tipo: string): string => INGRESO_TYPE_LABELS[tipo as TipoIngreso] ?? tipo;

export interface ProtocolTask {
  orden: number;
  descripcion: string;
  frecuenciaHoras: number | null;
}

export interface Protocol {
  id: string;
  ingresoId: string;
  pacienteId: string;
  tipo: TipoIngreso;
  motivoIngreso: string;
  generadoEn: string; // ISO
  tareas: ProtocolTask[];
}

export function listProtocols(pacienteId: string): Promise<Protocol[]> {
  return http.get<Protocol[]>(`/protocolos?pacienteId=${encodeURIComponent(pacienteId)}`);
}

/** Motivo de ingreso en texto que el backend sabe resolver a un protocolo. */
const BACKEND_MOTIVOS: Record<AdmissionReason, string> = {
  PRE_QUIRURGICO: 'Cirugía programada',
  INFECCION_RESPIRATORIA: 'Infección respiratoria',
};

/** Guarda en el backend el protocolo del ingreso (POST /protocolos/ingresos; solo médicos y administrativos). */
export function saveAdmissionProtocol(pacienteId: string, reason: AdmissionReason): Promise<Protocol> {
  return http.post<Protocol>('/protocolos/ingresos', {
    ingresoId: crypto.randomUUID(),
    pacienteId,
    motivoIngreso: BACKEND_MOTIVOS[reason],
  });
}
