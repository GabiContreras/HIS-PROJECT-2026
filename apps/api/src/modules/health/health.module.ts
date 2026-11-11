import { Module } from '@nestjs/common';
import { HealthController } from './api/health.controller.js';

// Reservado para endpoints de salud/diagnóstico técnico de la API.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
