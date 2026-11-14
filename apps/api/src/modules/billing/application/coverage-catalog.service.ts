import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Financiador } from '../../../entities/financiador.entity.js';
import { Plan } from '../../../entities/plan.entity.js';
import type { FinanciadorTipo } from '../domain/financiador-tipo.js';

const UNIQUE_VIOLATION_CODE = '23505';

export type FinanciadorConPlanes = Financiador & { planes: Plan[] };

export interface CrearFinanciadorInput {
  nombre: string;
  tipo: FinanciadorTipo;
}

export interface ActualizarFinanciadorInput {
  nombre?: string;
  tipo?: FinanciadorTipo;
  activo?: boolean;
}

export interface ActualizarPlanInput {
  nombre?: string;
  activo?: boolean;
}

const isUniqueViolation = (error: unknown): boolean => {
  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };
  return (
    candidate?.code === UNIQUE_VIOLATION_CODE ||
    candidate?.driverError?.code === UNIQUE_VIOLATION_CODE
  );
};

const withoutUndefined = <T extends object>(input: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

@Injectable()
export class CoverageCatalogService {
  constructor(
    @InjectRepository(Financiador)
    private readonly financiadores: Repository<Financiador>,
    @InjectRepository(Plan)
    private readonly planes: Repository<Plan>,
  ) {}

  listActiveFinanciadores(): Promise<Financiador[]> {
    return this.financiadores.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  listActivePlanes(financiadorId: string): Promise<Plan[]> {
    return this.planes.find({
      where: { financiadorId, activo: true, financiador: { activo: true } },
      order: { nombre: 'ASC' },
    });
  }

  async getActiveFinanciador(financiadorId: string): Promise<Financiador> {
    const financiador = await this.financiadores.findOne({
      where: { id: financiadorId, activo: true },
    });
    if (!financiador) {
      throw new NotFoundException('Financiador no encontrado o inactivo');
    }
    return financiador;
  }

  async getActivePlan(financiadorId: string, planId: string): Promise<Plan> {
    const plan = await this.planes.findOne({
      where: {
        id: planId,
        financiadorId,
        activo: true,
        financiador: { activo: true },
      },
    });
    if (!plan) {
      throw new NotFoundException(
        'El plan no existe, está inactivo o no pertenece al financiador',
      );
    }
    return plan;
  }

  async listFinanciadoresWithPlanes(): Promise<FinanciadorConPlanes[]> {
    const [financiadores, planes] = await Promise.all([
      this.financiadores.find({ order: { nombre: 'ASC' } }),
      this.planes.find({ order: { nombre: 'ASC' } }),
    ]);
    return financiadores.map((financiador) => ({
      ...financiador,
      planes: planes.filter((plan) => plan.financiadorId === financiador.id),
    }));
  }

  createFinanciador(input: CrearFinanciadorInput): Promise<Financiador> {
    return this.saveCatalogEntry(
      this.financiadores,
      this.financiadores.create(input),
      'Ya existe un financiador con ese nombre',
    );
  }

  async updateFinanciador(
    id: string,
    input: ActualizarFinanciadorInput,
  ): Promise<Financiador> {
    const financiador = await this.financiadores.findOne({ where: { id } });
    if (!financiador) {
      throw new NotFoundException('Financiador no encontrado');
    }
    Object.assign(financiador, withoutUndefined(input));
    return this.saveCatalogEntry(
      this.financiadores,
      financiador,
      'Ya existe un financiador con ese nombre',
    );
  }

  async createPlan(
    financiadorId: string,
    input: { nombre: string },
  ): Promise<Plan> {
    const financiador = await this.financiadores.findOne({
      where: { id: financiadorId },
    });
    if (!financiador) {
      throw new NotFoundException('Financiador no encontrado');
    }
    return this.saveCatalogEntry(
      this.planes,
      this.planes.create({ financiadorId, nombre: input.nombre }),
      'El financiador ya tiene un plan con ese nombre',
    );
  }

  async updatePlan(id: string, input: ActualizarPlanInput): Promise<Plan> {
    const plan = await this.planes.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }
    Object.assign(plan, withoutUndefined(input));
    return this.saveCatalogEntry(
      this.planes,
      plan,
      'El financiador ya tiene un plan con ese nombre',
    );
  }

  private async saveCatalogEntry<T extends object>(
    repository: Repository<T>,
    entry: T,
    conflictMessage: string,
  ): Promise<T> {
    try {
      return await repository.save(entry);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(conflictMessage);
      }
      throw error;
    }
  }
}
