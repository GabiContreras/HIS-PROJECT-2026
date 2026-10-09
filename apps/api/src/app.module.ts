import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Usuario } from './entities/usuario.entity.js';
import { Paciente } from './entities/paciente.entity.js';
import { Turno } from './entities/turno.entity.js';
import { Cama } from './entities/cama.entity.js';
import { Insumo } from './entities/insumo.entity.js';
import { SignoVital } from './entities/signo-vital.entity.js';
import { IndicacionMedica } from './entities/indicacion-medica.entity.js';
import { AdministracionMedicacion } from './entities/administracion-medicacion.entity.js';
import { IamModule } from './modules/iam/iam.module.js';
import { AdmissionsModule } from './modules/admissions/admissions.module.js';
import { EhrModule } from './modules/ehr/ehr.module.js';
import { NursingModule } from './modules/nursing/nursing.module.js';
import { ResourcesModule } from './modules/resources/resources.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SharedModule } from './shared/shared.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Usuario, Paciente, Turno, Cama, Insumo, SignoVital, IndicacionMedica, AdministracionMedicacion],
      synchronize: false,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    }),
    SharedModule,
    HealthModule,
    IamModule,
    AdmissionsModule,
    EhrModule,
    NursingModule,
    ResourcesModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
