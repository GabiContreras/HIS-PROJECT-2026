
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cama } from '../../entities/cama.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { MedicationAdministeredSubscriber } from './application/medication-administered.subscriber.js';
import { InventoryController } from './api/inventory.controller.js';
import { InventoryService } from './infrastructure/inventory.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cama, Insumo])],
  controllers: [InventoryController],
  providers: [InventoryService, MedicationAdministeredSubscriber],
  exports: [TypeOrmModule, InventoryService],
})
export class ResourcesModule {}
