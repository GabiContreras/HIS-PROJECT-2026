import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../../iam/api/authenticated-request.js';
import { NotificacionesController } from './notificaciones.controller.js';

describe('NotificacionesController', () => {
  it('lista las notificaciones de la cuenta autenticada (req.user.accountId)', async () => {
    const service = { obtenerPorUsuario: vi.fn().mockResolvedValue([{ id: 'n1' }]), marcarComoLeida: vi.fn() };
    const controller = new NotificacionesController(service as never);
    const req = { user: { accountId: 'cuenta-1', sessionId: 's', rol: 'MEDICO', esSuperadmin: false } } as unknown as AuthenticatedRequest;

    await expect(controller.listarMisNotificaciones(req)).resolves.toEqual([{ id: 'n1' }]);
    expect(service.obtenerPorUsuario).toHaveBeenCalledWith('cuenta-1');
  });

  it('marca como leída pasando el id de la notificación y la cuenta autenticada', async () => {
    const service = { obtenerPorUsuario: vi.fn(), marcarComoLeida: vi.fn().mockResolvedValue({ id: 'n1', leida: true }) };
    const controller = new NotificacionesController(service as never);
    const req = { user: { accountId: 'cuenta-1' } } as unknown as AuthenticatedRequest;

    await controller.marcarLeida('n1', req);
    expect(service.marcarComoLeida).toHaveBeenCalledWith('n1', 'cuenta-1');
  });
});
