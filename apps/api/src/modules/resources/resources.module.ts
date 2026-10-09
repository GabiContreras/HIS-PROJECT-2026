import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cama } from '../../entities/cama.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';

@Module({ imports: [TypeOrmModule.forFeature([Cama, Insumo])], exports: [TypeOrmModule] })
export class ResourcesModule {}
