import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndicacionMedica } from './infrastructure/persistence/entities/indicacion-medica.entity.js';
import { SignoVital } from './infrastructure/persistence/entities/signo-vital.entity.js';

@Module({ imports: [TypeOrmModule.forFeature([SignoVital, IndicacionMedica])], exports: [TypeOrmModule] })
export class EhrModule {}
