import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Usuario } from './entities/usuario.entity.js';
import { RefreshSession } from './entities/refresh-session.entity.js';
import { Paciente } from './entities/paciente.entity.js';
import { Turno } from './entities/turno.entity.js';
import { Cama } from './entities/cama.entity.js';
import { Insumo } from './entities/insumo.entity.js';
import { Internacion } from './entities/internacion.entity.js';
import { SignoVital } from './entities/signo-vital.entity.js';
import { IndicacionMedica } from './entities/indicacion-medica.entity.js';
import { AdministracionMedicacion } from './entities/administracion-medicacion.entity.js';
import { Cargo } from './entities/cargo.entity.js';
import { EntreturnoStandby } from './entities/entreturno-standby.entity.js';
import { IamModule } from './modules/iam/iam.module.js';
import { AdmissionsModule } from './modules/admissions/admissions.module.js';
import { EhrModule } from './modules/ehr/ehr.module.js';
import { NursingModule } from './modules/nursing/nursing.module.js';
import { ResourcesModule } from './modules/resources/resources.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SharedModule } from './shared/shared.module.js';
import { SnakeNamingStrategy } from './config/snake-naming.strategy.js';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter.js';

@Module({
  imports: [
    // 1. Cargamos ConfigModule especificando posibles rutas del .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env', '../../.env'],
    }),

    // 2. Usamos forRootAsync para esperar a que las variables de entorno se carguen
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        namingStrategy: new SnakeNamingStrategy(),
        entities: [
          Usuario,
          RefreshSession,
          Paciente,
          Turno,
          Cama,
          Insumo,
          SignoVital,
          IndicacionMedica,
          AdministracionMedicacion,
          Cargo,
          Internacion,
          EntreturnoStandby,
        ],
        autoLoadEntities: true,
        synchronize: false,
        ssl:
          configService.get<string>('DATABASE_SSL') === 'false'
            ? false
            : { rejectUnauthorized: false },
      }),
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
  providers: [
    AppService,
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}