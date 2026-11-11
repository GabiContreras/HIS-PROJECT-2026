import { BaseProtocolBuilder } from './protocol-builder.js';
import { TipoIngreso } from './protocolo.js';

export class PreOpProtocolBuilder extends BaseProtocolBuilder {
  readonly tipo = TipoIngreso.PRE_QUIRURGICO;

  agregarTareasBase(): this {
    return this.agregarTarea('Verificar ayuno de 8 horas')
      .agregarTarea('Colocar vía intravenosa periférica')
      .agregarTarea('Realizar control de signos vitales cada 2 horas', 2);
  }
}
