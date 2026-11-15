import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Cargo } from '../../../entities/cargo.entity.js';
import { Insumo } from '../../../entities/insumo.entity.js';
import { MovimientoInventario } from '../../../entities/movimiento-inventario.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import {
  OrigenMovimientoInventario,
  TipoMovimientoInventario,
} from '../../resources/domain/inventory-movement.js';
import { CamasService } from '../../resources/application/camas.service.js';
import { HOSPITAL_TIME_ZONE } from '../domain/dias-cama.js';
import { EstadoCargo } from '../domain/estado-cargo.js';
import {
  armarPeriodo,
  PeriodoInvalidoError,
  PeriodoReporte,
} from '../domain/periodo-reporte.js';
import {
  AgrupacionPeriodo,
  AnuladosPeriodo,
  ImportesCargos,
  ordenarPorImporte,
  SIN_MEDICO_ASIGNADO,
  sumarImportes,
} from '../domain/reportes.js';
import { TipoAtencionFacturable } from '../domain/tipo-atencion-facturable.js';

type RawRow = Record<string, string | null>;

const FORMATO_POR_AGRUPACION: Record<AgrupacionPeriodo, string> = {
  dia: 'YYYY-MM-DD',
  mes: 'YYYY-MM',
};

export interface ReporteCargos<Fila> {
  desde: string;
  hasta: string;
  totales: ImportesCargos;
  anulados: AnuladosPeriodo;
  filas: Fila[];
}

export interface CargosPorPeriodoFila extends ImportesCargos {
  periodo: string;
}

export interface CargosPorMedicoFila extends ImportesCargos {
  medicoId: string | null;
  medico: string;
}

export interface CargosPorServicioFila extends ImportesCargos {
  tipoAtencion: TipoAtencionFacturable;
}

export interface ConsumoInsumoFila {
  insumoId: string;
  nombre: string;
  unidadMedida: string;
  cantidadTotal: number;
  cantidadManual: number;
  cantidadMedicacion: number;
}

