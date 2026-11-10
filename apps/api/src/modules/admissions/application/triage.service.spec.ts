import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EstadoTriaje } from '../../../entities/triaje.entity.js';
import { EstadoCuenta, RolUsuario } from '../../../entities/usuario.entity.js';
import { NivelTriage } from '../api/dto/crear-triage.dto.js';
import { TriageService } from './triage.service.js';

const PACIENTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const MEDICO_ID = '550e8400-e29b-41d4-a716-446655440001';
const ENFERMERO_ID = '550e8400-e29b-41d4-a716-446655440002';
const paciente = { id: PACIENTE_ID, nombre: 'Carlos', apellido: 'López' };

function build() {
  const qb = {
    innerJoinAndSelect: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    getMany: vi.fn().mockResolvedValue([]),
  };
  qb.innerJoinAndSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.addOrderBy.mockReturnValue(qb);

  const triajeRepo = {
    create: vi.fn((v) => v),
    save: vi.fn(async (v) => ({ id: 't1', estado: EstadoTriaje.EN_COLA, llegadaAt: new Date(), ...v })),
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(() => qb),
  };
  const usuarioRepo = { findOneBy: vi.fn().mockResolvedValue({ id: MEDICO_ID }) };
  const pacientes = { get: vi.fn().mockResolvedValue(paciente) };
  const notificaciones = {
    notificarUsuarios: vi.fn().mockResolvedValue(undefined),
    notificarPorRol: vi.fn().mockResolvedValue(undefined),
  };
  const service = new TriageService(triajeRepo as never, usuarioRepo as never, pacientes as never, notificaciones as never);
  return { service, qb, triajeRepo, usuarioRepo, pacientes, notificaciones };
}

const dto = (over = {}) => ({ pacienteId: PACIENTE_ID, nivel: NivelTriage.AMARILLO, motivoConsulta: 'Fiebre', ...over });

describe('TriageService', () => {
  describe('obtenerCola', () => {
    it('consulta solo EN_COLA y ordena en la base: nivel (ROJO primero) y luego llegada', async () => {
      const { service, qb } = build();
      await service.obtenerCola();
      expect(qb.where).toHaveBeenCalledWith('t.estado = :estado', { estado: EstadoTriaje.EN_COLA });
      const orden = qb.orderBy.mock.calls[0][0] as string;
      const posiciones = ['ROJO', 'NARANJA', 'AMARILLO', 'VERDE'].map((n) => orden.indexOf(`'${n}'`));
      expect(posiciones.every((p) => p > -1)).toBe(true);
      expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
      expect(qb.addOrderBy).toHaveBeenCalledWith('t.llegadaAt', 'ASC');
    });

    it('devuelve el formato de respuesta con "Apellido, Nombre"', async () => {
      const { service, qb } = build();
      const llegadaAt = new Date();
      qb.getMany.mockResolvedValue([
        { id: 't1', pacienteId: PACIENTE_ID, paciente, motivoConsulta: 'Dolor', nivel: NivelTriage.ROJO, estado: EstadoTriaje.EN_COLA, llegadaAt },
      ]);
      expect(await service.obtenerCola()).toEqual([
        { id: 't1', pacienteId: PACIENTE_ID, paciente: 'López, Carlos', motivo: 'Dolor', nivel: NivelTriage.ROJO, estado: EstadoTriaje.EN_COLA, llegadaAt },
      ]);
    });
  });

  describe('registrarTriage', () => {
    it('responde 404 si el paciente no existe y no guarda nada', async () => {
      const { service, pacientes, triajeRepo } = build();
      pacientes.get.mockRejectedValue(new NotFoundException());
      await expect(service.registrarTriage(dto(), ENFERMERO_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(triajeRepo.save).not.toHaveBeenCalled();
    });

    it('responde 404 si el médico destino no existe, no es médico o no está activo', async () => {
      const { service, usuarioRepo, triajeRepo } = build();
      usuarioRepo.findOneBy.mockResolvedValue(null);
      await expect(service.registrarTriage(dto({ medicoDestinoId: MEDICO_ID }), ENFERMERO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(usuarioRepo.findOneBy).toHaveBeenCalledWith({
        id: MEDICO_ID,
        rol: RolUsuario.MEDICO,
        estado: EstadoCuenta.ACTIVO,
      });
      expect(triajeRepo.save).not.toHaveBeenCalled();
    });

    it('guarda el registro con quién lo registró', async () => {
      const { service, triajeRepo } = build();
      const res = await service.registrarTriage(dto(), ENFERMERO_ID);
      expect(triajeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ pacienteId: PACIENTE_ID, registradoPorId: ENFERMERO_ID, medicoDestinoId: null }),
      );
      expect(res).toMatchObject({ id: 't1', paciente: 'López, Carlos', motivo: 'Fiebre', estado: EstadoTriaje.EN_COLA });
    });

    it('ROJO con médico destino: notifica solo a ese médico con prioridad ALTA', async () => {
      const { service, notificaciones } = build();
      await service.registrarTriage(dto({ nivel: NivelTriage.ROJO, medicoDestinoId: MEDICO_ID }), ENFERMERO_ID);
      expect(notificaciones.notificarUsuarios).toHaveBeenCalledWith(
        [MEDICO_ID],
        expect.objectContaining({ tipo: 'TRIAGE_RIESGO_VITAL', prioridad: 'ALTA' }),
      );
      expect(notificaciones.notificarPorRol).not.toHaveBeenCalled();
    });

    it('ROJO sin médico destino: notifica a los médicos por rol', async () => {
      const { service, notificaciones } = build();
      await service.registrarTriage(dto({ nivel: NivelTriage.ROJO }), ENFERMERO_ID);
      expect(notificaciones.notificarPorRol).toHaveBeenCalledWith(
        RolUsuario.MEDICO,
        expect.objectContaining({ tipo: 'TRIAGE_RIESGO_VITAL', prioridad: 'ALTA' }),
      );
      expect(notificaciones.notificarUsuarios).not.toHaveBeenCalled();
    });

    it.each([NivelTriage.NARANJA, NivelTriage.AMARILLO, NivelTriage.VERDE, NivelTriage.AZUL])(
      'el nivel %s no notifica',
      async (nivel) => {
        const { service, notificaciones } = build();
        await service.registrarTriage(dto({ nivel, medicoDestinoId: MEDICO_ID }), ENFERMERO_ID);
        expect(notificaciones.notificarUsuarios).not.toHaveBeenCalled();
        expect(notificaciones.notificarPorRol).not.toHaveBeenCalled();
      },
    );
  });

  describe('atender', () => {
    it('responde 404 si el triaje no existe', async () => {
      const { service, triajeRepo } = build();
      triajeRepo.findOne.mockResolvedValue(null);
      await expect(service.atender('t1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('responde 409 si ya estaba atendido', async () => {
      const { service, triajeRepo } = build();
      triajeRepo.findOne.mockResolvedValue({ id: 't1', estado: EstadoTriaje.ATENDIDO, paciente });
      await expect(service.atender('t1')).rejects.toBeInstanceOf(ConflictException);
      expect(triajeRepo.save).not.toHaveBeenCalled();
    });

    it('marca como atendido y registra la hora', async () => {
      const { service, triajeRepo } = build();
      triajeRepo.findOne.mockResolvedValue({ id: 't1', estado: EstadoTriaje.EN_COLA, paciente, nivel: NivelTriage.VERDE });
      const res = await service.atender('t1');
      expect(res.estado).toBe(EstadoTriaje.ATENDIDO);
      expect(triajeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoTriaje.ATENDIDO, atendidoAt: expect.any(Date) }),
      );
    });
  });
});
