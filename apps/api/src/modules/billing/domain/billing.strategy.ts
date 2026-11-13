import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';

export interface BillingStrategy {
  readonly tipoAtencion: TipoAtencionFacturable;
  calculateAmount(): number;
}
