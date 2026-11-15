import { CoverageType } from '../../../../shared/events/coverage-type.js';

export type CoverageRejectionReason =
  | 'AFILIACION_INCOMPLETA'
  | 'FINANCIADOR_INEXISTENTE'
  | 'FINANCIADOR_INACTIVO'
  | 'PLAN_INEXISTENTE'
  | 'PLAN_INACTIVO'
  | 'PLAN_NO_PERTENECE_AL_FINANCIADOR';

export interface CoverageCheckInput {
  tipoCobertura: CoverageType;
  financiadorId: string | null;
  planId: string | null;
  numeroAfiliado: string | null;
  prestacion?: string;
}

export interface CoverageCheckResult {
  cubierta: boolean;
  motivo?: CoverageRejectionReason;
}

export interface CoverageVerifier {
  verify(input: CoverageCheckInput): Promise<CoverageCheckResult>;
}

export const COVERAGE_VERIFIER = Symbol('COVERAGE_VERIFIER');
