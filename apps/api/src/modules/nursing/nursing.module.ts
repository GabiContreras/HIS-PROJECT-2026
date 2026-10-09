import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministracionMedicacion } from '../../entities/administracion-medicacion.entity.js';

@Module({ imports: [TypeOrmModule.forFeature([AdministracionMedicacion])], exports: [TypeOrmModule] })
export class NursingModule {}
