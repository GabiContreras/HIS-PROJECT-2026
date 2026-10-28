import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministracionMedicacion } from '../../entities/administracion-medicacion.entity.js';
import { IndicacionMedica } from '../../entities/indicacion-medica.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { ProtocoloIngreso } from '../../entities/protocolo-ingreso.entity.js';
import { SignoVital } from '../../entities/signo-vital.entity.js';
import { TareaProtocolo } from '../../entities/tarea-protocolo.entity.js';
import { AdmissionsModule } from '../admissions/admissions.module.js';
import { IamModule } from '../iam/iam.module.js';
import { IndicacionesController } from './api/indicaciones.controller.js';
import { ProtocolosController } from './api/protocolos.controller.js';
import { SignosVitalesController } from './api/signos-vitales.controller.js';
import { IndicacionesService } from './application/indicaciones.service.js';
import { PatientAdmittedSubscriber } from './application/patient-admitted.subscriber.js';
import { ProtocolosService } from './application/protocolos.service.js';
import { SignosVitalesService } from './application/signos-vitales.service.js';
import { INDICACIONES_REPOSITORY } from './domain/ports/indicaciones.repository.js';
import { PROTOCOLOS_REPOSITORY } from './domain/ports/protocolos.repository.js';
import { SIGNOS_VITALES_REPOSITORY } from './domain/ports/signos-vitales.repository.js';
import { IndicacionesTypeOrmRepository } from './infrastructure/indicaciones.typeorm.repository.js';
import { ProtocolosTypeOrmRepository } from './infrastructure/protocolos.typeorm.repository.js';
import { SignosVitalesTypeOrmRepository } from './infrastructure/signos-vitales.typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([AdministracionMedicacion, IndicacionMedica, Insumo, ProtocoloIngreso, SignoVital, TareaProtocolo]), IamModule, AdmissionsModule],
  controllers: [SignosVitalesController, IndicacionesController, ProtocolosController],
  providers: [
    SignosVitalesService,
    IndicacionesService,
    ProtocolosService,
    PatientAdmittedSubscriber,
    { provide: PROTOCOLOS_REPOSITORY, useClass: ProtocolosTypeOrmRepository },
    { provide: INDICACIONES_REPOSITORY, useClass: IndicacionesTypeOrmRepository },
    { provide: SIGNOS_VITALES_REPOSITORY, useClass: SignosVitalesTypeOrmRepository },
  ],
  exports: [TypeOrmModule],
})
export class NursingModule {}
