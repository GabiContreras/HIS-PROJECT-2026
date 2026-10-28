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
