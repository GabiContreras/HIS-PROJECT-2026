import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Financiador } from '../../../entities/financiador.entity.js';
import { Plan } from '../../../entities/plan.entity.js';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import {
  CoverageCheckInput,
  CoverageCheckResult,
  CoverageRejectionReason,
  CoverageVerifier,
} from '../domain/ports/coverage-verifier.port.js';

const COVERED: CoverageCheckResult = { cubierta: true };

function rejected(motivo: CoverageRejectionReason): CoverageCheckResult {
  return { cubierta: false, motivo };
}

function isBlank(value: string | null): value is null | '' {
  return value === null || value.trim() === '';
}

@Injectable()
export class SimulatedCoverageVerifier implements CoverageVerifier {
  constructor(
    @InjectRepository(Financiador)
    private readonly financiadores: Repository<Financiador>,
    @InjectRepository(Plan)
    private readonly planes: Repository<Plan>,
  ) {}

  async verify(input: CoverageCheckInput): Promise<CoverageCheckResult> {
    if (input.tipoCobertura === CoverageType.SELF_PAY) return COVERED;

    const { financiadorId, planId, numeroAfiliado } = input;
    if (isBlank(financiadorId) || isBlank(planId) || isBlank(numeroAfiliado)) {
      return rejected('AFILIACION_INCOMPLETA');
    }

    const financiador = await this.financiadores.findOne({
      where: { id: financiadorId },
      select: { id: true, activo: true },
    });
    if (!financiador) return rejected('FINANCIADOR_INEXISTENTE');
    if (!financiador.activo) return rejected('FINANCIADOR_INACTIVO');

    const plan = await this.planes.findOne({
      where: { id: planId },
      select: { id: true, activo: true, financiadorId: true },
    });
    if (!plan) return rejected('PLAN_INEXISTENTE');
    if (!plan.activo) return rejected('PLAN_INACTIVO');
    if (plan.financiadorId !== financiadorId) {
      return rejected('PLAN_NO_PERTENECE_AL_FINANCIADOR');
    }

    return COVERED;
  }
}