function aImportes(row: RawRow): ImportesCargos {
  return {
    cantidad: Number(row.cantidad),
    totalPesos: Number(row.totalPesos),
    pacientePesos: Number(row.pacientePesos),
    terceroPesos: Number(row.terceroPesos),
  };
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Cargo)
    private readonly cargos: Repository<Cargo>,

    @InjectRepository(MovimientoInventario)
    private readonly movimientos: Repository<MovimientoInventario>,

    private readonly camas: CamasService,
  ) {}

  async cargosPorPeriodo(
    desde: string,
    hasta: string,
    agrupacion: AgrupacionPeriodo = 'dia',
  ): Promise<ReporteCargos<CargosPorPeriodoFila> & { agrupacion: AgrupacionPeriodo }> {
    const periodo = this.periodo(desde, hasta);
    const expresion = `to_char(c.createdAt AT TIME ZONE :zona, '${FORMATO_POR_AGRUPACION[agrupacion]}')`;

    const rows = await this.conImportes(
      this.cargosVigentes(periodo)
        .select(expresion, 'periodo')
        .setParameter('zona', HOSPITAL_TIME_ZONE)
        .groupBy('periodo')
        .orderBy('periodo', 'ASC'),
    ).getRawMany<RawRow>();

    const filas = rows.map((row) => ({ periodo: String(row.periodo), ...aImportes(row) }));
    return {
      desde: periodo.desde,
      hasta: periodo.hasta,
      agrupacion,
      ...(await this.cierre(periodo, filas)),
    };
  }

  async cargosPorMedico(desde: string, hasta: string): Promise<ReporteCargos<CargosPorMedicoFila>> {
    const periodo = this.periodo(desde, hasta);

    const rows = await this.conImportes(
      this.cargosVigentes(periodo)
        .leftJoin(Turno, 't', 't.id = c.turnoId')
        .leftJoin('t.medico', 'm')
        .select('m.id', 'medicoId')
        .addSelect('m.nombre', 'nombre')
        .addSelect('m.apellido', 'apellido')
        .groupBy('m.id')
        .addGroupBy('m.nombre')
        .addGroupBy('m.apellido'),
    ).getRawMany<RawRow>();

    const filas = ordenarPorImporte(
      rows.map((row) => ({
        medicoId: row.medicoId,
        medico: row.medicoId ? `${row.nombre} ${row.apellido}` : SIN_MEDICO_ASIGNADO,
        ...aImportes(row),
      })),
      (fila) => fila.medico,
    );
    return { desde: periodo.desde, hasta: periodo.hasta, ...(await this.cierre(periodo, filas)) };
  }

  async cargosPorServicio(
    desde: string,
    hasta: string,
  ): Promise<ReporteCargos<CargosPorServicioFila>> {
    const periodo = this.periodo(desde, hasta);

    const rows = await this.conImportes(
      this.cargosVigentes(periodo).select('c.tipoAtencion', 'tipoAtencion').groupBy('c.tipoAtencion'),
    ).getRawMany<RawRow>();

    const filas = ordenarPorImporte(
      rows.map((row) => ({
        tipoAtencion: row.tipoAtencion as TipoAtencionFacturable,
        ...aImportes(row),
      })),
      (fila) => fila.tipoAtencion,
    );
    return { desde: periodo.desde, hasta: periodo.hasta, ...(await this.cierre(periodo, filas)) };
  }

  ocupacionCamas() {
    return this.camas.ocupacion();
  }

  async consumoInsumos(
    desde: string,
    hasta: string,
  ): Promise<{ desde: string; hasta: string; filas: ConsumoInsumoFila[] }> {
    const periodo = this.periodo(desde, hasta);

    const rows = await this.movimientos
      .createQueryBuilder('mv')
      .innerJoin(Insumo, 'i', 'i.id = mv.insumoId')
      .select('i.id', 'insumoId')
      .addSelect('i.nombre', 'nombre')
      .addSelect('i.unidadMedida', 'unidadMedida')
      .addSelect('COALESCE(SUM(mv.cantidad), 0)', 'cantidadTotal')
      .addSelect(
        'COALESCE(SUM(mv.cantidad) FILTER (WHERE mv.origen = :manual), 0)',
        'cantidadManual',
      )
      .addSelect(
        'COALESCE(SUM(mv.cantidad) FILTER (WHERE mv.origen = :medicacion), 0)',
        'cantidadMedicacion',
      )
      .where('mv.tipo = :descuento')
      .andWhere('mv.createdAt >= :inicio AND mv.createdAt < :fin')
      .setParameters({
        descuento: TipoMovimientoInventario.DESCUENTO,
        manual: OrigenMovimientoInventario.MANUAL,
        medicacion: OrigenMovimientoInventario.ADMINISTRACION_MEDICACION,
        inicio: periodo.inicio,
        fin: periodo.finExclusivo,
      })
      .groupBy('i.id')
      .addGroupBy('i.nombre')
      .addGroupBy('i.unidadMedida')
      .getRawMany<RawRow>();

    const filas = rows
      .map((row) => ({
        insumoId: String(row.insumoId),
        nombre: String(row.nombre),
        unidadMedida: String(row.unidadMedida),
        cantidadTotal: Number(row.cantidadTotal),
        cantidadManual: Number(row.cantidadManual),
        cantidadMedicacion: Number(row.cantidadMedicacion),
      }))
      .sort(
        (a, b) =>
          b.cantidadTotal - a.cantidadTotal || a.nombre.localeCompare(b.nombre, 'es'),
      );
    return { desde: periodo.desde, hasta: periodo.hasta, filas };
  }

  private periodo(desde: string, hasta: string): PeriodoReporte {
    try {
      return armarPeriodo(desde, hasta);
    } catch (error) {
      if (error instanceof PeriodoInvalidoError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private cargosEnPeriodo(periodo: PeriodoReporte): SelectQueryBuilder<Cargo> {
    return this.cargos
      .createQueryBuilder('c')
      .where('c.createdAt >= :inicio AND c.createdAt < :fin', {
        inicio: periodo.inicio,
        fin: periodo.finExclusivo,
      });
  }

  private cargosVigentes(periodo: PeriodoReporte): SelectQueryBuilder<Cargo> {
    return this.cargosEnPeriodo(periodo).andWhere('c.estado <> :anulado', {
      anulado: EstadoCargo.ANULADO,
    });
  }

  private conImportes(qb: SelectQueryBuilder<Cargo>): SelectQueryBuilder<Cargo> {
    return qb
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(c.importePesos), 0)', 'totalPesos')
      .addSelect('COALESCE(SUM(c.importePacientePesos), 0)', 'pacientePesos')
      .addSelect('COALESCE(SUM(c.importeTerceroPesos), 0)', 'terceroPesos');
  }

  private async cierre<Fila extends ImportesCargos>(
    periodo: PeriodoReporte,
    filas: Fila[],
  ): Promise<{ totales: ImportesCargos; anulados: AnuladosPeriodo; filas: Fila[] }> {
    return {
      totales: sumarImportes(filas),
      anulados: await this.anulados(periodo),
      filas,
    };
  }

  private async anulados(periodo: PeriodoReporte): Promise<AnuladosPeriodo> {
    const row = await this.cargosEnPeriodo(periodo)
      .andWhere('c.estado = :anulado', { anulado: EstadoCargo.ANULADO })
      .select('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(c.importePesos), 0)', 'totalPesos')
      .getRawOne<RawRow>();
    return { cantidad: Number(row?.cantidad ?? 0), totalPesos: Number(row?.totalPesos ?? 0) };
  }
}
