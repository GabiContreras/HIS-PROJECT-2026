import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SnakeNamingStrategy } from '../src/config/snake-naming.strategy.js';
import { AdministracionMedicacion } from '../src/entities/administracion-medicacion.entity.js';
import { Cama } from '../src/entities/cama.entity.js';
import { Cargo } from '../src/entities/cargo.entity.js';
import { EntreturnoStandby } from '../src/entities/entreturno-standby.entity.js';
import { IndicacionMedica } from '../src/entities/indicacion-medica.entity.js';
import { Insumo } from '../src/entities/insumo.entity.js';
import { Internacion } from '../src/entities/internacion.entity.js';
import { Paciente } from '../src/entities/paciente.entity.js';
import { ProtocoloIngreso } from '../src/entities/protocolo-ingreso.entity.js';
import { RefreshSession } from '../src/entities/refresh-session.entity.js';
import { RegistroClinico } from '../src/entities/registro-clinico.entity.js';
import { SignoVital } from '../src/entities/signo-vital.entity.js';
import { TareaProtocolo } from '../src/entities/tarea-protocolo.entity.js';
import { EstadoTurno, Turno } from '../src/entities/turno.entity.js';
import { EstadoCuenta, RolUsuario, Usuario } from '../src/entities/usuario.entity.js';
import { AdmissionsModule } from '../src/modules/admissions/admissions.module.js';
import { NivelTriage } from '../src/modules/admissions/api/dto/crear-triage.dto.js';
import { TriageService } from '../src/modules/admissions/application/triage.service.js';
import { TurnosService } from '../src/modules/admissions/application/turnos.service.js';
import { BillingModule } from '../src/modules/billing/billing.module.js';
import { IamModule } from '../src/modules/iam/iam.module.js';
import type { SessionIdentity } from '../src/modules/iam/application/auth.service.js';
import { OutboxService } from '../src/shared/events/outbox/outbox.service.js';
import { SharedModule } from '../src/shared/shared.module.js';
import { assertLocalDatabaseUrl } from './helpers/assert-local-database-url.js';

const url = process.env.CARGO_URGENCIA_TEST_DATABASE_URL;
const EVENT_TYPE = 'admissions.appointment-attended';
const CONSUMER = 'billing.appointment-attended';

interface PrestacionRow {
  valor_base_pesos: number;
  copago_pesos: number;
}

interface TarifaRow {
  valor_pesos: number;
  copago_pesos: number | null;
}

interface FilaOutbox {
  id: string;
  status: string;
  delivered_consumers: string[];
  processed_at: Date | null;
}

interface FilaCargo {
  id: string;
  turno_id: string;
  tipo_atencion: string;
  estado: string;
  concepto: string | null;
  importe_pesos: number;
  tipo_cobertura: string | null;
  importe_paciente_pesos: number | null;
  importe_tercero_pesos: number | null;
}

type Cobertura = 'OBRA_SOCIAL_PUBLICA' | 'MEDICINA_PREPAGA' | 'PARTICULAR';

function repartoEsperado(cobertura: Cobertura, prestacion: PrestacionRow, tarifa: TarifaRow | null) {
  const total = tarifa ? tarifa.valor_pesos : prestacion.valor_base_pesos;
  const copago = tarifa && tarifa.copago_pesos !== null ? tarifa.copago_pesos : prestacion.copago_pesos;
  if (cobertura === 'OBRA_SOCIAL_PUBLICA') return { total, paciente: 0, tercero: total };
  if (cobertura === 'MEDICINA_PREPAGA') {
    const paciente = copago > total ? total : copago;
    return { total, paciente, tercero: total - paciente };
  }
  return { total, paciente: total, tercero: 0 };
}

