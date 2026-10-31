import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntreturnoStandby } from '../../entities/entreturno-standby.entity.js';
import { Paciente } from '../../entities/paciente.entity.js';
import { Turno } from '../../entities/turno.entity.js';
import { Usuario } from '../../entities/usuario.entity.js';
import { IamModule } from '../iam/iam.module.js';
import { PacientesController } from './api/pacientes.controller.js';
import { TurnosController } from './api/turnos.controller.js';
import { PacientesService } from './application/pacientes.service.js';
import { EntreturnoStandbyService } from './application/entreturno-standby.service.js';
import { TurnosService } from './application/turnos.service.js';
import { PACIENTES_REPOSITORY } from './domain/ports/pacientes.repository.js';
import { PacientesTypeOrmRepository } from './infrastructure/pacientes.typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, Turno, Usuario, EntreturnoStandby]), IamModule],
  controllers: [TurnosController, PacientesController],
  providers: [
    TurnosService,
    EntreturnoStandbyService,
    PacientesService,
    { provide: PACIENTES_REPOSITORY, useClass: PacientesTypeOrmRepository },
  ],
  exports: [TurnosService, PacientesService],
})
export class AdmissionsModule {}
