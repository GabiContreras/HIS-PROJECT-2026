import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from '../../entities/paciente.entity.js';
import { Turno } from '../../entities/turno.entity.js';

// Módulo de dominio: registra sus repositorios TypeORM.
// Los casos de uso/controladores se incorporan aquí sin mover entidades hasta validar migraciones.
@Module({ imports: [TypeOrmModule.forFeature([Paciente, Turno])], exports: [TypeOrmModule] })
export class AdmissionsModule {}
