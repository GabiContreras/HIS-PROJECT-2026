import { Module } from '@nestjs/common';

// Módulo inicial: el dominio de facturación todavía no tiene entidades ni casos de uso.
// Se mantiene aislado para incorporar cargos/coberturas sin acoplarlo a Admisión.
@Module({})
export class BillingModule {}
