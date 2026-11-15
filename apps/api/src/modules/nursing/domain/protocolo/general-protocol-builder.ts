import { BaseProtocolBuilder } from './protocol-builder.js';
import { TipoIngreso } from './protocolo.js';

export class GeneralProtocolBuilder extends BaseProtocolBuilder {
  readonly tipo = TipoIngreso.GENERAL;

  agregarTareasBase(): this {
    this.agregarTarea('Verificar identidad del paciente y motivo de ingreso.');
    this.agregarTarea('Controlar signos vitales según indicación médica.');
    this.agregarTarea('Revisar indicaciones médicas y alergias registradas.');
    return this;
  }
}
