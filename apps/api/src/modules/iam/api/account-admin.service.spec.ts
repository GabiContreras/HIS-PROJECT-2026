import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RefreshSession } from '../../../entities/refresh-session.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import type { SessionIdentity } from '../application/auth.service.js';
import { AccountAdminService } from './account-admin.service.js';

const account = (over: Partial<Usuario> = {}) =>
  ({
    id: 'u-1',
    nombre: 'Ada',
    apellido: 'Lovelace',
    email: 'ada@x.com',
    rol: RolUsuario.MEDICO,
    estado: EstadoCuenta.ACTIVO,
    esSuperadmin: false,
    emailVerificado: true,
    horaInicio: '08:00:00',
    horaFin: '16:00:00',
    dadoDeBajaEn: null,
    ...over,
  }) as Usuario;

const actor = (over: Partial<SessionIdentity> = {}): SessionIdentity => ({
  accountId: 'admin-1',
  sessionId: 's-1',
  rol: RolUsuario.ADMINISTRATIVO,
  esSuperadmin: false,
  ...over,
});
const superadmin = actor({ accountId: 'root', esSuperadmin: true });

function setup(target: Usuario, opts: { pendientes?: number } = {}) {
  const usuarios = {
    find: vi.fn().mockResolvedValue([target]),
    findOneBy: vi.fn().mockResolvedValue(target),
    save: vi.fn(async (value) => value),
  };
  const sesiones = { update: vi.fn() };
  const standbyExec = vi.fn();
  const standbyBuilder = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: standbyExec,
  };
  const turnosQuery = {
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getCount: vi.fn().mockResolvedValue(opts.pendientes ?? 0),
  };
  const sessionsInTx = { update: vi.fn() };
  const manager = {
    getRepository: vi.fn((entity) =>
      entity === Usuario
        ? { findOne: vi.fn().mockResolvedValue(target), save: usuarios.save }
        : entity === Turno
          ? { createQueryBuilder: vi.fn().mockReturnValue(turnosQuery) }
          : entity === RefreshSession
            ? sessionsInTx
            : undefined,
    ),
    createQueryBuilder: vi.fn().mockReturnValue(standbyBuilder),
  };
  const dataSource = { transaction: vi.fn((op) => op(manager)) };
  const service = new AccountAdminService(
    usuarios as never,
    sesiones as never,
    {} as never,
    dataSource as never,
  );
  return { service, usuarios, sesiones, sessionsInTx, standbyExec, turnosQuery };
}

