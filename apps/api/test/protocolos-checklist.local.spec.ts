import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
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
import { Turno } from '../src/entities/turno.entity.js';
import { Usuario } from '../src/entities/usuario.entity.js';
import { ProtocolosTypeOrmRepository } from '../src/modules/nursing/infrastructure/protocolos.typeorm.repository.js';

// Requiere un Postgres LOCAL ya migrado y con al menos 2 usuarios y 1 paciente.
// Se activa con CHECKLIST_TEST_DATABASE_URL (por ejemplo postgres://postgres:***@localhost:55432/his_browser); sin ella se omite.
const url = process.env.CHECKLIST_TEST_DATABASE_URL;

describe.skipIf(!url)('ProtocolosTypeOrmRepository - marca original del checklist (PostgreSQL local)', () => {
  let dataSource: DataSource;
  let repository: ProtocolosTypeOrmRepository;
  let pacienteId: string;
  let enfermeraA: string;
  let enfermeraB: string;
  let protocoloId: string;
  let tareaId: string;

  beforeAll(async () => {
    const host = new URL(url!).hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      throw new Error('Esta prueba escribe datos y solo puede ejecutarse contra una base local.');
    }
    dataSource = new DataSource({
      type: 'postgres',
      url,
      ssl: false,
      synchronize: false,
      namingStrategy: new SnakeNamingStrategy(),
      entities: [
        Usuario, RefreshSession, Paciente, Turno, Cama, Insumo, SignoVital, IndicacionMedica,
        AdministracionMedicacion, Cargo, Internacion, EntreturnoStandby, ProtocoloIngreso, TareaProtocolo, RegistroClinico,
      ],
    });
    await dataSource.initialize();
    repository = new ProtocolosTypeOrmRepository(
      dataSource.getRepository(ProtocoloIngreso),
      dataSource.getRepository(TareaProtocolo),
    );

    const usuarios = await dataSource.getRepository(Usuario).find({ take: 2, order: { id: 'ASC' } });
    const paciente = await dataSource.getRepository(Paciente).findOne({ where: {}, order: { id: 'ASC' } });
    if (usuarios.length < 2 || !paciente) throw new Error('La base local necesita al menos 2 usuarios y 1 paciente.');
    [enfermeraA, enfermeraB] = [usuarios[0]!.id, usuarios[1]!.id];
    pacienteId = paciente.id;

    const { protocolo } = await repository.crearSiNoExiste({
      ingresoId: randomUUID(),
      pacienteId,
      tipo: 'PRE_QUIRURGICO',
      motivoIngreso: 'prueba checklist',
      tareas: [{ orden: 1, descripcion: 'Tarea de prueba', frecuenciaHoras: null }],
    });
    protocoloId = protocolo.id;
    tareaId = protocolo.tareas[0]!.id;
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    if (protocoloId) await dataSource.getRepository(ProtocoloIngreso).delete({ id: protocoloId });
    await dataSource.destroy();
  });

  it('la primera marca guarda quién y cuándo; una segunda marca de otra persona no la pisa', async () => {
    const primera = await repository.marcarTarea(protocoloId, tareaId, true, enfermeraA);
    const tareaPrimera = primera!.tareas[0]!;
    expect(tareaPrimera.hecha).toBe(true);
    expect(tareaPrimera.hechaEn).toBeInstanceOf(Date);
    expect(tareaPrimera.hechaPor).not.toBeNull();

    const segunda = await repository.marcarTarea(protocoloId, tareaId, true, enfermeraB);
    const tareaSegunda = segunda!.tareas[0]!;
    expect(tareaSegunda.hecha).toBe(true);
    expect(tareaSegunda.hechaPor).toBe(tareaPrimera.hechaPor);
    expect(tareaSegunda.hechaEn!.getTime()).toBe(tareaPrimera.hechaEn!.getTime());
  });

  it('desmarcar limpia la marca y permite que otra persona la vuelva a marcar', async () => {
    const desmarcada = await repository.marcarTarea(protocoloId, tareaId, false, enfermeraA);
    expect(desmarcada!.tareas[0]).toMatchObject({ hecha: false, hechaEn: null, hechaPor: null });

    const remarcada = await repository.marcarTarea(protocoloId, tareaId, true, enfermeraB);
    expect(remarcada!.tareas[0]!.hecha).toBe(true);
    expect(remarcada!.tareas[0]!.hechaPor).not.toBeNull();
  });

  it('devuelve null si la tarea no existe o es de otro protocolo', async () => {
    expect(await repository.marcarTarea(protocoloId, randomUUID(), true, enfermeraA)).toBeNull();
    expect(await repository.marcarTarea(randomUUID(), tareaId, true, enfermeraA)).toBeNull();
  });

  it('marcar y desmarcar son idempotentes', async () => {
    await repository.marcarTarea(protocoloId, tareaId, false, enfermeraA);
    const otra = await repository.marcarTarea(protocoloId, tareaId, false, enfermeraA);
    expect(otra!.tareas[0]).toMatchObject({ hecha: false, hechaEn: null, hechaPor: null });
  });
});
