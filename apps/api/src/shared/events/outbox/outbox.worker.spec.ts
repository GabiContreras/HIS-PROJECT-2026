import { afterEach, describe, expect, it, vi } from 'vitest';
import { OUTBOX_POLL_INTERVAL_MS } from './outbox.config.js';
import type { OutboxService } from './outbox.service.js';
import { OutboxWorker } from './outbox.worker.js';

const workerWith = (processDue: ReturnType<typeof vi.fn>) =>
  new OutboxWorker({ processDue } as unknown as OutboxService);

describe('OutboxWorker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('procesa pendientes al arrancar y cada intervalo', async () => {
    vi.useFakeTimers();
    const processDue = vi.fn().mockResolvedValue(0);
    const worker = workerWith(processDue);

    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(processDue).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(OUTBOX_POLL_INTERVAL_MS);
    expect(processDue).toHaveBeenCalledTimes(2);

    worker.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(OUTBOX_POLL_INTERVAL_MS * 3);
    expect(processDue).toHaveBeenCalledTimes(2);
  });

  it('no superpone ciclos', async () => {
    let release: () => void = () => undefined;
    const processDue = vi.fn().mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
    const worker = workerWith(processDue);

    const first = worker.tick();
    await worker.tick();
    expect(processDue).toHaveBeenCalledTimes(1);

    release();
    await first;
    await worker.tick();
    expect(processDue).toHaveBeenCalledTimes(2);
  });

  it('un error del ciclo no lo detiene', async () => {
    const processDue = vi.fn().mockRejectedValueOnce(new Error('base caída')).mockResolvedValue(0);
    const worker = workerWith(processDue);

    await expect(worker.tick()).resolves.toBeUndefined();
    await worker.tick();

    expect(processDue).toHaveBeenCalledTimes(2);
  });
});
