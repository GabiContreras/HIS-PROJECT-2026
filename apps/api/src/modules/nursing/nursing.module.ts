import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministracionMedicacion } from '../../entities/administracion-medicacion.entity.js';
import { IndicacionMedica } from '../../entities/indicacion-medica.entity.js';
import { Insumo } from '../../entities/insumo.entity.js';
import { SignoVital } from '../../entities/signo-vital.entity.js';
import { AdmissionsModule } from '../admissions/admissions.module.js';
import { IamModule } from '../iam/iam.module.js';
import { IndicacionesController } from './api/indicaciones.controller.js';
import { SignosVitalesController } from './api/signos-vitales.controller.js';
import { IndicacionesService } from './application/indicaciones.service.js';
import { SignosVitalesService } from './application/signos-vitales.service.js';
import { INDICACIONES_REPOSITORY } from './domain/ports/indicaciones.repository.js';
import { SIGNOS_VITALES_REPOSITORY } from './domain/ports/signos-vitales.repository.js';
import { IndicacionesTypeOrmRepository } from './infrastructure/indicaciones.typeorm.repository.js';
import { SignosVitalesTypeOrmRepository } from './infrastructure/signos-vitales.typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([AdministracionMedicacion, IndicacionMedica, Insumo, SignoVital]), IamModule, AdmissionsModule],
  controllers: [SignosVitalesController, IndicacionesController],
  providers: [
    SignosVitalesService,
    IndicacionesService,
    { provide: INDICACIONES_REPOSITORY, useClass: IndicacionesTypeOrmRepository },
    { provide: SIGNOS_VITALES_REPOSITORY, useClass: SignosVitalesTypeOrmRepository },
  ],
  exports: [TypeOrmModule],
})
export class NursingModule {}
