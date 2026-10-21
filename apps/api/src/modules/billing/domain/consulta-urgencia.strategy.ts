import { Injectable } from '@nestjs/common';
import { TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { BillingStrategy } from './billing.strategy.js';

@Injectable()
export class ConsultaUrgenciaStrategy implements BillingStrategy {
  readonly tipoAtencion = TipoAtencionFacturable.URGENCIA;

  calculateAmount(): number {
    return 25_000;
  }
}
