import { BaseProtocolBuilder } from './protocol-builder.js';
import { TipoIngreso } from './protocolo.js';

/** Builder concreto: ingreso por infección respiratoria, p. ej. neumonía (HU 2.1, escenario 2). */
export class RespiratoryProtocolBuilder extends BaseProtocolBuilder {
  readonly tipo = TipoIngreso.RESPIRATORIO;

  agregarTareasBase(): this {
    return this.agregarTarea('Monitoreo de saturación de oxígeno continuo').agregarTarea(
      'Indicación de aislamiento de contacto y gotas',
    );
  }
}
