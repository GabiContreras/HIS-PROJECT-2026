import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Cargo, EstadoCargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { Financiador } from '../../../entities/financiador.entity.js';
import { Liquidacion } from '../../../entities/liquidacion.entity.js';
import { estadosFacturables } from '../domain/liquidacion.js';
import { LiquidacionesService, SQL_FACTURAR_CARGOS_LIQUIDABLES } from './liquidaciones.service.js';

const FINANCIADOR_ID = '550e8400-e29b-41d4-a716-446655440010';
const OTRO_FINANCIADOR_ID = '550e8400-e29b-41d4-a716-446655440011';
const USUARIO_ID = '550e8400-e29b-41d4-a716-446655440030';

function cargo(id: string, cambios: Partial<Cargo> = {}): Cargo {
  return {
    id,
    turnoId: null,
    administrationId: null,
    internacionId: null,
    concepto: null,
    importePesos: 15_000,
    tipoAtencion: TipoAtencionFacturable.REGULAR,
    tipoCobertura: null,
    entidadCobertura: null,
    importePacientePesos: 3_000,
    importeTerceroPesos: 12_000,
    financiadorId: FINANCIADOR_ID,
    liquidacionId: null,
    estado: EstadoCargo.PENDIENTE,
    createdAt: new Date('2026-03-10T15:00:00.000Z'),
    ...cambios,
  } as Cargo;
}

interface Opciones {
  cargos?: Cargo[];
  fallarAlGuardarTotales?: boolean;
  financiadorInactivo?: boolean;
}

