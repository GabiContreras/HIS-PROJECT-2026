import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cargo } from '../../entities/cargo.entity.js';
import { CargosController } from './api/cargos.controller.js';
import { AppointmentAttendedSubscriber } from './application/appointment-attended.subscriber.js';
import { BillingService } from './application/billing.service.js';
import { ConsultaRegularStrategy } from './domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from './domain/consulta-urgencia.strategy.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cargo])],
  controllers: [CargosController],
  providers: [
    BillingService,
    ConsultaRegularStrategy,
    ConsultaUrgenciaStrategy,
    AppointmentAttendedSubscriber,
  ],
  exports: [BillingService],
})
export class BillingModule {}
