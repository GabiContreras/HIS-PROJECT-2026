
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntreturnoStandby } from './infrastructure/persistence/entities/entreturno-standby.entity.js';
import { Paciente } from './infrastructure/persistence/entities/paciente.entity.js';
import { Turno } from './infrastructure/persistence/entities/turno.entity.js';
import { Usuario } from '../iam/infrastructure/persistence/entities/usuario.entity.js';
import { NotificacionEntity } from './infrastructure/persistence/entities/notificacion.entity.js';
import { IamModule } from '../iam/iam.module.js';
import { PacientesController } from './api/pacientes.controller.js';
import { TurnosController } from './api/turnos.controller.js';
import { NotificacionesController } from './api/notificaciones.controller.js';
import { PacientesService } from './application/pacientes.service.js';
import { EntreturnoStandbyService } from './application/entreturno-standby.service.js';
import { TurnosService } from './application/turnos.service.js';
import { NotificacionesService } from './application/notificaciones.service.js';
import { VitalSignAlertSubscriber } from './application/vital-sign-alert.subscriber.js';
import { PACIENTES_REPOSITORY } from './domain/ports/pacientes.repository.js';
import { PacientesTypeOrmRepository } from './infrastructure/pacientes.typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, Turno, Usuario, EntreturnoStandby, NotificacionEntity]), IamModule],
  controllers: [TurnosController, PacientesController, NotificacionesController],
  providers: [
    TurnosService,
    EntreturnoStandbyService,
    PacientesService,
    NotificacionesService,
    VitalSignAlertSubscriber,
    { provide: PACIENTES_REPOSITORY, useClass: PacientesTypeOrmRepository },
  ],
  exports: [TurnosService, PacientesService, NotificacionesService],
})
export class AdmissionsModule {}