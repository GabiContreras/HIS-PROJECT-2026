import { BadRequestException } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';

type Raw = Record<string, string | null>;

function chainableQb(rows: Raw[], one: Raw | undefined = undefined) {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    'where',
    'andWhere',
    'select',
    'addSelect',
    'leftJoin',
    'innerJoin',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'setParameter',
    'setParameters',
  ]) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getRawMany = vi.fn(async () => rows);
  qb.getRawOne = vi.fn(async () => one);
  return qb;
}

const SIN_ANULADOS = { cantidad: '0', totalPesos: '0' };

function crear(options: {
  cargosRows?: Raw[];
  anulados?: Raw;
  movimientosRows?: Raw[];
  ocupacion?: unknown;
}) {
  const principal = chainableQb(options.cargosRows ?? []);
  const anulados = chainableQb([], options.anulados ?? SIN_ANULADOS);
  const cargos = {
    createQueryBuilder: vi.fn().mockReturnValueOnce(principal).mockReturnValueOnce(anulados),
  };
  const movimientosQb = chainableQb(options.movimientosRows ?? []);
  const movimientos = { createQueryBuilder: vi.fn(() => movimientosQb) };
  const camas = { ocupacion: vi.fn(async () => options.ocupacion) };
  const service = new ReportesService(cargos as never, movimientos as never, camas as never);
  return { service, principal, anulados, movimientosQb, camas };
}

