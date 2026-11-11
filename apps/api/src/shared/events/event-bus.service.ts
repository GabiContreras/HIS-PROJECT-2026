import { Injectable } from '@nestjs/common';
import { Subject, filter, type Observable } from 'rxjs';
import type { DomainEvent } from './domain-event.js';

@Injectable()
export class EventBus {
  private readonly stream = new Subject<DomainEvent>();

  publish<T>(event: DomainEvent<T>): void {
    this.stream.next(event);
  }

  ofType<T>(type: string): Observable<DomainEvent<T>> {
    return this.stream.asObservable().pipe(filter((event) => event.type === type)) as Observable<DomainEvent<T>>;
  }
}