function build(opciones: Opciones = {}) {
  const db = {
    cargos: opciones.cargos ?? [],
    liquidaciones: [] as Liquidacion[],
  };
  const financiadores = [
    { id: FINANCIADOR_ID, nombre: 'Obra Social Ejemplo', activo: !opciones.financiadorInactivo },
    { id: OTRO_FINANCIADOR_ID, nombre: 'Prepaga Ejemplo', activo: true },
  ];
  let secuencia = 0;
  let cola: Promise<unknown> = Promise.resolve();
  const consultas: Array<{ sql: string; params: unknown[] }> = [];

  const manager = {
    getRepository: (entidad: unknown) => {
      if (entidad === Financiador) {
        return {
          findOne: vi.fn(async (opts: { where: { id: string } }) =>
            financiadores.find((f) => f.id === opts.where.id) ?? null,
          ),
        };
      }
      return {
        create: (datos: Partial<Liquidacion>) => ({ ...datos }) as Liquidacion,
        save: vi.fn(async (liquidacion: Liquidacion) => {
          if (liquidacion.id === undefined) {
            secuencia += 1;
            liquidacion.id = `liq-${secuencia}`;
            liquidacion.createdAt = new Date('2026-04-01T13:00:00.000Z');
            db.liquidaciones.push(liquidacion);
            return liquidacion;
          }
          if (opciones.fallarAlGuardarTotales) {
            throw new Error('falla al guardar los totales');
          }
          return liquidacion;
        }),
      };
    },
    query: vi.fn(async (sql: string, params: unknown[]) => {
      consultas.push({ sql, params });
      const [estadoNuevo, liquidacionId, financiadorId, inicio, finExclusivo, estados] = params as [
        EstadoCargo,
        string,
        string,
        Date,
        Date,
        EstadoCargo[],
      ];
      const afectados = db.cargos.filter(
        (c) =>
          c.financiadorId === financiadorId &&
          c.createdAt >= inicio &&
          c.createdAt < finExclusivo &&
          estados.includes(c.estado) &&
          (c.importeTerceroPesos ?? 0) > 0 &&
          c.liquidacionId === null,
      );
      for (const c of afectados) {
        c.estado = estadoNuevo;
        c.liquidacionId = liquidacionId;
      }
      return afectados.map((c) => ({ id: c.id, importeTerceroPesos: c.importeTerceroPesos }));
    }),
  };

  const transaction = vi.fn((trabajo: (m: unknown) => Promise<unknown>) => {
    const ejecucion = cola.then(async () => {
      const copiaCargos = db.cargos.map((c) => ({ ...c }));
      const copiaLiquidaciones = db.liquidaciones.map((l) => ({ ...l }));
      try {
        return await trabajo(manager);
      } catch (error) {
        db.cargos.splice(0, db.cargos.length, ...copiaCargos);
        db.liquidaciones.splice(0, db.liquidaciones.length, ...copiaLiquidaciones);
        throw error;
      }
    });
    cola = ejecucion.catch(() => undefined);
    return ejecucion;
  });

  const repositorioLiquidaciones = {
    manager: { transaction },
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const repositorioCargos = { find: vi.fn() };
  const service = new LiquidacionesService(
    repositorioLiquidaciones as never,
    repositorioCargos as never,
  );
  return { service, db, consultas, repositorioLiquidaciones, repositorioCargos, manager };
}

const pedido = {
  financiadorId: FINANCIADOR_ID,
  desde: '2026-03-01',
  hasta: '2026-03-31',
  usuarioId: USUARIO_ID,
};

describe('LiquidacionesService.crear', () => {
  it('crea la liquidacion, marca los cargos FACTURADO y los vincula', async () => {
    const { service, db } = build({
      cargos: [
        cargo('c1', { importeTerceroPesos: 120_000 }),
        cargo('c2', { importeTerceroPesos: 117_500 }),
      ],
    });

    const liquidacion = await service.crear(pedido);

    expect(liquidacion).toEqual({
      id: 'liq-1',
      financiadorId: FINANCIADOR_ID,
      financiadorNombre: 'Obra Social Ejemplo',
      desde: '2026-03-01',
      hasta: '2026-03-31',
      cantidadCargos: 2,
      totalPesos: 237_500,
      usuarioId: USUARIO_ID,
      createdAt: new Date('2026-04-01T13:00:00.000Z'),
    });
    expect(db.cargos.map((c) => [c.estado, c.liquidacionId])).toEqual([
      [EstadoCargo.FACTURADO, 'liq-1'],
      [EstadoCargo.FACTURADO, 'liq-1'],
    ]);
  });

  it('liquida solo los cargos que cumplen la regla', async () => {
    const { service, db } = build({
      cargos: [
        cargo('ok'),
        cargo('anulado', { estado: EstadoCargo.ANULADO }),
        cargo('pagado', { estado: EstadoCargo.PAGADO }),
        cargo('facturado', { estado: EstadoCargo.FACTURADO }),
        cargo('particular', { importeTerceroPesos: 0 }),
        cargo('sin-financiador', { financiadorId: null }),
        cargo('otro-financiador', { financiadorId: OTRO_FINANCIADOR_ID }),
        cargo('ya-liquidado', { liquidacionId: 'liq-previa' }),
        cargo('antes', { createdAt: new Date('2026-03-01T02:59:59.000Z') }),
        cargo('despues', { createdAt: new Date('2026-04-01T03:00:00.000Z') }),
      ],
    });

    const liquidacion = await service.crear(pedido);

    expect(liquidacion.cantidadCargos).toBe(1);
    expect(liquidacion.totalPesos).toBe(12_000);
    const incluidos = db.cargos.filter((c) => c.liquidacionId === 'liq-1').map((c) => c.id);
    expect(incluidos).toEqual(['ok']);
    expect(db.cargos.find((c) => c.id === 'anulado')?.estado).toBe(EstadoCargo.ANULADO);
    expect(db.cargos.find((c) => c.id === 'pagado')?.estado).toBe(EstadoCargo.PAGADO);
  });

  it('incluye el cargo de las 23:30 locales del ultimo dia', async () => {
    const { service } = build({
      cargos: [cargo('tarde', { createdAt: new Date('2026-04-01T02:30:00.000Z') })],
    });

    await expect(service.crear(pedido)).resolves.toMatchObject({ cantidadCargos: 1 });
  });

  it('la actualizacion masiva respeta la regla de dominio: estados facturables, tercero mayor a cero y sin liquidar', async () => {
    const { service, consultas } = build({ cargos: [cargo('c1')] });

    await service.crear(pedido);

    const { sql, params } = consultas[0];
    expect(sql).toBe(SQL_FACTURAR_CARGOS_LIQUIDABLES);
    expect(sql).toContain('SET estado = $1, liquidacion_id = $2');
    expect(sql).toContain('estado = ANY($6)');
    expect(sql).toContain('importe_tercero_pesos > 0');
    expect(sql).toContain('liquidacion_id IS NULL');
    expect(sql).toContain('financiador_id = $3');
    expect(sql).toContain('created_at >= $4');
    expect(sql).toContain('created_at < $5');
    expect(params[0]).toBe(EstadoCargo.FACTURADO);
    expect(params[5]).toEqual(estadosFacturables());
    expect(params[5]).toEqual([EstadoCargo.PENDIENTE]);
    expect(params[3]).toEqual(new Date('2026-03-01T03:00:00.000Z'));
    expect(params[4]).toEqual(new Date('2026-04-01T03:00:00.000Z'));
  });

  it('un financiador inactivo se puede liquidar', async () => {
    const { service } = build({ cargos: [cargo('c1')], financiadorInactivo: true });

    await expect(service.crear(pedido)).resolves.toMatchObject({ cantidadCargos: 1 });
  });

  it('responde 409 y no crea nada si no hay cargos que cumplan', async () => {
    const { service, db } = build({ cargos: [cargo('anulado', { estado: EstadoCargo.ANULADO })] });

    await expect(service.crear(pedido)).rejects.toBeInstanceOf(ConflictException);

    expect(db.liquidaciones).toHaveLength(0);
    expect(db.cargos[0].liquidacionId).toBeNull();
  });

  it('un segundo pedido sobre el mismo rango responde 409', async () => {
    const { service, db } = build({ cargos: [cargo('c1')] });

    await service.crear(pedido);
    await expect(service.crear(pedido)).rejects.toBeInstanceOf(ConflictException);

    expect(db.liquidaciones).toHaveLength(1);
  });

  it('responde 404 si el financiador no existe y no crea nada', async () => {
    const { service, db } = build({ cargos: [cargo('c1')] });

    await expect(
      service.crear({ ...pedido, financiadorId: '550e8400-e29b-41d4-a716-4466554400ff' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(db.liquidaciones).toHaveLength(0);
    expect(db.cargos[0].estado).toBe(EstadoCargo.PENDIENTE);
  });

  it.each([
    ['formato invalido', { desde: '01/03/2026' }],
    ['fecha imposible', { hasta: '2026-02-30' }],
    ['desde posterior a hasta', { desde: '2026-03-31', hasta: '2026-03-01' }],
    ['mes inexistente', { desde: '2026-13-01' }],
  ])('responde 400 por %s sin abrir la transaccion', async (_nombre, cambios) => {
    const { service, repositorioLiquidaciones } = build({ cargos: [cargo('c1')] });

    await expect(service.crear({ ...pedido, ...cambios })).rejects.toBeInstanceOf(BadRequestException);

    expect(repositorioLiquidaciones.manager.transaction).not.toHaveBeenCalled();
  });

  it('revierte todo si falla al guardar los totales', async () => {
    const { service, db } = build({
      cargos: [cargo('c1'), cargo('c2')],
      fallarAlGuardarTotales: true,
    });

    await expect(service.crear(pedido)).rejects.toThrow('falla al guardar los totales');

    expect(db.liquidaciones).toHaveLength(0);
    expect(db.cargos.map((c) => [c.estado, c.liquidacionId])).toEqual([
      [EstadoCargo.PENDIENTE, null],
      [EstadoCargo.PENDIENTE, null],
    ]);
  });

  it('dos pedidos simultaneos sobre el mismo rango: uno crea la liquidacion y el otro recibe 409', async () => {
    const { service, db } = build({
      cargos: [cargo('c1'), cargo('c2'), cargo('c3', { importeTerceroPesos: 5_000 })],
    });

    const resultados = await Promise.allSettled([service.crear(pedido), service.crear(pedido)]);

    const exitosos = resultados.filter((r) => r.status === 'fulfilled');
    const rechazados = resultados.filter((r) => r.status === 'rejected');
    expect(exitosos).toHaveLength(1);
    expect(rechazados).toHaveLength(1);
    expect((rechazados[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(db.liquidaciones).toHaveLength(1);
    expect(db.liquidaciones[0].cantidadCargos).toBe(3);
    expect(db.liquidaciones[0].totalPesos).toBe(29_000);
    expect(db.cargos.every((c) => c.liquidacionId === db.liquidaciones[0].id)).toBe(true);
  });

  it('diez pedidos simultaneos: exactamente una liquidacion y cada cargo liquidado una sola vez', async () => {
    const cargos = Array.from({ length: 50 }, (_, i) => cargo(`c${i}`));
    const { service, db, consultas } = build({ cargos });

    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.crear(pedido)),
    );

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazados = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rechazados).toHaveLength(9);
    expect(rechazados.every((r) => r.reason instanceof ConflictException)).toBe(true);
    expect(db.liquidaciones).toHaveLength(1);
    expect(db.liquidaciones[0].cantidadCargos).toBe(50);
    expect(db.liquidaciones[0].totalPesos).toBe(600_000);
    expect(new Set(db.cargos.map((c) => c.liquidacionId))).toEqual(new Set([db.liquidaciones[0].id]));
    expect(consultas).toHaveLength(10);
  });

  it('pedidos simultaneos de financiadores distintos no se pisan', async () => {
    const { service, db } = build({
      cargos: [cargo('a'), cargo('b', { financiadorId: OTRO_FINANCIADOR_ID })],
    });

    const [uno, otro] = await Promise.all([
      service.crear(pedido),
      service.crear({ ...pedido, financiadorId: OTRO_FINANCIADOR_ID }),
    ]);

    expect(uno.cantidadCargos).toBe(1);
    expect(otro.cantidadCargos).toBe(1);
    expect(db.liquidaciones).toHaveLength(2);
  });
});

describe('LiquidacionesService.list', () => {
  function builderDe(liquidaciones: Liquidacion[]) {
    let desplazamiento = 0;
    let tope: number | undefined;
    const builder = {
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      offset: vi.fn((valor: number) => {
        desplazamiento = valor;
        return builder;
      }),
      limit: vi.fn((valor: number) => {
        tope = valor;
        return builder;
      }),
      getMany: vi.fn(async () => liquidaciones.slice(desplazamiento, desplazamiento + (tope ?? Infinity))),
      getCount: vi.fn(async () => liquidaciones.length),
    };
    return builder;
  }

  const liquidacion = (id: string): Liquidacion =>
    ({
      id,
      financiadorId: FINANCIADOR_ID,
      financiador: { nombre: 'Obra Social Ejemplo' },
      periodoDesde: '2026-03-01',
      periodoHasta: '2026-03-31',
      cantidadCargos: 2,
      totalPesos: 24_000,
      usuarioId: USUARIO_ID,
      createdAt: new Date('2026-04-01T13:00:00.000Z'),
    }) as Liquidacion;

  it('devuelve la pagina con el formato items, total, limit y offset', async () => {
    const { service, repositorioLiquidaciones } = build();
    const builders: ReturnType<typeof builderDe>[] = [];
    repositorioLiquidaciones.createQueryBuilder.mockImplementation(() => {
      const b = builderDe([liquidacion('l1'), liquidacion('l2'), liquidacion('l3')]);
      builders.push(b);
      return b;
    });

    const pagina = await service.list(undefined, 2, 1);

    expect(pagina.total).toBe(3);
    expect(pagina.limit).toBe(2);
    expect(pagina.offset).toBe(1);
    expect(pagina.items.map((i) => i.id)).toEqual(['l2', 'l3']);
    expect(pagina.items[0]).toEqual({
      id: 'l2',
      financiadorId: FINANCIADOR_ID,
      financiadorNombre: 'Obra Social Ejemplo',
      desde: '2026-03-01',
      hasta: '2026-03-31',
      cantidadCargos: 2,
      totalPesos: 24_000,
      usuarioId: USUARIO_ID,
      createdAt: new Date('2026-04-01T13:00:00.000Z'),
    });
    expect(builders[0].orderBy).toHaveBeenCalledWith('l.createdAt', 'DESC');
    expect(builders[0].addOrderBy).toHaveBeenCalledWith('l.id', 'DESC');
    expect(builders[0].andWhere).not.toHaveBeenCalled();
  });

  it('filtra por financiador cuando se indica', async () => {
    const { service, repositorioLiquidaciones } = build();
    const b = builderDe([liquidacion('l1')]);
    repositorioLiquidaciones.createQueryBuilder.mockReturnValue(b);

    await service.list(FINANCIADOR_ID, 50, 0);

    expect(b.andWhere).toHaveBeenCalledWith('l.financiadorId = :financiadorId', {
      financiadorId: FINANCIADOR_ID,
    });
  });
});

describe('LiquidacionesService.detalle', () => {
  it('devuelve la liquidacion con sus cargos', async () => {
    const { service, repositorioLiquidaciones, repositorioCargos } = build();
    repositorioLiquidaciones.findOne.mockResolvedValue({
      id: 'liq-1',
      financiadorId: FINANCIADOR_ID,
      financiador: { nombre: 'Obra Social Ejemplo' },
      periodoDesde: '2026-03-01',
      periodoHasta: '2026-03-31',
      cantidadCargos: 1,
      totalPesos: 12_000,
      usuarioId: null,
      createdAt: new Date('2026-04-01T13:00:00.000Z'),
    });
    repositorioCargos.find.mockResolvedValue([
      cargo('c1', { concepto: 'Internación: 3 días de cama', tipoAtencion: TipoAtencionFacturable.INTERNACION }),
    ]);

    const detalle = await service.detalle('liq-1');

    expect(detalle).toMatchObject({ id: 'liq-1', financiadorNombre: 'Obra Social Ejemplo', usuarioId: null });
    expect(detalle.cargos).toEqual([
      {
        id: 'c1',
        concepto: 'Internación: 3 días de cama',
        tipoAtencion: TipoAtencionFacturable.INTERNACION,
        createdAt: new Date('2026-03-10T15:00:00.000Z'),
        importePesos: 15_000,
        importeTerceroPesos: 12_000,
      },
    ]);
    expect(repositorioCargos.find).toHaveBeenCalledWith({
      where: { liquidacionId: 'liq-1' },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  });

  it('responde 404 si la liquidacion no existe', async () => {
    const { service, repositorioLiquidaciones, repositorioCargos } = build();
    repositorioLiquidaciones.findOne.mockResolvedValue(null);

    await expect(service.detalle('no-existe')).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorioCargos.find).not.toHaveBeenCalled();
  });
});
