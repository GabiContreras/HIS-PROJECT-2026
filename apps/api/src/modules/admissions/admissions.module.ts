import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from '../../entities/paciente.entity.js';
import { Turno } from '../../entities/turno.entity.js';
import { Usuario } from '../../entities/usuario.entity.js';
import { IamModule } from '../iam/iam.module.js';
import { TurnosController } from './api/turnos.controller.js';
import { TurnosService } from './application/turnos.service.js';

// Módulo de dominio: registra sus repositorios TypeORM.
// Los casos de uso/controladores se incorporan aquí sin mover entidades hasta validar migraciones.
@Module({
  imports: [TypeOrmModule.forFeature([Paciente, Turno, Usuario]), IamModule],
  controllers: [TurnosController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class AdmissionsModule {}
