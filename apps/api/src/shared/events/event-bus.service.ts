import { Inject, Injectable, Optional } from '@nestjs/common';
import { Subject, filter, type Observable } from 'rxjs';
import type { DomainEvent } from './domain-event.js';
import { OutboxService } from './outbox/outbox.service.js';

@Injectable()
export class EventBus {
  private readonly stream = new Subject<DomainEvent>();

  constructor(@Optional() @Inject(OutboxService) private readonly outbox?: OutboxService) {}

  publish<T>(event: DomainEvent<T>): void {
    this.stream.next(event);
    if (this.outbox?.isDurable(event.type)) {
      void this.outbox.enqueue(event);
    }
  }

  ofType<T>(type: string): Observable<DomainEvent<T>> {
    return this.stream.asObservable().pipe(filter((event) => event.type === type)) as Observable<DomainEvent<T>>;
  }
}
