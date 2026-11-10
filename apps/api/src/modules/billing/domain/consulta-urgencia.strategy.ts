import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';
import { BillingStrategy } from './billing.strategy.js';

export class ConsultaUrgenciaStrategy implements BillingStrategy {
  readonly tipoAtencion = TipoAtencionFacturable.URGENCIA;

  calculateAmount(): number {
    return 25_000;
  }
}
