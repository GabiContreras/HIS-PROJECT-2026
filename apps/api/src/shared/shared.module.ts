import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity.js';
import { EventBus } from './events/event-bus.service.js';
import { OutboxService } from './events/outbox/outbox.service.js';
import { OUTBOX_STORE } from './events/outbox/outbox.types.js';
import { OutboxWorker } from './events/outbox/outbox.worker.js';
import { TypeOrmOutboxStore } from './events/outbox/typeorm-outbox.store.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [
    EventBus,
    OutboxService,
    OutboxWorker,
    TypeOrmOutboxStore,
    { provide: OUTBOX_STORE, useExisting: TypeOrmOutboxStore },
  ],
  exports: [EventBus, OutboxService],
})
export class SharedModule {}
