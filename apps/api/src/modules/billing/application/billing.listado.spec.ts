import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Cargo } from '../../../entities/cargo.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import { EstadoCargo } from '../domain/estado-cargo.js';
import { TipoAtencionFacturable } from '../domain/tipo-atencion-facturable.js';
import { BillingService } from './billing.service.js';

type Lote = { entities: Cargo[]; raw: Array<{ cursor_creado: string }> };

function crearConsulta(
  resultado: { cargos?: Cargo[]; total?: number },
  lotes: Lote[],
) {
  const consulta = {
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(resultado.cargos ?? []),
    getCount: vi.fn().mockResolvedValue(resultado.total ?? 0),
    getRawAndEntities: vi.fn(async () => lotes.shift() ?? { entities: [], raw: [] }),
  };
  return consulta;
}

function crearServicio(
  resultado: { cargos?: Cargo[]; total?: number; lotes?: Lote[] },
  turnos: Array<Partial<Turno>> = [],
  datos: {
    internaciones?: Array<{ id: string; pacienteId: string }>;
    administraciones?: Array<{ administrationId: string; pacienteId: string }>;
    pacientes?: Array<{ id: string; nombre: string; apellido: string; documento: string }>;
  } = {},
) {
  const lotes = [...(resultado.lotes ?? [])];
  const consultas: Array<ReturnType<typeof crearConsulta>> = [];
  const buscarInternaciones = vi.fn().mockResolvedValue(datos.internaciones ?? []);
  const consultaAdministraciones = {
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(datos.administraciones ?? []),
  };
  const repositorioAdministraciones = {
    createQueryBuilder: vi.fn(() => consultaAdministraciones),
  };
  const repositorioPacientes = { find: vi.fn().mockResolvedValue(datos.pacientes ?? []) };
  const repositorioCargos = {
    manager: { getRepository: vi.fn(() => ({ find: buscarInternaciones })) },
    createQueryBuilder: vi.fn(() => {
      const consulta = crearConsulta(resultado, lotes);
      consultas.push(consulta);
      return consulta;
    }),
  };
  const repositorioTurnos = { find: vi.fn().mockResolvedValue(turnos) };
  const servicio = Object.create(BillingService.prototype) as BillingService;
  Object.assign(servicio, {
    cargos: repositorioCargos,
    turnos: repositorioTurnos,
    administraciones: repositorioAdministraciones,
    pacientes: repositorioPacientes,
  });
  return {
    servicio,
    consultas,
    repositorioCargos,
    repositorioTurnos,
    repositorioAdministraciones,
    repositorioPacientes,
    buscarInternaciones,
  };
}

const cargo = (id: string, cambios: Partial<Cargo> = {}): Cargo =>
  ({
    id,
    turnoId: null,
    administrationId: null,
    internacionId: null,
    concepto: null,
    importePesos: 15000,
    tipoAtencion: TipoAtencionFacturable.REGULAR,
    tipoCobertura: null,
    entidadCobertura: null,
    importePacientePesos: null,
    importeTerceroPesos: null,
    estado: EstadoCargo.PENDIENTE,
    createdAt: new Date('2026-03-10T15:30:00.000Z'),
    ...cambios,
  }) as Cargo;

const condiciones = (consulta: ReturnType<typeof crearConsulta>) =>
  consulta.andWhere.mock.calls.map(([sql]) => String(sql));

