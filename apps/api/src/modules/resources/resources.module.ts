import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cama } from '../../entities/cama.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { Internacion } from '../../entities/internacion.entity.js';
import { MovimientoInventario } from '../../entities/movimiento-inventario.entity.js';
import { Paciente } from '../../entities/paciente.entity.js';
import { Usuario } from '../../entities/usuario.entity.js';
import { Sector } from '../../entities/sector.entity.js';
import { Habitacion } from '../../entities/habitacion.entity.js';
import { IamModule } from '../iam/iam.module.js';
import { CamasController } from './api/camas.controller.js';
import { InternacionesController } from './api/internaciones.controller.js';
import { UbicacionesController } from './api/ubicaciones.controller.js';
import { InventoryController } from './api/inventory.controller.js';
import { BedEventsStreamService } from './application/bed-events-stream.service.js';
import { CamasService } from './application/camas.service.js';
import { MedicationAdministeredSubscriber } from './application/medication-administered.subscriber.js';
import { InventoryService } from './infrastructure/inventory.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cama, Insumo, Internacion, MovimientoInventario, Paciente, Usuario, Sector, Habitacion]),
    IamModule,
  ],
  controllers: [InventoryController, CamasController, InternacionesController, UbicacionesController],
  providers: [
    InventoryService,
    CamasService,
    BedEventsStreamService,
    MedicationAdministeredSubscriber,
  ],
  exports: [TypeOrmModule, InventoryService, CamasService],
})
export class ResourcesModule {}