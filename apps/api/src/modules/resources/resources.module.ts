
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cama } from '../../entities/cama.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { InventoryService } from './infrastructure/inventory.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cama, Insumo])],
  providers: [InventoryService],
  exports: [TypeOrmModule, InventoryService],
})
export class ResourcesModule {}
