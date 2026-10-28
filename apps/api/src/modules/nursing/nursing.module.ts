import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministracionMedicacion } from '../../entities/administracion-medicacion.entity.js';
import { SignoVital } from '../../entities/signo-vital.entity.js';
import { AdmissionsModule } from '../admissions/admissions.module.js';
import { IamModule } from '../iam/iam.module.js';
import { SignosVitalesController } from './api/signos-vitales.controller.js';
import { SignosVitalesService } from './application/signos-vitales.service.js';
import { SIGNOS_VITALES_REPOSITORY } from './domain/ports/signos-vitales.repository.js';
import { SignosVitalesTypeOrmRepository } from './infrastructure/signos-vitales.typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([AdministracionMedicacion, SignoVital]), IamModule, AdmissionsModule],
  controllers: [SignosVitalesController],
  providers: [
    SignosVitalesService,
    { provide: SIGNOS_VITALES_REPOSITORY, useClass: SignosVitalesTypeOrmRepository },
  ],
  exports: [TypeOrmModule],
})
export class NursingModule {}
