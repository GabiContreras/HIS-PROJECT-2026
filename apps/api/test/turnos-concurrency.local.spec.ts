import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource, In } from 'typeorm';
import { Paciente } from '../src/entities/paciente.entity.js';
import { Turno, EstadoTurno } from '../src/entities/turno.entity.js';
import { Usuario, RolUsuario, EstadoCuenta } from '../src/entities/usuario.entity.js';
import { TurnosService } from '../src/modules/admissions/application/turnos.service.js';

const enabled = process.env.RUN_LOCAL_CONCURRENCY_TEST === 'true';

describe.skipIf(!enabled)('Concurrencia real de turnos (solo BD local)', () => {
  let db: DataSource;
  let service: TurnosService;
  const created = {
    turnos: [] as string[],
    pacientes: [] as string[],
    usuarios: [] as string[],
  };

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL.');
    const parsed = new URL(url);
    if (
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    ) {
      throw new Error('SEGURIDAD: la prueba solo admite PostgreSQL local.');
    }
    if (decodeURIComponent(parsed.pathname.replace(/^\//, '')) !== 'his_admissions_test') {
      throw new Error('SEGURIDAD: la prueba solo admite his_admissions_test.');
    }

    db = new DataSource({
      type: 'postgres',
      url,
      entities: [Usuario, Paciente, Turno],
      synchronize: false,
      ssl: false,
    });
    await db.initialize();

    service = new TurnosService(
      db.getRepository(Turno),
      db.getRepository(Usuario),
      db.getRepository(Paciente),
      db,
    );
  }, 30000);

  afterAll(async () => {
    if (!db?.isInitialized) return;
    try {
      if (created.turnos.length) {
        await db.getRepository(Turno).delete({ id: In(created.turnos) });
      }
      if (created.pacientes.length) {
        await db.getRepository(Paciente).delete({ id: In(created.pacientes) });
      }
      if (created.usuarios.length) {
        await db.getRepository(Usuario).delete({ id: In(created.usuarios) });
      }
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  }, 30000);

  it('permite solo una de dos reservas superpuestas del mismo médico', async () => {
    const suffix = randomUUID();
    const usuarios = db.getRepository(Usuario);
    const pacientes = db.getRepository(Paciente);
    const turnos = db.getRepository(Turno);

    const doctor = await usuarios.save(usuarios.create({
      nombre: 'Medico',
      apellido: 'PruebaConcurrencia',
      email: `medico-${suffix}@example.test`,
      passwordHash: 'hash-solo-prueba',
      rol: RolUsuario.MEDICO,
      estado: EstadoCuenta.ACTIVO,
      emailVerificado: true,
    }));
    created.usuarios.push(doctor.id);

    const pacienteA = await pacientes.save(pacientes.create({
      nombre: 'PacienteA',
      apellido: 'PruebaConcurrencia',
      documento: `A${suffix.replaceAll('-', '').slice(0, 19)}`,
      fechaNacimiento: '1990-01-01',
      telefono: null,
    }));
    created.pacientes.push(pacienteA.id);

    const pacienteB = await pacientes.save(pacientes.create({
      nombre: 'PacienteB',
      apellido: 'PruebaConcurrencia',
      documento: `B${suffix.replaceAll('-', '').slice(0, 19)}`,
      fechaNacimiento: '1991-01-01',
      telefono: null,
    }));
    created.pacientes.push(pacienteB.id);

    // Dos turnos futuros que se superponen por 15 minutos.
    const inicio = new Date(Date.now() + 4 * 60 * 60 * 1000);
    inicio.setSeconds(0, 0);
    const segundoInicio = new Date(inicio.getTime() + 15 * 60 * 1000);

    const turnoA = await turnos.save(turnos.create({
      medico: doctor,
      paciente: null,
      fechaHora: inicio,
      duracionMinutos: 30,
      urgente: false,
      estado: EstadoTurno.DISPONIBLE,
    }));
    created.turnos.push(turnoA.id);

    const turnoB = await turnos.save(turnos.create({
      medico: doctor,
      paciente: null,
      fechaHora: segundoInicio,
      duracionMinutos: 30,
      urgente: false,
      estado: EstadoTurno.DISPONIBLE,
    }));
    created.turnos.push(turnoB.id);

    const identity = {
      accountId: doctor.id,
      sessionId: randomUUID(),
      rol: RolUsuario.MEDICO,
      esSuperadmin: false,
    };

    const resultados = await Promise.allSettled([
      service.reserve(turnoA.id, { pacienteId: pacienteA.id }, identity),
      service.reserve(turnoB.id, { pacienteId: pacienteB.id }, identity),
    ]);

    const exitos = resultados.filter((r) => r.status === 'fulfilled');
    const fallos = resultados.filter((r) => r.status === 'rejected');

    expect(exitos).toHaveLength(1);
    expect(fallos).toHaveLength(1);

    const guardados = await turnos.find({
      where: [
        { id: turnoA.id, estado: EstadoTurno.RESERVADO },
        { id: turnoB.id, estado: EstadoTurno.RESERVADO },
      ],
    });
    expect(guardados).toHaveLength(1);
  }, 30000);
});
