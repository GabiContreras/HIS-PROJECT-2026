import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndicacionMedica } from '../../entities/indicacion-medica.entity.js';
import { RegistroClinico } from '../../entities/registro-clinico.entity.js';
import { SignoVital } from '../../entities/signo-vital.entity.js';
import { AdmissionsModule } from '../admissions/admissions.module.js';
import { IamModule } from '../iam/iam.module.js';
import { HistoriaClinicaController } from './api/historia-clinica.controller.js';
import { HistoriaClinicaService } from './application/historia-clinica.service.js';
import { HISTORIA_CLINICA_REPOSITORY } from './domain/ports/historia-clinica.repository.js';
import { HistoriaClinicaTypeOrmRepository } from './infrastructure/historia-clinica.typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([SignoVital, IndicacionMedica, RegistroClinico]), IamModule, AdmissionsModule],
  controllers: [HistoriaClinicaController],
  providers: [
    HistoriaClinicaService,
    { provide: HISTORIA_CLINICA_REPOSITORY, useClass: HistoriaClinicaTypeOrmRepository },
  ],
  exports: [TypeOrmModule],
})
export class EhrModule {}