describe('Guarda de base local del test de cargo de urgencia', () => {
  it('acepta localhost con his_fac10', () => {
    const url = 'postgresql://u:p@localhost:55432/his_fac10';
    expect(assertLocalDatabaseUrl(url)).toBe(url);
  });

  it('acepta 127.0.0.1 con his_x', () => {
    const url = 'postgresql://u:p@127.0.0.1:5432/his_x';
    expect(assertLocalDatabaseUrl(url)).toBe(url);
  });

  it('rechaza un host remoto, incluso si contiene la palabra localhost', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@db.ejemplo.supabase.co:5432/his_fac10')).toThrow(/PostgreSQL local/);
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost.ejemplo.com:5432/his_fac10')).toThrow(/PostgreSQL local/);
    expect(() => assertLocalDatabaseUrl('postgresql://localhost:p@db.ejemplo.com:5432/his_fac10')).toThrow(/PostgreSQL local/);
  });

  it('rechaza localhost con la base postgres del Supabase local', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).toThrow(/prefijo his_/);
  });

  it('rechaza una base sin el prefijo his_ o con el nombre vacío', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost:5432/otra_base')).toThrow(/prefijo his_/);
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost:5432/')).toThrow(/prefijo his_/);
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost:5432')).toThrow(/prefijo his_/);
  });

  it('rechaza una URL ausente', () => {
    expect(() => assertLocalDatabaseUrl(undefined)).toThrow(/falta la URL/);
  });

  it('rechaza una URL inválida', () => {
    expect(() => assertLocalDatabaseUrl('no es una url')).toThrow(/no es válida/);
  });
});

