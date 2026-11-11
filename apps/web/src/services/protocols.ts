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

export type TipoIngreso = 'PRE_QUIRURGICO' | 'RESPIRATORIO';

export const INGRESO_TYPE_LABELS: Record<TipoIngreso, string> = {
  PRE_QUIRURGICO: 'Ingreso pre-quirúrgico',
  RESPIRATORIO: 'Ingreso por infección respiratoria',
};

export const ingresoTypeLabel = (tipo: string): string => INGRESO_TYPE_LABELS[tipo as TipoIngreso] ?? tipo;

export interface ProtocolTask {
  id: string;
  orden: number;
  descripcion: string;
  frecuenciaHoras: number | null;
  hecha: boolean;
  hechaEn: string | null;
  hechaPor: string | null;
}

export interface Protocol {
  id: string;
  ingresoId: string;
  pacienteId: string;
  tipo: TipoIngreso;
  motivoIngreso: string;
  generadoEn: string;
  tareas: ProtocolTask[];
}

export function listProtocols(pacienteId: string): Promise<Protocol[]> {
  return http.get<Protocol[]>(`/protocolos?pacienteId=${encodeURIComponent(pacienteId)}`);
}

export function markProtocolTask(protocolId: string, taskId: string, hecha: boolean): Promise<Protocol> {
  return http.patch<Protocol>(
    `/protocolos/${encodeURIComponent(protocolId)}/tareas/${encodeURIComponent(taskId)}`,
    { hecha },
  );
}

const BACKEND_MOTIVOS: Record<AdmissionReason, string> = {
  PRE_QUIRURGICO: 'Cirugía programada',
  INFECCION_RESPIRATORIA: 'Infección respiratoria',
};

export function saveAdmissionProtocol(pacienteId: string, reason: AdmissionReason): Promise<Protocol> {
  return http.post<Protocol>('/protocolos/ingresos', {
    ingresoId: crypto.randomUUID(),
    pacienteId,
    motivoIngreso: BACKEND_MOTIVOS[reason],
  });
}