describe('BillingService.list', () => {
  it('devuelve items, total, limit y offset', async () => {
    const { servicio } = crearServicio({ cargos: [cargo('a'), cargo('b')], total: 7 });

    const pagina = await servicio.list({}, 2, 4);

    expect(pagina.total).toBe(7);
    expect(pagina.limit).toBe(2);
    expect(pagina.offset).toBe(4);
    expect(pagina.items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('pagina y ordena en SQL con created_at descendente y desempate por id', async () => {
    const { servicio, consultas } = crearServicio({ cargos: [cargo('a')], total: 1 });

    await servicio.list({}, 25, 50);

    const paginada = consultas.find((consulta) => consulta.getMany.mock.calls.length > 0)!;
    expect(paginada.offset).toHaveBeenCalledWith(50);
    expect(paginada.limit).toHaveBeenCalledWith(25);
    expect(paginada.orderBy).toHaveBeenCalledWith('c.createdAt', 'DESC');
    expect(paginada.addOrderBy).toHaveBeenCalledWith('c.id', 'DESC');
    const conteo = consultas.find((consulta) => consulta.getCount.mock.calls.length > 0)!;
    expect(conteo.offset).not.toHaveBeenCalled();
    expect(conteo.limit).not.toHaveBeenCalled();
  });

  it('sin filtros no agrega condiciones', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });

    await servicio.list({}, 50, 0);

    for (const consulta of consultas) {
      expect(consulta.andWhere).not.toHaveBeenCalled();
    }
  });

  it('aplica el filtro de estado', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });

    await servicio.list({ estado: EstadoCargo.ANULADO }, 50, 0);

    expect(consultas[0].andWhere).toHaveBeenCalledWith('c.estado = :estado', {
      estado: EstadoCargo.ANULADO,
    });
    expect(consultas[0].andWhere).toHaveBeenCalledTimes(1);
  });

  it('aplica el filtro de tipoAtencion', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });

    await servicio.list({ tipoAtencion: TipoAtencionFacturable.FARMACIA }, 50, 0);

    expect(consultas[0].andWhere).toHaveBeenCalledWith('c.tipoAtencion = :tipoAtencion', {
      tipoAtencion: TipoAtencionFacturable.FARMACIA,
    });
    expect(consultas[0].andWhere).toHaveBeenCalledTimes(1);
  });

  it('aplica desde y hasta como limites inclusivos en hora de Buenos Aires', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });

    await servicio.list({ desde: '2026-03-10', hasta: '2026-03-12' }, 50, 0);

    expect(consultas[0].andWhere).toHaveBeenCalledWith('c.createdAt >= :inicio', {
      inicio: new Date('2026-03-10T03:00:00.000Z'),
    });
    expect(consultas[0].andWhere).toHaveBeenCalledWith('c.createdAt < :finExclusivo', {
      finExclusivo: new Date('2026-03-13T03:00:00.000Z'),
    });
  });

  it('con solo desde no pone tope superior', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });

    await servicio.list({ desde: '2026-03-10' }, 50, 0);

    expect(condiciones(consultas[0])).toEqual(['c.createdAt >= :inicio']);
  });

  it('con solo hasta no pone tope inferior', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });

    await servicio.list({ hasta: '2026-03-10' }, 50, 0);

    expect(condiciones(consultas[0])).toEqual(['c.createdAt < :finExclusivo']);
  });

  it('el filtro de paciente alcanza turnos, internaciones y medicacion administrada', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });
    const pacienteId = '550e8400-e29b-41d4-a716-446655440001';

    await servicio.list({ pacienteId }, 50, 0);

    const [sql, parametros] = consultas[0].andWhere.mock.calls[0];
    const compacto = String(sql).replace(/\s+/g, ' ');
    expect(compacto).toContain('c.id IN (');
    expect(compacto).toContain('JOIN turnos t ON t.id = cp.turno_id WHERE t.paciente_id = :pacienteId');
    expect(compacto).toContain(
      'JOIN internaciones i ON i.id = cp.internacion_id WHERE i.paciente_id = :pacienteId',
    );
    expect(compacto).toContain(
      'JOIN administraciones_medicacion a ON a.id = cp.administration_id JOIN indicaciones_medicas im ON im.id = a.indicacion_id WHERE im.paciente_id = :pacienteId',
    );
    expect(parametros).toEqual({ pacienteId });
  });

  it('combina todos los filtros con AND', async () => {
    const { servicio, consultas } = crearServicio({ total: 0 });

    await servicio.list(
      {
        desde: '2026-03-10',
        hasta: '2026-03-12',
        pacienteId: '550e8400-e29b-41d4-a716-446655440001',
        estado: EstadoCargo.PAGADO,
        tipoAtencion: TipoAtencionFacturable.URGENCIA,
      },
      50,
      0,
    );

    expect(consultas[0].andWhere).toHaveBeenCalledTimes(5);
    expect(consultas[1].andWhere).toHaveBeenCalledTimes(5);
  });

  it.each([
    [{ desde: 'ayer' }],
    [{ hasta: '2026-02-30' }],
    [{ desde: '2026-03-12', hasta: '2026-03-10' }],
  ])('responde 400 con fechas invalidas: %j', async (entrada) => {
    const { servicio, repositorioCargos } = crearServicio({ total: 0 });

    await expect(servicio.list(entrada, 50, 0)).rejects.toBeInstanceOf(BadRequestException);
    expect(repositorioCargos.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('una pagina vacia no consulta turnos', async () => {
    const { servicio, repositorioTurnos } = crearServicio({ cargos: [], total: 3 });

    const pagina = await servicio.list({}, 50, 100);

    expect(pagina).toEqual({ items: [], total: 3, limit: 50, offset: 100 });
    expect(repositorioTurnos.find).not.toHaveBeenCalled();
  });

  it('arma el detalle solo de los cargos de la pagina con la forma de siempre', async () => {
    const turno = {
      id: 't1',
      fechaHora: new Date('2026-03-10T12:00:00.000Z'),
      duracionMinutos: 30,
      urgente: false,
      medico: { id: 'm1', nombre: 'Ada', apellido: 'Lovelace' },
      paciente: { id: 'p1', nombre: 'Ana', apellido: 'Rojas', documento: '28456921' },
    } as unknown as Turno;
    const { servicio, repositorioTurnos } = crearServicio(
      {
        cargos: [
          cargo('a', {
            turnoId: 't1',
            tipoCobertura: 'MEDICINA_PREPAGA' as Cargo['tipoCobertura'],
            entidadCobertura: 'Prepaga',
            importePacientePesos: 3000,
            importeTerceroPesos: 12000,
          }),
          cargo('b', { administrationId: 'adm1', concepto: 'Insumos de Farmacia' }),
        ],
        total: 40,
      },
      [turno],
    );

    const pagina = await servicio.list({}, 2, 0);

    expect(repositorioTurnos.find).toHaveBeenCalledTimes(1);
    expect(pagina.items).toEqual([
      {
        id: 'a',
        turnoId: 't1',
        administrationId: null,
        concepto: null,
        importePesos: 15000,
        tipoAtencion: TipoAtencionFacturable.REGULAR,
        estado: EstadoCargo.PENDIENTE,
        createdAt: new Date('2026-03-10T15:30:00.000Z'),
        cobertura: {
          tipo: 'MEDICINA_PREPAGA',
          entidad: 'Prepaga',
          pacientePesos: 3000,
          terceroPesos: 12000,
        },
        paciente: { id: 'p1', nombre: 'Ana', apellido: 'Rojas', documento: '28456921' },
        turno: {
          fechaHora: new Date('2026-03-10T12:00:00.000Z'),
          duracionMinutos: 30,
          urgente: false,
          medico: { id: 'm1', nombre: 'Ada', apellido: 'Lovelace' },
          paciente: { id: 'p1', nombre: 'Ana', apellido: 'Rojas', documento: '28456921' },
        },
      },
      {
        id: 'b',
        turnoId: null,
        administrationId: 'adm1',
        concepto: 'Insumos de Farmacia',
        importePesos: 15000,
        tipoAtencion: TipoAtencionFacturable.REGULAR,
        estado: EstadoCargo.PENDIENTE,
        createdAt: new Date('2026-03-10T15:30:00.000Z'),
        cobertura: null,
        paciente: null,
        turno: null,
      },
    ]);
  });

  it('resuelve el paciente de los cuatro tipos de cargo en lote', async () => {
    const turnoRegular = {
      id: 't1',
      fechaHora: new Date('2026-03-10T12:00:00.000Z'),
      duracionMinutos: 30,
      urgente: false,
      medico: { id: 'm1', nombre: 'Ada', apellido: 'Lovelace' },
      paciente: { id: 'p1', nombre: 'Ana', apellido: 'Rojas', documento: '1' },
    } as unknown as Turno;
    const turnoUrgencia = {
      ...turnoRegular,
      id: 't2',
      urgente: true,
      paciente: { id: 'p2', nombre: 'Beto', apellido: 'Paz', documento: '2' },
    } as unknown as Turno;
    const { servicio, repositorioTurnos, repositorioAdministraciones, repositorioPacientes, buscarInternaciones } =
      crearServicio(
        {
          cargos: [
            cargo('regular', { turnoId: 't1' }),
            cargo('urgencia', { turnoId: 't2', tipoAtencion: TipoAtencionFacturable.URGENCIA }),
            cargo('internacion', { internacionId: 'i1', tipoAtencion: TipoAtencionFacturable.INTERNACION }),
            cargo('farmacia', { administrationId: 'a1', tipoAtencion: TipoAtencionFacturable.FARMACIA }),
            cargo('farmacia2', { administrationId: 'a2', tipoAtencion: TipoAtencionFacturable.FARMACIA }),
          ],
          total: 5,
        },
        [turnoRegular, turnoUrgencia],
        {
          internaciones: [{ id: 'i1', pacienteId: 'p3' }],
          administraciones: [
            { administrationId: 'a1', pacienteId: 'p4' },
            { administrationId: 'a2', pacienteId: 'p3' },
          ],
          pacientes: [
            { id: 'p3', nombre: 'Carla', apellido: 'Sosa', documento: '3' },
            { id: 'p4', nombre: 'Dario', apellido: 'Gil', documento: '4' },
          ],
        },
      );

    const { items } = await servicio.list({}, 50, 0);

    const pacientes = Object.fromEntries(items.map((item) => [item.id, item.paciente?.apellido ?? null]));
    expect(pacientes).toEqual({
      regular: 'Rojas',
      urgencia: 'Paz',
      internacion: 'Sosa',
      farmacia: 'Gil',
      farmacia2: 'Sosa',
    });
    expect(items.find((item) => item.id === 'farmacia')?.paciente).toEqual({
      id: 'p4',
      nombre: 'Dario',
      apellido: 'Gil',
      documento: '4',
    });
    expect(items.find((item) => item.id === 'internacion')?.turno).toBeNull();
    expect(repositorioTurnos.find).toHaveBeenCalledTimes(1);
    expect(buscarInternaciones).toHaveBeenCalledTimes(1);
    expect(repositorioAdministraciones.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(repositorioPacientes.find).toHaveBeenCalledTimes(1);
    expect(buscarInternaciones.mock.calls[0][0].select).toEqual({ id: true, pacienteId: true });
    expect(repositorioPacientes.find.mock.calls[0][0].select).toEqual({
      id: true,
      nombre: true,
      apellido: true,
      documento: true,
    });
  });

  it('la cantidad de consultas de pacientes no crece con el tamano de la pagina', async () => {
    const cargos = [
      ...Array.from({ length: 40 }, (_, i) =>
        cargo('i' + i, { internacionId: 'int' + i, tipoAtencion: TipoAtencionFacturable.INTERNACION }),
      ),
      ...Array.from({ length: 40 }, (_, i) =>
        cargo('f' + i, { administrationId: 'adm' + i, tipoAtencion: TipoAtencionFacturable.FARMACIA }),
      ),
    ];
    const { servicio, repositorioTurnos, repositorioAdministraciones, repositorioPacientes, buscarInternaciones } =
      crearServicio({ cargos, total: 80 }, [], {
        internaciones: cargos.slice(0, 40).map((c) => ({ id: c.internacionId as string, pacienteId: 'p1' })),
        administraciones: cargos.slice(40).map((c) => ({ administrationId: c.administrationId as string, pacienteId: 'p1' })),
        pacientes: [{ id: 'p1', nombre: 'Ana', apellido: 'Rojas', documento: '1' }],
      });

    await servicio.list({}, 100, 0);

    expect(repositorioTurnos.find).not.toHaveBeenCalled();
    expect(buscarInternaciones).toHaveBeenCalledTimes(1);
    expect(repositorioAdministraciones.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(repositorioPacientes.find).toHaveBeenCalledTimes(1);
  });

  it('deja paciente en null sin fallar cuando no se puede resolver', async () => {
    const { servicio } = crearServicio({
      cargos: [
        cargo('internacion', { internacionId: 'perdida', tipoAtencion: TipoAtencionFacturable.INTERNACION }),
        cargo('farmacia', { administrationId: 'perdida', tipoAtencion: TipoAtencionFacturable.FARMACIA }),
        cargo('turno', { turnoId: 'perdido' }),
      ],
      total: 3,
    });

    const { items } = await servicio.list({}, 50, 0);

    expect(items.map((item) => item.paciente)).toEqual([null, null, null]);
  });

  it('un turno sin paciente deja el paciente del cargo en null', async () => {
    const turno = {
      id: 't1',
      fechaHora: new Date('2026-03-10T12:00:00.000Z'),
      duracionMinutos: 30,
      urgente: false,
      medico: { id: 'm1', nombre: 'Ada', apellido: 'Lovelace' },
      paciente: null,
    } as unknown as Turno;
    const { servicio } = crearServicio({ cargos: [cargo('a', { turnoId: 't1' })], total: 1 }, [turno]);

    const { items } = await servicio.list({}, 50, 0);

    expect(items[0].paciente).toBeNull();
  });
});

describe('BillingService.exportarCsv', () => {
  async function leer(iterable: AsyncIterable<string>): Promise<string[]> {
    const partes: string[] = [];
    for await (const parte of iterable) partes.push(parte);
    return partes;
  }

  it('responde 400 al llamarlo, antes de empezar a transmitir, si los filtros son invalidos', () => {
    const { servicio, repositorioCargos } = crearServicio({});

    expect(() => servicio.exportarCsv({ desde: 'x' })).toThrow(BadRequestException);
    expect(repositorioCargos.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('sin cargos entrega solo la cabecera con BOM', async () => {
    const { servicio } = crearServicio({ lotes: [] });

    const partes = await leer(servicio.exportarCsv({}));

    expect(partes).toEqual([
      '﻿id,fecha,tipoAtencion,estado,concepto,importePesos,pacientePesos,terceroPesos,cobertura,paciente,medico\r\n',
    ]);
  });

  it('entrega una fila CRLF por cargo en un solo lote', async () => {
    const { servicio, consultas } = crearServicio({
      lotes: [
        {
          entities: [cargo('a', { concepto: 'Con, coma' }), cargo('b')],
          raw: [{ cursor_creado: 'x' }, { cursor_creado: 'y' }],
        },
      ],
    });

    const partes = await leer(servicio.exportarCsv({ estado: EstadoCargo.PENDIENTE }));

    expect(partes).toHaveLength(2);
    expect(partes[1]).toBe(
      'a,2026-03-10T15:30:00.000Z,REGULAR,PENDIENTE,"Con, coma",15000,,,,,\r\n' +
        'b,2026-03-10T15:30:00.000Z,REGULAR,PENDIENTE,,15000,,,,,\r\n',
    );
    expect(consultas).toHaveLength(1);
    expect(consultas[0].andWhere).toHaveBeenCalledWith('c.estado = :estado', {
      estado: EstadoCargo.PENDIENTE,
    });
    expect(consultas[0].offset).not.toHaveBeenCalled();
  });

  it('lee en lotes de 500 con cursor sin saltear ni repetir y sin tope de filas', async () => {
    const lote1 = Array.from({ length: 500 }, (_, i) => cargo(`a${i}`));
    const lote2 = Array.from({ length: 500 }, (_, i) => cargo(`b${i}`));
    const lote3 = [cargo('c0')];
    const raw = (n: number, marca: string) =>
      Array.from({ length: n }, (_, i) => ({ cursor_creado: `${marca}${i}` }));
    const { servicio, consultas } = crearServicio({
      lotes: [
        { entities: lote1, raw: raw(500, 'u') },
        { entities: lote2, raw: raw(500, 'v') },
        { entities: lote3, raw: raw(1, 'w') },
      ],
    });

    const partes = await leer(servicio.exportarCsv({}));

    expect(partes).toHaveLength(4);
    const filas = partes.slice(1).join('').split('\r\n').filter(Boolean);
    expect(filas).toHaveLength(1001);
    expect(consultas).toHaveLength(3);
    for (const consulta of consultas) {
      expect(consulta.limit).toHaveBeenCalledWith(500);
    }
    expect(consultas[0].andWhere).not.toHaveBeenCalled();
    expect(consultas[1].andWhere).toHaveBeenCalledWith(
      '(c.createdAt, c.id) < (CAST(:cursorCreado AS timestamptz), CAST(:cursorId AS uuid))',
      { cursorCreado: 'u499', cursorId: 'a499' },
    );
    expect(consultas[2].andWhere).toHaveBeenCalledWith(
      '(c.createdAt, c.id) < (CAST(:cursorCreado AS timestamptz), CAST(:cursorId AS uuid))',
      { cursorCreado: 'v499', cursorId: 'b499' },
    );
  });

  it('si el ultimo lote es de exactamente 500 consulta uno mas y termina al llegar vacio', async () => {
    const lote = Array.from({ length: 500 }, (_, i) => cargo(`a${i}`));
    const { servicio, consultas } = crearServicio({
      lotes: [{ entities: lote, raw: lote.map((_, i) => ({ cursor_creado: `u${i}` })) }],
    });

    const partes = await leer(servicio.exportarCsv({}));

    expect(partes).toHaveLength(2);
    expect(consultas).toHaveLength(2);
  });
});
