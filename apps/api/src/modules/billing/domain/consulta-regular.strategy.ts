import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';
import { BillingStrategy } from './billing.strategy.js';

export class ConsultaRegularStrategy implements BillingStrategy {
  readonly tipoAtencion = TipoAtencionFacturable.REGULAR;

  calculateAmount(): number {
    return 15_000;
  }
}