describe('ReportesService periodo', () => {
  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-03-10', '2026-03-09'],
    ['10/03/2026', '2026-03-12'],
  ])('rechaza con 400 un período inválido (%s, %s)', async (desde, hasta) => {
    const { service } = crear({});

    await expect(service.cargosPorPeriodo(desde, hasta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.cargosPorMedico(desde, hasta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.cargosPorServicio(desde, hasta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.consumoInsumos(desde, hasta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('filtra por los límites del período en hora de Buenos Aires y excluye anulados del agregado', async () => {
    const { service, principal, anulados } = crear({});

    await service.cargosPorPeriodo('2026-03-10', '2026-03-10');

    const limites = {
      inicio: new Date('2026-03-10T03:00:00.000Z'),
      fin: new Date('2026-03-11T03:00:00.000Z'),
    };
    expect(principal.where).toHaveBeenCalledWith(
      'c.createdAt >= :inicio AND c.createdAt < :fin',
      limites,
    );
    expect(principal.andWhere).toHaveBeenCalledWith('c.estado <> :anulado', {
      anulado: 'ANULADO',
    });
    expect(anulados.where).toHaveBeenCalledWith(
      'c.createdAt >= :inicio AND c.createdAt < :fin',
      limites,
    );
    expect(anulados.andWhere).toHaveBeenCalledWith('c.estado = :anulado', {
      anulado: 'ANULADO',
    });
  });
});

describe('ReportesService.cargosPorPeriodo', () => {
  it('convierte los importes de texto a número y suma los totales de las filas', async () => {
    const { service } = crear({
      cargosRows: [
        { periodo: '2026-03-09', cantidad: '2', totalPesos: '30000', pacientePesos: '6000', terceroPesos: '24000' },
        { periodo: '2026-03-10', cantidad: '1', totalPesos: '15000', pacientePesos: '15000', terceroPesos: '0' },
      ],
      anulados: { cantidad: '1', totalPesos: '8000' },
    });

    const reporte = await service.cargosPorPeriodo('2026-03-01', '2026-03-31');

    expect(reporte).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      agrupacion: 'dia',
      totales: { cantidad: 3, totalPesos: 45000, pacientePesos: 21000, terceroPesos: 24000 },
      anulados: { cantidad: 1, totalPesos: 8000 },
      filas: [
        { periodo: '2026-03-09', cantidad: 2, totalPesos: 30000, pacientePesos: 6000, terceroPesos: 24000 },
        { periodo: '2026-03-10', cantidad: 1, totalPesos: 15000, pacientePesos: 15000, terceroPesos: 0 },
      ],
    });
  });

  it('agrupa por mes con el formato YYYY-MM y por día con YYYY-MM-DD', async () => {
    const mes = crear({});
    await mes.service.cargosPorPeriodo('2026-01-01', '2026-03-31', 'mes');
    expect(mes.principal.select).toHaveBeenCalledWith(
      expect.stringContaining("'YYYY-MM')"),
      'periodo',
    );

    const dia = crear({});
    await dia.service.cargosPorPeriodo('2026-01-01', '2026-03-31');
    expect(dia.principal.select).toHaveBeenCalledWith(
      expect.stringContaining("'YYYY-MM-DD')"),
      'periodo',
    );
  });

  it('ordena por período ascendente en la consulta y usa la zona horaria de Buenos Aires', async () => {
    const { service, principal } = crear({});

    await service.cargosPorPeriodo('2026-03-01', '2026-03-31');

    expect(principal.orderBy).toHaveBeenCalledWith('periodo', 'ASC');
    expect(principal.setParameter).toHaveBeenCalledWith('zona', 'America/Argentina/Buenos_Aires');
  });

  it('período sin datos devuelve totales en cero y filas vacías', async () => {
    const { service } = crear({});

    expect(await service.cargosPorPeriodo('2026-03-01', '2026-03-31', 'mes')).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      agrupacion: 'mes',
      totales: { cantidad: 0, totalPesos: 0, pacientePesos: 0, terceroPesos: 0 },
      anulados: { cantidad: 0, totalPesos: 0 },
      filas: [],
    });
  });

  it('informa los anulados sin sumarlos a los totales', async () => {
    const { service } = crear({
      cargosRows: [
        { periodo: '2026-03-10', cantidad: '1', totalPesos: '15000', pacientePesos: '3000', terceroPesos: '12000' },
      ],
      anulados: { cantidad: '3', totalPesos: '45000' },
    });

    const reporte = await service.cargosPorPeriodo('2026-03-01', '2026-03-31');

    expect(reporte.totales.cantidad).toBe(1);
    expect(reporte.totales.totalPesos).toBe(15000);
    expect(reporte.anulados).toEqual({ cantidad: 3, totalPesos: 45000 });
  });
});

describe('ReportesService.cargosPorMedico', () => {
  const rows: Raw[] = [
    { medicoId: null, nombre: null, apellido: null, cantidad: '2', totalPesos: '40000', pacientePesos: '5000', terceroPesos: '10000' },
    { medicoId: 'med-2', nombre: 'Luis', apellido: 'Paz', cantidad: '1', totalPesos: '25000', pacientePesos: '3000', terceroPesos: '22000' },
    { medicoId: 'med-1', nombre: 'Ana', apellido: 'Gómez', cantidad: '3', totalPesos: '45000', pacientePesos: '9000', terceroPesos: '36000' },
    { medicoId: 'med-3', nombre: 'Aaron', apellido: 'Ruiz', cantidad: '1', totalPesos: '25000', pacientePesos: '3000', terceroPesos: '22000' },
  ];

  it('agrupa los cargos sin turno en "Sin médico asignado" con medicoId null', async () => {
    const { service } = crear({ cargosRows: rows });

    const { filas } = await service.cargosPorMedico('2026-03-01', '2026-03-31');

    expect(filas.find((fila) => fila.medicoId === null)).toEqual({
      medicoId: null,
      medico: 'Sin médico asignado',
      cantidad: 2,
      totalPesos: 40000,
      pacientePesos: 5000,
      terceroPesos: 10000,
    });
  });

  it('ordena por importe descendente y desempata por nombre', async () => {
    const { service } = crear({ cargosRows: rows });

    const { filas } = await service.cargosPorMedico('2026-03-01', '2026-03-31');

    expect(filas.map((fila) => fila.medico)).toEqual([
      'Ana Gómez',
      'Sin médico asignado',
      'Aaron Ruiz',
      'Luis Paz',
    ]);
  });

  it('los totales de la raíz igualan la suma de las filas', async () => {
    const { service } = crear({ cargosRows: rows });

    const { totales, filas } = await service.cargosPorMedico('2026-03-01', '2026-03-31');

    expect(totales).toEqual({ cantidad: 7, totalPesos: 135000, pacientePesos: 20000, terceroPesos: 90000 });
    expect(totales.totalPesos).toBe(filas.reduce((suma, fila) => suma + fila.totalPesos, 0));
    expect(totales.cantidad).toBe(filas.reduce((suma, fila) => suma + fila.cantidad, 0));
  });

  it('une el turno y el médico a los cargos y agrupa por médico', async () => {
    const { service, principal } = crear({ cargosRows: rows });

    await service.cargosPorMedico('2026-03-01', '2026-03-31');

    expect(principal.leftJoin).toHaveBeenCalledWith(expect.anything(), 't', 't.id = c.turnoId');
    expect(principal.leftJoin).toHaveBeenCalledWith('t.medico', 'm');
    expect(principal.groupBy).toHaveBeenCalledWith('m.id');
  });

  it('período sin datos devuelve totales en cero y filas vacías', async () => {
    const { service } = crear({});

    expect(await service.cargosPorMedico('2026-03-01', '2026-03-31')).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      totales: { cantidad: 0, totalPesos: 0, pacientePesos: 0, terceroPesos: 0 },
      anulados: { cantidad: 0, totalPesos: 0 },
      filas: [],
    });
  });
});

