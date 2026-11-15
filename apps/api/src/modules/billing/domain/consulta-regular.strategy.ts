import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';
import { BillingStrategy } from './billing.strategy.js';
import { PrestacionCodigo } from './nomenclador.js';

export class ConsultaRegularStrategy implements BillingStrategy {
  readonly tipoAtencion = TipoAtencionFacturable.REGULAR;
  readonly prestacion = PrestacionCodigo.CONSULTA_REGULAR;
}
