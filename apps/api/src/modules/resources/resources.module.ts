import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cama } from '../../entities/cama.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { Internacion } from '../../entities/internacion.entity.js';
import { Paciente } from '../../entities/paciente.entity.js';
import { Usuario } from '../../entities/usuario.entity.js';
import { IamModule } from '../iam/iam.module.js';
import { CamasController } from './api/camas.controller.js';
import { InventoryController } from './api/inventory.controller.js';
import { CamasService } from './application/camas.service.js';
import { InventoryService } from './infrastructure/inventory.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cama, Insumo, Internacion, Paciente, Usuario]),
    IamModule,
  ],
  controllers: [InventoryController, CamasController],
  providers: [InventoryService, CamasService],
  exports: [TypeOrmModule, InventoryService, CamasService],
})
export class ResourcesModule {}