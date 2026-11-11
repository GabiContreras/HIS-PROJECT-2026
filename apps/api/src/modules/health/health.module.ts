import { Module } from '@nestjs/common';
import { HealthController } from './api/health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
