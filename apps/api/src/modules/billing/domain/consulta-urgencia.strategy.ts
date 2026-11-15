import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';
import { BillingStrategy } from './billing.strategy.js';
import { PrestacionCodigo } from './nomenclador.js';

export class ConsultaUrgenciaStrategy implements BillingStrategy {
  readonly tipoAtencion = TipoAtencionFacturable.URGENCIA;
  readonly prestacion = PrestacionCodigo.CONSULTA_URGENCIA;
}
