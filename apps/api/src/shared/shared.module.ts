import { Global, Module } from '@nestjs/common';
import { EventBus } from './events/event-bus.service.js';

@Global()
@Module({ providers: [EventBus], exports: [EventBus] })
export class SharedModule {}
