import { Injectable } from '@nestjs/common';
import { TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { BillingStrategy } from './billing.strategy.js';

@Injectable()
export class ConsultaRegularStrategy implements BillingStrategy {
  readonly tipoAtencion = TipoAtencionFacturable.REGULAR;

  calculateAmount(): number {
    return 15_000;
  }
}
