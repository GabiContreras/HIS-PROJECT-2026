import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { Financiador } from '../../../entities/financiador.entity.js';
import { Liquidacion } from '../../../entities/liquidacion.entity.js';
import { ESTADO_FACTURADO, estadosFacturables, totalTerceroPesos } from '../domain/liquidacion.js';
import { armarPeriodo, PeriodoInvalidoError } from '../domain/periodo-reporte.js';

export const SQL_FACTURAR_CARGOS_LIQUIDABLES = `
  WITH facturados AS (
    UPDATE cargos
    SET estado = $1, liquidacion_id = $2
    WHERE financiador_id = $3
      AND created_at >= $4
      AND created_at < $5
      AND estado = ANY($6)
      AND importe_tercero_pesos > 0
      AND liquidacion_id IS NULL
    RETURNING id, importe_tercero_pesos
  )
  SELECT id, importe_tercero_pesos AS "importeTerceroPesos" FROM facturados
`;

export interface LiquidacionResumen {
  id: string;
  financiadorId: string;
  financiadorNombre: string;
  desde: string;
  hasta: string;
  cantidadCargos: number;
  totalPesos: number;
  usuarioId: string | null;
  createdAt: Date;
}

export interface LiquidacionCargo {
  id: string;
  concepto: string | null;
  tipoAtencion: TipoAtencionFacturable;
  createdAt: Date;
  importePesos: number;
  importeTerceroPesos: number | null;
}

export interface LiquidacionDetalle extends LiquidacionResumen {
  cargos: LiquidacionCargo[];
}

export interface PaginaLiquidaciones {
  items: LiquidacionResumen[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class LiquidacionesService {
  constructor(
    @InjectRepository(Liquidacion)
    private readonly liquidaciones: Repository<Liquidacion>,

    @InjectRepository(Cargo)
    private readonly cargos: Repository<Cargo>,
  ) {}

  async crear(input: {
    financiadorId: string;
    desde: string;
    hasta: string;
    usuarioId: string | null;
  }): Promise<LiquidacionResumen> {
    const periodo = this.armarPeriodo(input.desde, input.hasta);

    return this.liquidaciones.manager.transaction(async (manager) => {
      const financiador = await manager.getRepository(Financiador).findOne({
        where: { id: input.financiadorId },
      });
      if (!financiador) {
        throw new NotFoundException('El financiador no existe.');
      }

      const repositorio = manager.getRepository(Liquidacion);
      const liquidacion = await repositorio.save(
        repositorio.create({
          financiadorId: financiador.id,
          periodoDesde: periodo.desde,
          periodoHasta: periodo.hasta,
          cantidadCargos: 0,
          totalPesos: 0,
          usuarioId: input.usuarioId,
        }),
      );

      const incluidos: { id: string; importeTerceroPesos: number }[] = await manager.query(
        SQL_FACTURAR_CARGOS_LIQUIDABLES,
        [
          ESTADO_FACTURADO,
          liquidacion.id,
          financiador.id,
          periodo.inicio,
          periodo.finExclusivo,
          estadosFacturables(),
        ],
      );

      if (incluidos.length === 0) {
        throw new ConflictException(
          'No hay cargos para liquidar de ese financiador en el período indicado.',
        );
      }

      liquidacion.cantidadCargos = incluidos.length;
      liquidacion.totalPesos = totalTerceroPesos(incluidos);
      await repositorio.save(liquidacion);

      return this.aResumen(liquidacion, financiador.nombre);
    });
  }

  async list(
    financiadorId: string | undefined,
    limit: number,
    offset: number,
  ): Promise<PaginaLiquidaciones> {
    const consulta = () => {
      const builder = this.liquidaciones
        .createQueryBuilder('l')
        .innerJoinAndSelect('l.financiador', 'f');
      if (financiadorId) {
        builder.andWhere('l.financiadorId = :financiadorId', { financiadorId });
      }
      return builder.orderBy('l.createdAt', 'DESC').addOrderBy('l.id', 'DESC');
    };

    const [liquidaciones, total] = await Promise.all([
      consulta().offset(offset).limit(limit).getMany(),
      consulta().getCount(),
    ]);

    return {
      items: liquidaciones.map((l) => this.aResumen(l, l.financiador.nombre)),
      total,
      limit,
      offset,
    };
  }

  async detalle(id: string): Promise<LiquidacionDetalle> {
    const liquidacion = await this.liquidaciones.findOne({
      where: { id },
      relations: { financiador: true },
    });
    if (!liquidacion) {
      throw new NotFoundException('La liquidación no existe.');
    }

    const cargos = await this.cargos.find({
      where: { liquidacionId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    return {
      ...this.aResumen(liquidacion, liquidacion.financiador.nombre),
      cargos: cargos.map((cargo) => ({
        id: cargo.id,
        concepto: cargo.concepto,
        tipoAtencion: cargo.tipoAtencion,
        createdAt: cargo.createdAt,
        importePesos: cargo.importePesos,
        importeTerceroPesos: cargo.importeTerceroPesos,
      })),
    };
  }

  private armarPeriodo(desde: string, hasta: string) {
    try {
      return armarPeriodo(desde, hasta);
    } catch (error) {
      if (error instanceof PeriodoInvalidoError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private aResumen(liquidacion: Liquidacion, financiadorNombre: string): LiquidacionResumen {
    return {
      id: liquidacion.id,
      financiadorId: liquidacion.financiadorId,
      financiadorNombre,
      desde: liquidacion.periodoDesde,
      hasta: liquidacion.periodoHasta,
      cantidadCargos: liquidacion.cantidadCargos,
      totalPesos: liquidacion.totalPesos,
      usuarioId: liquidacion.usuarioId,
      createdAt: liquidacion.createdAt,
    };
  }
}
