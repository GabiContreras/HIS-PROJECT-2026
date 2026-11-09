import { TipoAtencionFacturable } from '../infrastructure/persistence/entities/cargo.entity.js';

export interface BillingStrategy {
  readonly tipoAtencion: TipoAtencionFacturable;
  calculateAmount(): number;
}
