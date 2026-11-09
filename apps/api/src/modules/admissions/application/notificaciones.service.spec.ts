import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { NotificacionesService } from './notificaciones.service.js';

function build(row: unknown) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(row),
    save: vi.fn().mockImplementation(async (n: unknown) => n),
  };
  return { repo, service: new NotificacionesService(repo as never) };
}

describe('NotificacionesService.marcarComoLeida', () => {
  it('busca por id Y por destinatario, y la marca como leída', async () => {
    const { repo, service } = build({ id: 'n1', destinatarioId: 'u1', leida: false });
    const result = await service.marcarComoLeida('n1', 'u1');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'n1', destinatarioId: 'u1' } });
    expect(result.leida).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('responde 404 y no guarda nada si la notificación es de otro usuario (o no existe)', async () => {
    const { repo, service } = build(null);
    await expect(service.marcarComoLeida('n1', 'otro-usuario')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
