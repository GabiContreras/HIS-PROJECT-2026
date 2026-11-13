import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OUTBOX_POLL_INTERVAL_MS } from './outbox.config.js';
import { OutboxService } from './outbox.service.js';

@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly outbox: OutboxService) {}

  onApplicationBootstrap(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), OUTBOX_POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.outbox.processDue();
    } catch (error) {
      this.logger.error('Falló el ciclo del worker del outbox.', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
