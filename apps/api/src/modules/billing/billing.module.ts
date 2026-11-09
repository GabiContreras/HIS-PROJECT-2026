import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cargo } from './infrastructure/persistence/entities/cargo.entity.js';
import { Turno } from '../admissions/infrastructure/persistence/entities/turno.entity.js';
import { CargosController } from './api/cargos.controller.js';
import { AppointmentAttendedSubscriber } from './application/appointment-attended.subscriber.js';
import { BillingService } from './application/billing.service.js';
import { ConsultaRegularStrategy } from './domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from './domain/consulta-urgencia.strategy.js';
import { IamModule } from '../iam/iam.module.js';
import { Insumo } from '../resources/infrastructure/persistence/entities/insumo.entity.js';
import { AdministracionMedicacion } from '../nursing/infrastructure/persistence/entities/administracion-medicacion.entity.js';
import { MedicationAdministeredSubscriber } from './application/medication-administered.subscriber.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cargo, Turno, Insumo, AdministracionMedicacion]), IamModule],
  controllers: [CargosController],
  providers: [
    BillingService,
    ConsultaRegularStrategy,
    ConsultaUrgenciaStrategy,
    AppointmentAttendedSubscriber,
    MedicationAdministeredSubscriber,
  ],
  exports: [BillingService],
})
export class BillingModule {}
