import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EstadoCuenta, RolUsuario } from '../../../entities/usuario.entity.js';
import { NotificacionesService } from './notificaciones.service.js';

function build(row: unknown) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(row),
    save: vi.fn().mockImplementation(async (n: unknown) => n),
    create: vi.fn().mockImplementation((d: unknown) => d),
  };
  const usuarios = { find: vi.fn().mockResolvedValue([]) };
  return { repo, usuarios, service: new NotificacionesService(repo as never, usuarios as never) };
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

describe('NotificacionesService.notificarUsuarios', () => {
  const contenido = { tipo: 'TEST', prioridad: 'ALTA', mensaje: 'hola' };

  function buildCrear() {
    const { service } = build(null);
    const crear = vi.spyOn(service, 'crearNotificacion').mockResolvedValue({} as never);
    return { service, crear };
  }

  it('no crea nada con una lista vacía', async () => {
    const { service, crear } = buildCrear();
    await service.notificarUsuarios([], contenido);
    expect(crear).not.toHaveBeenCalled();
  });

  it('crea una notificación por cada destinatario', async () => {
    const { service, crear } = buildCrear();
    await service.notificarUsuarios(['u1', 'u2', 'u3'], contenido);
    expect(crear).toHaveBeenCalledTimes(3);
    expect(crear).toHaveBeenCalledWith({ destinatarioId: 'u2', ...contenido });
  });

  it('si una falla, notifica a las demás y no lanza', async () => {
    const { service, crear } = buildCrear();
    crear.mockRejectedValueOnce(new Error('db caída'));
    await expect(service.notificarUsuarios(['u1', 'u2'], contenido)).resolves.toBeUndefined();
    expect(crear).toHaveBeenCalledTimes(2);
    expect(crear).toHaveBeenLastCalledWith({ destinatarioId: 'u2', ...contenido });
  });
});

describe('NotificacionesService.notificarPorRol', () => {
  const contenido = { tipo: 'TEST', prioridad: 'MEDIA', mensaje: 'hola' };

  it('filtra por rol y estado ACTIVO y notifica a cada cuenta', async () => {
    const { service, usuarios } = build(null);
    usuarios.find.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    const crear = vi.spyOn(service, 'crearNotificacion').mockResolvedValue({} as never);
    await service.notificarPorRol(RolUsuario.MEDICO, contenido);
    expect(usuarios.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rol: RolUsuario.MEDICO, estado: EstadoCuenta.ACTIVO } }),
    );
    expect(crear).toHaveBeenCalledTimes(2);
    expect(crear).toHaveBeenCalledWith({ destinatarioId: 'm1', ...contenido });
  });

  it('no crea nada si el rol no tiene cuentas activas', async () => {
    const { service } = build(null);
    const crear = vi.spyOn(service, 'crearNotificacion').mockResolvedValue({} as never);
    await service.notificarPorRol(RolUsuario.ADMINISTRATIVO, contenido);
    expect(crear).not.toHaveBeenCalled();
  });

  it('no lanza si falla la búsqueda de cuentas', async () => {
    const { service, usuarios } = build(null);
    usuarios.find.mockRejectedValue(new Error('db caída'));
    await expect(service.notificarPorRol(RolUsuario.MEDICO, contenido)).resolves.toBeUndefined();
  });

  it('un error al guardar una notificación no impide notificar a las demás', async () => {
    const { service, usuarios, repo } = build(null);
    usuarios.find.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    repo.save.mockRejectedValueOnce(new Error('falló'));
    await expect(service.notificarPorRol(RolUsuario.MEDICO, contenido)).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalledTimes(2);
  });
});