describe('ReportesService.cargosPorServicio', () => {
  it('devuelve solo los tipos con cargos, ordenados por importe, con totales y anulados', async () => {
    const { service, principal } = crear({
      cargosRows: [
        { tipoAtencion: 'FARMACIA', cantidad: '4', totalPesos: '2000', pacientePesos: '0', terceroPesos: '0' },
        { tipoAtencion: 'INTERNACION', cantidad: '1', totalPesos: '90000', pacientePesos: '9000', terceroPesos: '81000' },
        { tipoAtencion: 'REGULAR', cantidad: '2', totalPesos: '30000', pacientePesos: '6000', terceroPesos: '24000' },
      ],
      anulados: { cantidad: '1', totalPesos: '25000' },
    });

    const reporte = await service.cargosPorServicio('2026-03-01', '2026-03-31');

    expect(principal.groupBy).toHaveBeenCalledWith('c.tipoAtencion');
    expect(reporte.filas.map((fila) => fila.tipoAtencion)).toEqual([
      'INTERNACION',
      'REGULAR',
      'FARMACIA',
    ]);
    expect(reporte.totales).toEqual({
      cantidad: 7,
      totalPesos: 122000,
      pacientePesos: 15000,
      terceroPesos: 105000,
    });
    expect(reporte.anulados).toEqual({ cantidad: 1, totalPesos: 25000 });
  });

  it('período sin datos devuelve filas vacías', async () => {
    const { service } = crear({});

    const reporte = await service.cargosPorServicio('2026-03-01', '2026-03-31');

    expect(reporte.filas).toEqual([]);
    expect(reporte.totales.cantidad).toBe(0);
  });
});

describe('ReportesService.ocupacionCamas', () => {
  it('delega en CamasService.ocupacion sin modificar el resultado', async () => {
    const ocupacion = { camasActivas: 20, camasOcupadas: 14, porcentajeOcupacion: 70 };
    const { service, camas } = crear({ ocupacion });

    expect(await service.ocupacionCamas()).toBe(ocupacion);
    expect(camas.ocupacion).toHaveBeenCalledTimes(1);
  });
});

describe('ReportesService.consumoInsumos', () => {
  it('cuenta solo DESCUENTO, separa manual de medicación y ordena por cantidad total', async () => {
    const { service, movimientosQb } = crear({
      movimientosRows: [
        { insumoId: 'i-2', nombre: 'Gasas', unidadMedida: 'unidad', cantidadTotal: '5', cantidadManual: '5', cantidadMedicacion: '0' },
        { insumoId: 'i-1', nombre: 'Paracetamol', unidadMedida: 'comprimido', cantidadTotal: '25', cantidadManual: '5', cantidadMedicacion: '20' },
        { insumoId: 'i-3', nombre: 'Alcohol', unidadMedida: 'ml', cantidadTotal: '5', cantidadManual: '0', cantidadMedicacion: '5' },
      ],
    });

    const reporte = await service.consumoInsumos('2026-03-01', '2026-03-31');

    expect(movimientosQb.where).toHaveBeenCalledWith('mv.tipo = :descuento');
    expect(movimientosQb.setParameters).toHaveBeenCalledWith({
      descuento: 'DESCUENTO',
      manual: 'MANUAL',
      medicacion: 'ADMINISTRACION_MEDICACION',
      inicio: new Date('2026-03-01T03:00:00.000Z'),
      fin: new Date('2026-04-01T03:00:00.000Z'),
    });
    expect(reporte).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      filas: [
        { insumoId: 'i-1', nombre: 'Paracetamol', unidadMedida: 'comprimido', cantidadTotal: 25, cantidadManual: 5, cantidadMedicacion: 20 },
        { insumoId: 'i-3', nombre: 'Alcohol', unidadMedida: 'ml', cantidadTotal: 5, cantidadManual: 0, cantidadMedicacion: 5 },
        { insumoId: 'i-2', nombre: 'Gasas', unidadMedida: 'unidad', cantidadTotal: 5, cantidadManual: 5, cantidadMedicacion: 0 },
      ],
    });
  });

  it('la cantidad total es la suma del desglose', async () => {
    const { service } = crear({
      movimientosRows: [
        { insumoId: 'i-1', nombre: 'Paracetamol', unidadMedida: 'comprimido', cantidadTotal: '25', cantidadManual: '5', cantidadMedicacion: '20' },
      ],
    });

    const { filas } = await service.consumoInsumos('2026-03-01', '2026-03-31');

    expect(filas[0].cantidadTotal).toBe(filas[0].cantidadManual + filas[0].cantidadMedicacion);
  });

  it('sin consumo devuelve filas vacías', async () => {
    const { service } = crear({});

    expect(await service.consumoInsumos('2026-03-01', '2026-03-31')).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      filas: [],
    });
  });
});
