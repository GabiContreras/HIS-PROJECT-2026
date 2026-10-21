
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from '../../entities/paciente.entity.js';
import { Turno } from '../../entities/turno.entity.js';
import { Usuario } from '../../entities/usuario.entity.js';
import { IamModule } from '../iam/iam.module.js';
import { PacientesController } from './api/pacientes.controller.js';
import { TurnosController } from './api/turnos.controller.js';
import { PacientesService } from './application/pacientes.service.js';
import { TurnosService } from './application/turnos.service.js';
import { PACIENTES_REPOSITORY } from './domain/pacientes.repository.js';
import { TypeOrmPacientesRepository } from './infrastructure/typeorm-pacientes.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Paciente, Turno, Usuario]),
    IamModule,
  ],
  controllers: [TurnosController, PacientesController],
  providers: [
    TurnosService,
    PacientesService,
    {
      provide: PACIENTES_REPOSITORY,
      useClass: TypeOrmPacientesRepository,
    },
  ],
  exports: [TurnosService, PacientesService],
})
export class AdmissionsModule {}
