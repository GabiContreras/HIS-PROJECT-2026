import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cama } from './infrastructure/persistence/entities/cama.entity.js';
import { Insumo } from './infrastructure/persistence/entities/insumo.entity.js';
import { Internacion } from './infrastructure/persistence/entities/internacion.entity.js';
import { Paciente } from '../admissions/infrastructure/persistence/entities/paciente.entity.js';
import { Usuario } from '../iam/infrastructure/persistence/entities/usuario.entity.js';
import { IamModule } from '../iam/iam.module.js';
import { CamasController } from './api/camas.controller.js';
import { InventoryController } from './api/inventory.controller.js';
import { BedEventsStreamService } from './application/bed-events-stream.service.js';
import { CamasService } from './application/camas.service.js';
import { MedicationAdministeredSubscriber } from './application/medication-administered.subscriber.js';
import { InventoryService } from './infrastructure/inventory.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cama, Insumo, Internacion, Paciente, Usuario]),
    IamModule,
  ],
  controllers: [InventoryController, CamasController],
  providers: [InventoryService, CamasService, BedEventsStreamService, MedicationAdministeredSubscriber],
  exports: [TypeOrmModule, InventoryService, CamasService],
})
export class ResourcesModule {}