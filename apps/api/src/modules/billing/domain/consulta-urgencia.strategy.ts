import { Injectable } from '@nestjs/common';
import { TipoAtencionFacturable } from '../infrastructure/persistence/entities/cargo.entity.js';
import { BillingStrategy } from './billing.strategy.js';

export class ConsultaUrgenciaStrategy implements BillingStrategy {
  readonly tipoAtencion = TipoAtencionFacturable.URGENCIA;

  calculateAmount(): number {
    return 25_000;
  }
}