describe('AccountAdminService — permisos del superadmin y baja lógica', () => {
  describe('listado', () => {
    it('un administrativo común no ve las bajas aunque las pida', async () => {
      const { service, usuarios } = setup(account());
      await service.list(actor(), true);
      const where = usuarios.find.mock.calls[0][0].where;
      expect(where.estado).toBeDefined(); // Not(BAJA)
    });

    it('el superadmin ve todo cuando pide incluir bajas', async () => {
      const { service, usuarios } = setup(account());
      await service.list(superadmin, true);
      expect(usuarios.find.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('administrativos', () => {
    const otherAdmin = () => account({ id: 'admin-2', rol: RolUsuario.ADMINISTRATIVO });

    it('un administrativo común no puede modificar a otro administrativo', async () => {
      const { service } = setup(otherAdmin());
      await expect(
        service.updateProfile('admin-2', { nombre: 'X' }, actor()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un administrativo sí puede corregir su propio nombre', async () => {
      const me = account({ id: 'admin-1', rol: RolUsuario.ADMINISTRATIVO });
      const { service } = setup(me);
      const result = await service.updateProfile('admin-1', { nombre: 'Nuevo' }, actor());
      expect(result.nombre).toBe('Nuevo');
    });

    it('el superadmin puede modificar a cualquier administrativo', async () => {
      const { service } = setup(otherAdmin());
      const result = await service.updateProfile('admin-2', { nombre: 'X' }, superadmin);
      expect(result.nombre).toBe('X');
    });

    it('un administrativo común no puede deshabilitar ni habilitar a otro administrativo', async () => {
      const { service } = setup(otherAdmin());
      await expect(service.deactivate('admin-2', actor())).rejects.toThrow(ForbiddenException);
      await expect(service.enableDoctor('admin-2', actor())).rejects.toThrow(ForbiddenException);
    });

    it('nadie puede deshabilitarse a sí mismo', async () => {
      const me = account({ id: 'root', rol: RolUsuario.ADMINISTRATIVO });
      const { service } = setup(me);
      await expect(service.deactivate('root', superadmin)).rejects.toThrow('tu propia cuenta');
    });

    it('un administrativo sigue pudiendo deshabilitar médicos y revoca sus sesiones', async () => {
      const { service, sesiones } = setup(account());
      const result = await service.deactivate('u-1', actor());
      expect(result.estado).toBe(EstadoCuenta.DESHABILITADO);
      expect(sesiones.update).toHaveBeenCalled();
    });
  });

  describe('baja lógica', () => {
    it('da de baja a un médico sin turnos pendientes, revoca sesiones y retira su cola', async () => {
      const { service, sessionsInTx, standbyExec } = setup(account());
      const result = await service.dispose('u-1', superadmin);
      expect(result.estado).toBe(EstadoCuenta.BAJA);
      expect(result.dadoDeBajaEn).toEqual(expect.any(String));
      expect(sessionsInTx.update).toHaveBeenCalled();
      expect(standbyExec).toHaveBeenCalled();
    });

    it('no da de baja a un médico con turnos futuros activos', async () => {
      const { service, usuarios } = setup(account(), { pendientes: 3 });
      await expect(service.dispose('u-1', superadmin)).rejects.toThrow('3 turnos pendientes');
      expect(usuarios.save).not.toHaveBeenCalled();
    });

    it('un enfermero se da de baja sin revisar turnos', async () => {
      const { service, turnosQuery } = setup(account({ rol: RolUsuario.ENFERMERO }));
      const result = await service.dispose('u-1', superadmin);
      expect(result.estado).toBe(EstadoCuenta.BAJA);
      expect(turnosQuery.getCount).not.toHaveBeenCalled();
    });

    it('protege al superadmin raíz, a uno mismo y a las bajas repetidas', async () => {
      await expect(
        setup(account({ esSuperadmin: true })).service.dispose('u-1', superadmin),
      ).rejects.toThrow('superadmin raíz');
      await expect(
        setup(account({ id: 'root' })).service.dispose('root', superadmin),
      ).rejects.toThrow('a vos mismo');
      await expect(
        setup(account({ estado: EstadoCuenta.BAJA })).service.dispose('u-1', superadmin),
      ).rejects.toThrow('ya está dada de baja');
    });

    it('una cuenta dada de baja no se puede modificar ni habilitar', async () => {
      const baja = account({ estado: EstadoCuenta.BAJA, dadoDeBajaEn: new Date() });
      const { service } = setup(baja);
      await expect(service.updateProfile('u-1', { nombre: 'X' }, superadmin)).rejects.toThrow('dada de baja');
      await expect(service.enableDoctor('u-1', superadmin)).rejects.toThrow('dada de baja');
      await expect(
        service.updateSchedule('u-1', { horaInicio: '08:00', horaFin: '16:00' }, superadmin),
      ).rejects.toThrow(ConflictException);
    });

    it('restaurar deja la cuenta DESHABILITADA, sin fecha de baja', async () => {
      const { service } = setup(account({ estado: EstadoCuenta.BAJA, dadoDeBajaEn: new Date() }));
      const result = await service.restore('u-1');
      expect(result.estado).toBe(EstadoCuenta.DESHABILITADO);
      expect(result.dadoDeBajaEn).toBeUndefined();
    });

    it('solo se restauran cuentas dadas de baja', async () => {
      await expect(setup(account()).service.restore('u-1')).rejects.toThrow('no está dada de baja');
    });
  });
});

describe('AccountAdminService — consulta, perfil, horario y habilitación', () => {
  const admin = actor();

  describe('consulta', () => {
    it('devuelve la cuenta pública sin el hash de la contraseña', async () => {
      const { service } = setup(account({ passwordHash: 'scrypt$secreto' } as Partial<Usuario>));
      const cuenta = await service.get('u-1');
      expect(cuenta).toMatchObject({ id: 'u-1', email: 'ada@x.com', rol: RolUsuario.MEDICO });
      expect(JSON.stringify(cuenta)).not.toContain('scrypt$secreto');
    });

    it('responde 404 cuando la cuenta no existe', async () => {
      const { service, usuarios } = setup(account());
      usuarios.findOneBy.mockResolvedValue(null);
      await expect(service.get('no-existe')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.deactivate('no-existe', admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('perfil', () => {
    it('recorta y guarda nombre y apellido', async () => {
      const { service, usuarios } = setup(account());
      const cuenta = await service.updateProfile('u-1', { nombre: '  Grace ', apellido: ' Hopper ' }, admin);
      expect(cuenta).toMatchObject({ nombre: 'Grace', apellido: 'Hopper' });
      expect(usuarios.save).toHaveBeenCalledTimes(1);
    });

    it('rechaza una actualización sin ningún campo', async () => {
      const { service, usuarios } = setup(account());
      await expect(service.updateProfile('u-1', {}, admin)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.updateProfile('u-1', { nombre: '   ' }, admin)).rejects.toBeInstanceOf(BadRequestException);
      expect(usuarios.save).not.toHaveBeenCalled();
    });

    it('no permite dejar vacío el nombre ni el apellido aunque el otro sea válido', async () => {
      const { service, usuarios } = setup(account());
      await expect(service.updateProfile('u-1', { nombre: ' ', apellido: 'Hopper' }, admin)).rejects.toThrow(
        'El nombre no puede quedar vacío.',
      );
      await expect(service.updateProfile('u-1', { nombre: 'Grace', apellido: ' ' }, admin)).rejects.toThrow(
        'El apellido no puede quedar vacío.',
      );
      expect(usuarios.save).not.toHaveBeenCalled();
    });

    it('el perfil del superadmin raíz no se modifica desde administración, ni siquiera por él mismo', async () => {
      const { service } = setup(account({ id: 'root', rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: true }));
      await expect(service.updateProfile('root', { nombre: 'Otro' }, superadmin)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('horario del médico', () => {
    it('guarda un horario válido dentro del horario de la clínica', async () => {
      const { service } = setup(account());
      const cuenta = await service.updateSchedule('u-1', { horaInicio: '08:00', horaFin: '20:00' }, admin);
      expect(cuenta).toMatchObject({ horaInicio: '08:00', horaFin: '20:00' });
    });

    it('solo los médicos tienen horario', async () => {
      const { service } = setup(account({ rol: RolUsuario.ENFERMERO }));
      await expect(service.updateSchedule('u-1', { horaInicio: '08:00', horaFin: '16:00' }, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it.each([
      ['empieza antes de las 08:00', '07:30', '16:00'],
      ['termina después de las 20:00', '08:00', '20:30'],
      ['el inicio no es anterior al fin', '16:00', '16:00'],
      ['el inicio es posterior al fin', '18:00', '10:00'],
    ])('rechaza el horario cuando %s', async (_caso, horaInicio, horaFin) => {
      const { service, usuarios } = setup(account());
      await expect(service.updateSchedule('u-1', { horaInicio, horaFin }, admin)).rejects.toBeInstanceOf(BadRequestException);
      expect(usuarios.save).not.toHaveBeenCalled();
    });

    it('un administrativo común no cambia el horario de una cuenta dada de baja', async () => {
      const { service } = setup(account({ estado: EstadoCuenta.BAJA }));
      await expect(service.updateSchedule('u-1', { horaInicio: '08:00', horaFin: '16:00' }, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('habilitación', () => {
    it.each([EstadoCuenta.PENDIENTE_HABILITACION, EstadoCuenta.DESHABILITADO])('habilita una cuenta verificada en estado %s', async (estado) => {
      const { service } = setup(account({ estado }));
      expect(await service.enableDoctor('u-1', admin)).toMatchObject({ estado: EstadoCuenta.ACTIVO });
    });

    it.each([
      ['el correo no está verificado', { estado: EstadoCuenta.PENDIENTE_HABILITACION, emailVerificado: false }],
      ['la cuenta ya está activa', { estado: EstadoCuenta.ACTIVO }],
      ['la cuenta espera verificación de correo', { estado: EstadoCuenta.PENDIENTE_VERIFICACION }],
    ])('no habilita cuando %s', async (_caso, over) => {
      const { service, usuarios } = setup(account(over as Partial<Usuario>));
      await expect(service.enableDoctor('u-1', admin)).rejects.toBeInstanceOf(ConflictException);
      expect(usuarios.save).not.toHaveBeenCalled();
    });
  });

  describe('deshabilitación', () => {
    it('nadie deshabilita al superadmin raíz, ni siquiera otro superadmin', async () => {
      const { service, usuarios, sesiones } = setup(account({ id: 'root', rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: true }));
      await expect(service.deactivate('root', admin)).rejects.toThrow('No se puede deshabilitar al superadmin raíz.');
      await expect(service.deactivate('root', actor({ accountId: 'otro-root', esSuperadmin: true }))).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usuarios.save).not.toHaveBeenCalled();
      expect(sesiones.update).not.toHaveBeenCalled();
    });
  });

  describe('alta de administrativos', () => {
    it('delega en AuthService', async () => {
      const auth = { createAdministrator: vi.fn(async () => ({ id: 'nuevo' })) };
      const service = new AccountAdminService({} as never, {} as never, auth as never, {} as never);
      const dto = { nombre: 'María', apellido: 'González', email: 'm@x.com', password: 'ClaveSegura135' };
      expect(await service.createAdministrator(dto)).toEqual({ id: 'nuevo' });
      expect(auth.createAdministrator).toHaveBeenCalledWith(dto);
    });
  });

  describe('baja lógica', () => {
    it('responde 404 si la cuenta desaparece antes de tomar el bloqueo', async () => {
      const { service } = setup(account());
      const sinCuenta = { getRepository: vi.fn(() => ({ findOne: vi.fn().mockResolvedValue(null) })) };
      (service as unknown as { dataSource: { transaction: unknown } }).dataSource.transaction = vi.fn((op: (m: unknown) => unknown) =>
        op(sinCuenta),
      );
      await expect(service.dispose('u-1', superadmin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