describe.skipIf(!url)('Cargo de urgencia de punta a punta (PostgreSQL local, Outbox real)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  let app: INestApplication;
  let db: DataSource;
  let turnos: TurnosService;
  let triage: TriageService;
  let outbox: OutboxService;
  let medicoId: string;
  let enfermeroId: string;
  let medicos = 0;
  let administrativo: SessionIdentity;
  let prestacionUrgencia: PrestacionRow;
  let prestacionRegular: PrestacionRow;
  let horario = 0;

  const created = {
    turnos: [] as string[],
    pacientes: [] as string[],
    financiadores: [] as string[],
    usuarios: [] as string[],
    triajes: [] as string[],
  };

  async function crearFinanciador(tipo: Cobertura, etiqueta: string): Promise<string> {
    const [fila] = await db.query<{ id: string }[]>(
      'INSERT INTO financiadores (nombre, tipo) VALUES ($1, $2) RETURNING id',
      [`Fac10 ${suffix} ${etiqueta}`, tipo],
    );
    created.financiadores.push(fila!.id);
    return fila!.id;
  }

  async function crearTarifa(
    financiadorId: string,
    codigo: string,
    valorPesos: number,
    copagoPesos: number | null,
  ): Promise<TarifaRow> {
    const [fila] = await db.query<TarifaRow[]>(
      `INSERT INTO tarifas (financiador_id, prestacion_id, valor_pesos, copago_pesos)
       SELECT $1, id, $3, $4 FROM prestaciones WHERE codigo = $2
       RETURNING valor_pesos, copago_pesos`,
      [financiadorId, codigo, valorPesos, copagoPesos],
    );
    return fila!;
  }

  async function crearPaciente(cobertura: Cobertura, financiadorId: string | null): Promise<string> {
    const [fila] = await db.query<{ id: string }[]>(
      `INSERT INTO pacientes (nombre, apellido, documento, fecha_nacimiento, tipo_cobertura, entidad_cobertura, financiador_id)
       VALUES ('Paciente', 'Fac10', $1, '1990-01-01', $2, $3, $4) RETURNING id`,
      [
        `F${randomUUID().replaceAll('-', '').slice(0, 19)}`,
        cobertura,
        cobertura === 'MEDICINA_PREPAGA' ? `Prepaga Fac10 ${suffix}` : null,
        financiadorId,
      ],
    );
    created.pacientes.push(fila!.id);
    return fila!.id;
  }

  async function crearMedico(etiqueta: string): Promise<SessionIdentity> {
    const [fila] = await db.query<{ id: string }[]>(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, estado, email_verificado)
       VALUES ('Medico', 'Fac10', $1, 'hash-solo-prueba', $2, $3, true) RETURNING id`,
      [`medico-fac10-${suffix}-${etiqueta}@example.test`, RolUsuario.MEDICO, EstadoCuenta.ACTIVO],
    );
    created.usuarios.push(fila!.id);
    return { accountId: fila!.id, sessionId: randomUUID(), rol: RolUsuario.MEDICO, esSuperadmin: false };
  }

  async function registrarTriaje(pacienteId: string): Promise<string> {
    const registro = await triage.registrarTriage(
      { pacienteId, nivel: NivelTriage.VERDE, motivoConsulta: 'Consulta de guardia Fac10' },
      enfermeroId,
    );
    created.triajes.push(registro.id);
    expect(registro.estado).toBe('EN_COLA');
    return registro.id;
  }

  async function atenderPorTriaje(pacienteId: string): Promise<{ triajeId: string; turnoId: string }> {
    medicos += 1;
    const medico = await crearMedico(`triaje-${medicos}`);
    const triajeId = await registrarTriaje(pacienteId);
    const respuesta = await triage.atender(triajeId, medico);
    expect(respuesta.estado).toBe('ATENDIDO');
    expect(respuesta.turnoId).toBeDefined();
    const registro = await db.query<{ estado: string }[]>('SELECT estado FROM triajes WHERE id = $1', [triajeId]);
    expect(registro).toEqual([{ estado: 'ATENDIDO' }]);
    const turnosCreados = await db.query<
      { id: string; urgente: boolean; estado: string; medico_id: string; paciente_id: string }[]
    >('SELECT id, urgente, estado, medico_id, paciente_id FROM turnos WHERE id = $1', [respuesta.turnoId]);
    expect(turnosCreados).toEqual([
      { id: respuesta.turnoId, urgente: true, estado: 'ATENDIDO', medico_id: medico.accountId, paciente_id: pacienteId },
    ]);
    return { triajeId, turnoId: respuesta.turnoId };
  }

  async function contarTurnosDelPaciente(pacienteId: string): Promise<number> {
    const [fila] = await db.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM turnos WHERE paciente_id = $1',
      [pacienteId],
    );
    return Number(fila!.total);
  }

  function siguienteHorario(minutosExtra: number): string {
    const inicio = new Date();
    inicio.setUTCDate(inicio.getUTCDate() + 1);
    inicio.setUTCHours(13, 0, 0, 0);
    inicio.setUTCMinutes(inicio.getUTCMinutes() + horario * 60 + minutosExtra);
    horario += 1;
    return inicio.toISOString();
  }

  async function crearTurnoUrgenteReservado(pacienteId: string): Promise<string> {
    const turno = await turnos.reserveUrgent(
      { medicoId, fechaHora: siguienteHorario(15), pacienteId },
      administrativo,
    );
    created.turnos.push(turno.id);
    expect(turno.urgente).toBe(true);
    return turno.id;
  }

  async function crearTurnoRegular(pacienteId: string): Promise<string> {
    const turno = await turnos.reserve(
      { medicoId, fechaHora: siguienteHorario(0), pacienteId },
      administrativo,
    );
    created.turnos.push(turno.id);
    expect(turno.urgente).toBe(false);
    return turno.id;
  }

  async function atenderTurno(turnoId: string): Promise<void> {
    await turnos.transition(turnoId, EstadoTurno.CONFIRMADO, administrativo);
    await turnos.transition(turnoId, EstadoTurno.EN_SALA_DE_ESPERA, administrativo);
    const atendido = await turnos.transition(turnoId, EstadoTurno.ATENDIDO, administrativo);
    expect(atendido.estado).toBe(EstadoTurno.ATENDIDO);
  }

  function filasOutbox(turnoId: string): Promise<FilaOutbox[]> {
    return db.query<FilaOutbox[]>(
      `SELECT id, status, delivered_consumers, processed_at FROM outbox_events
       WHERE event_type = $1 AND payload->>'appointmentId' = $2`,
      [EVENT_TYPE, turnoId],
    );
  }

  async function esperarEntrega(turnoId: string, procesadoAntesDe?: Date | null): Promise<FilaOutbox> {
    const limite = Date.now() + 20000;
    for (;;) {
      const filas = await filasOutbox(turnoId);
      const fila = filas[0];
      if (
        fila &&
        fila.status === 'PROCESADO' &&
        fila.delivered_consumers.includes(CONSUMER) &&
        (!procesadoAntesDe || (fila.processed_at && fila.processed_at > procesadoAntesDe))
      ) {
        return fila;
      }
      if (Date.now() > limite) {
        throw new Error(`El Outbox no entregó el evento del turno ${turnoId}: ${JSON.stringify(filas)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  function cargosDelTurno(turnoId: string): Promise<FilaCargo[]> {
    return db.query<FilaCargo[]>('SELECT * FROM cargos WHERE turno_id = $1', [turnoId]);
  }

  async function verificarCargoUrgencia(
    turnoId: string,
    cobertura: Cobertura,
    tarifa: TarifaRow | null,
  ): Promise<void> {
    await esperarEntrega(turnoId);
    const esperado = repartoEsperado(cobertura, prestacionUrgencia, tarifa);
    const cargos = await cargosDelTurno(turnoId);
    expect(cargos).toHaveLength(1);
    expect(cargos[0]).toMatchObject({
      turno_id: turnoId,
      tipo_atencion: 'URGENCIA',
      estado: 'PENDIENTE',
      concepto: null,
      importe_pesos: esperado.total,
      tipo_cobertura: cobertura,
      importe_paciente_pesos: esperado.paciente,
      importe_tercero_pesos: esperado.tercero,
    });
  }

  beforeAll(async () => {
    const databaseUrl = assertLocalDatabaseUrl(url);
    process.env.JWT_SECRET ??= randomUUID() + randomUUID();
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: databaseUrl,
          namingStrategy: new SnakeNamingStrategy(),
          entities: [
            Usuario, RefreshSession, Paciente, Turno, Cama, Insumo, SignoVital, IndicacionMedica,
            AdministracionMedicacion, Cargo, Internacion, EntreturnoStandby, ProtocoloIngreso,
            TareaProtocolo, RegistroClinico,
          ],
          autoLoadEntities: true,
          synchronize: false,
          ssl: false,
        }),
        SharedModule,
        IamModule,
        AdmissionsModule,
        BillingModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    db = app.get(DataSource);
    turnos = app.get(TurnosService);
    triage = app.get(TriageService);
    outbox = app.get(OutboxService);

    const [medico] = await db.query<{ id: string }[]>(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, estado, email_verificado)
       VALUES ('Medico', 'Fac10', $1, 'hash-solo-prueba', $2, $3, true) RETURNING id`,
      [`medico-fac10-${suffix}@example.test`, RolUsuario.MEDICO, EstadoCuenta.ACTIVO],
    );
    const [admin] = await db.query<{ id: string }[]>(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, estado, email_verificado)
       VALUES ('Admin', 'Fac10', $1, 'hash-solo-prueba', $2, $3, true) RETURNING id`,
      [`admin-fac10-${suffix}@example.test`, RolUsuario.ADMINISTRATIVO, EstadoCuenta.ACTIVO],
    );
    const [enfermero] = await db.query<{ id: string }[]>(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, estado, email_verificado)
       VALUES ('Enfermero', 'Fac10', $1, 'hash-solo-prueba', $2, $3, true) RETURNING id`,
      [`enfermero-fac10-${suffix}@example.test`, RolUsuario.ENFERMERO, EstadoCuenta.ACTIVO],
    );
    medicoId = medico!.id;
    enfermeroId = enfermero!.id;
    created.usuarios.push(medico!.id, admin!.id, enfermero!.id);
    administrativo = {
      accountId: admin!.id,
      sessionId: randomUUID(),
      rol: RolUsuario.ADMINISTRATIVO,
      esSuperadmin: false,
    };

    [prestacionUrgencia] = await db.query<PrestacionRow[]>(
      `SELECT valor_base_pesos, copago_pesos FROM prestaciones WHERE codigo = 'CONSULTA_URGENCIA'`,
    );
    [prestacionRegular] = await db.query<PrestacionRow[]>(
      `SELECT valor_base_pesos, copago_pesos FROM prestaciones WHERE codigo = 'CONSULTA_REGULAR'`,
    );
  }, 60000);

  afterAll(async () => {
    if (!app) return;
    try {
      const turnoIds = (
        await db.query<{ id: string }[]>(
          'SELECT id FROM turnos WHERE paciente_id = ANY($1) OR medico_id = ANY($2)',
          [created.pacientes, created.usuarios],
        )
      ).map((fila) => fila.id);
      if (turnoIds.length) {
        await db.query('DELETE FROM cargos WHERE turno_id = ANY($1)', [turnoIds]);
        await db.query(
          `DELETE FROM outbox_events WHERE event_type = $1 AND payload->>'appointmentId' = ANY($2)`,
          [EVENT_TYPE, turnoIds],
        );
        await db.query('DELETE FROM turnos WHERE id = ANY($1)', [turnoIds]);
      }
      if (created.triajes.length) {
        await db.query('DELETE FROM triajes WHERE id = ANY($1)', [created.triajes]);
      }
      if (created.usuarios.length) {
        await db.query('DELETE FROM notificaciones WHERE destinatario_id = ANY($1)', [created.usuarios]);
      }
      if (created.pacientes.length) {
        await db.query('DELETE FROM pacientes WHERE id = ANY($1)', [created.pacientes]);
      }
      if (created.financiadores.length) {
        await db.query('DELETE FROM tarifas WHERE financiador_id = ANY($1)', [created.financiadores]);
        await db.query('DELETE FROM financiadores WHERE id = ANY($1)', [created.financiadores]);
      }
      if (created.usuarios.length) {
        await db.query('DELETE FROM usuarios WHERE id = ANY($1)', [created.usuarios]);
      }
    } finally {
      await app.close();
    }
  }, 60000);

  it('triaje, obra social pública con tarifa activa: el paciente paga 0 y el tercero cubre el total de la tarifa', async () => {
    const financiadorId = await crearFinanciador('OBRA_SOCIAL_PUBLICA', 'PUB');
    const tarifa = await crearTarifa(financiadorId, 'CONSULTA_URGENCIA', 31000, null);
    expect(tarifa.valor_pesos).not.toBe(prestacionUrgencia.valor_base_pesos);
    const { turnoId } = await atenderPorTriaje(await crearPaciente('OBRA_SOCIAL_PUBLICA', financiadorId));
    await verificarCargoUrgencia(turnoId, 'OBRA_SOCIAL_PUBLICA', tarifa);
  }, 40000);

  it('triaje, obra social pública sin tarifa: usa el valor base de la prestación', async () => {
    const financiadorId = await crearFinanciador('OBRA_SOCIAL_PUBLICA', 'PUB-SIN-TARIFA');
    const { turnoId } = await atenderPorTriaje(await crearPaciente('OBRA_SOCIAL_PUBLICA', financiadorId));
    await verificarCargoUrgencia(turnoId, 'OBRA_SOCIAL_PUBLICA', null);
  }, 40000);

  it('triaje, prepaga con tarifa que fija valor y copago: el paciente paga el copago de la tarifa', async () => {
    const financiadorId = await crearFinanciador('MEDICINA_PREPAGA', 'PREPAGA-TARIFA');
    const tarifa = await crearTarifa(financiadorId, 'CONSULTA_URGENCIA', 28000, 4500);
    const { turnoId } = await atenderPorTriaje(await crearPaciente('MEDICINA_PREPAGA', financiadorId));
    await verificarCargoUrgencia(turnoId, 'MEDICINA_PREPAGA', tarifa);
  }, 40000);

  it('triaje, prepaga con tarifa sin copago propio: el copago sale de la prestación', async () => {
    const financiadorId = await crearFinanciador('MEDICINA_PREPAGA', 'PREPAGA-TARIFA-SIN-COPAGO');
    const tarifa = await crearTarifa(financiadorId, 'CONSULTA_URGENCIA', 27000, null);
    const { turnoId } = await atenderPorTriaje(await crearPaciente('MEDICINA_PREPAGA', financiadorId));
    await verificarCargoUrgencia(turnoId, 'MEDICINA_PREPAGA', tarifa);
  }, 40000);

  it('triaje, prepaga sin tarifa: usa el valor base y el copago de la prestación', async () => {
    const financiadorId = await crearFinanciador('MEDICINA_PREPAGA', 'PREPAGA-SIN-TARIFA');
    const { turnoId } = await atenderPorTriaje(await crearPaciente('MEDICINA_PREPAGA', financiadorId));
    await verificarCargoUrgencia(turnoId, 'MEDICINA_PREPAGA', null);
  }, 40000);

  it('triaje, prepaga con copago mayor al total: el copago se acota al total y el tercero paga 0', async () => {
    const financiadorId = await crearFinanciador('MEDICINA_PREPAGA', 'PREPAGA-COPAGO-ALTO');
    const tarifa = await crearTarifa(financiadorId, 'CONSULTA_URGENCIA', 2000, 5000);
    const { turnoId } = await atenderPorTriaje(await crearPaciente('MEDICINA_PREPAGA', financiadorId));
    await verificarCargoUrgencia(turnoId, 'MEDICINA_PREPAGA', tarifa);
    const [cargo] = await cargosDelTurno(turnoId);
    expect(cargo).toMatchObject({ importe_paciente_pesos: 2000, importe_tercero_pesos: 0 });
  }, 40000);

  it('triaje, particular: el paciente paga el total y el tercero 0', async () => {
    const { turnoId } = await atenderPorTriaje(await crearPaciente('PARTICULAR', null));
    await verificarCargoUrgencia(turnoId, 'PARTICULAR', null);
  }, 40000);

  it('turno urgente reservado a mano y atendido por transiciones: genera el mismo cargo de urgencia', async () => {
    const turnoId = await crearTurnoUrgenteReservado(await crearPaciente('PARTICULAR', null));
    await atenderTurno(turnoId);
    await verificarCargoUrgencia(turnoId, 'PARTICULAR', null);
  }, 40000);

  it('la reentrega del mismo evento no duplica el cargo', async () => {
    const { turnoId } = await atenderPorTriaje(await crearPaciente('PARTICULAR', null));
    const primera = await esperarEntrega(turnoId);
    const [cargoOriginal] = await cargosDelTurno(turnoId);
    expect(cargoOriginal).toBeDefined();

    await db.query(
      `UPDATE outbox_events
       SET status = 'PENDIENTE', delivered_consumers = '{}', processed_at = NULL,
           next_attempt_at = now() - interval '1 second'
       WHERE id = $1`,
      [primera.id],
    );
    await outbox.processDue();
    const segunda = await esperarEntrega(turnoId);

    expect(segunda.id).toBe(primera.id);
    expect(segunda.processed_at!.getTime()).toBeGreaterThan(primera.processed_at!.getTime());
    const cargos = await cargosDelTurno(turnoId);
    expect(cargos).toHaveLength(1);
    expect(cargos[0]!.id).toBe(cargoOriginal!.id);
  }, 40000);

  it('atender dos veces el mismo triaje responde conflicto y no duplica turno ni cargo', async () => {
    const pacienteId = await crearPaciente('PARTICULAR', null);
    const medico = await crearMedico('doble-atencion');
    const triajeId = await registrarTriaje(pacienteId);
    const primera = await triage.atender(triajeId, medico);
    await esperarEntrega(primera.turnoId);

    await expect(triage.atender(triajeId, medico)).rejects.toBeInstanceOf(ConflictException);

    expect(await contarTurnosDelPaciente(pacienteId)).toBe(1);
    expect(await cargosDelTurno(primera.turnoId)).toHaveLength(1);
    expect(await filasOutbox(primera.turnoId)).toHaveLength(1);
  }, 40000);

  it('dos atender simultáneos del mismo triaje: uno crea turno y cargo, el otro falla con conflicto', async () => {
    const pacienteId = await crearPaciente('PARTICULAR', null);
    const medico = await crearMedico('concurrente');
    const triajeId = await registrarTriaje(pacienteId);

    const resultados = await Promise.allSettled([
      triage.atender(triajeId, medico),
      triage.atender(triajeId, medico),
    ]);
    const exitos = resultados.filter((r) => r.status === 'fulfilled');
    const fallos = resultados.filter((r) => r.status === 'rejected');
    expect(exitos).toHaveLength(1);
    expect(fallos).toHaveLength(1);
    expect((fallos[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    const turnoId = (exitos[0] as PromiseFulfilledResult<{ turnoId: string }>).value.turnoId;
    await esperarEntrega(turnoId);
    expect(await contarTurnosDelPaciente(pacienteId)).toBe(1);
    expect(await cargosDelTurno(turnoId)).toHaveLength(1);
  }, 40000);

  it('atender un triaje inexistente responde 404 y no crea turnos ni eventos', async () => {
    const medico = await crearMedico('inexistente');
    const eventosAntes = await db.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM outbox_events WHERE event_type = $1',
      [EVENT_TYPE],
    );

    await expect(triage.atender(randomUUID(), medico)).rejects.toBeInstanceOf(NotFoundException);

    const turnosDelMedico = await db.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM turnos WHERE medico_id = $1',
      [medico.accountId],
    );
    expect(Number(turnosDelMedico[0]!.total)).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const eventosDespues = await db.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM outbox_events WHERE event_type = $1',
      [EVENT_TYPE],
    );
    expect(eventosDespues[0]!.total).toBe(eventosAntes[0]!.total);
  }, 40000);

  it('control: un turno no urgente atendido genera un cargo regular con su importe', async () => {
    const turnoId = await crearTurnoRegular(await crearPaciente('PARTICULAR', null));
    await atenderTurno(turnoId);
    await esperarEntrega(turnoId);
    const esperado = repartoEsperado('PARTICULAR', prestacionRegular, null);
    const cargos = await cargosDelTurno(turnoId);
    expect(cargos).toHaveLength(1);
    expect(cargos[0]).toMatchObject({
      tipo_atencion: 'REGULAR',
      estado: 'PENDIENTE',
      importe_pesos: esperado.total,
      importe_paciente_pesos: esperado.paciente,
      importe_tercero_pesos: esperado.tercero,
    });
  }, 40000);

  it('un turno urgente cancelado no genera evento ni cargo', async () => {
    const turnoId = await crearTurnoUrgenteReservado(await crearPaciente('PARTICULAR', null));
    const cancelado = await turnos.transition(turnoId, EstadoTurno.CANCELADO, administrativo);
    expect(cancelado.estado).toBe(EstadoTurno.CANCELADO);
    await outbox.processDue();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await filasOutbox(turnoId)).toHaveLength(0);
    expect(await cargosDelTurno(turnoId)).toHaveLength(0);
  }, 40000);
});
