import { TipoAtencionFacturable } from '../../../entities/cargo.entity.js';

export interface BillingStrategy {
  readonly tipoAtencion: TipoAtencionFacturable;
  calculateAmount(): number;
}
