import { CoverageType } from '../../../shared/events/coverage-type.js';

export type FinanciadorTipo =
  | CoverageType.PUBLIC_INSURANCE
  | CoverageType.PREPAID;

export const FINANCIADOR_TIPOS: readonly FinanciadorTipo[] = [
  CoverageType.PUBLIC_INSURANCE,
  CoverageType.PREPAID,
];

export const isFinanciadorTipo = (tipo: string): tipo is FinanciadorTipo =>
  FINANCIADOR_TIPOS.includes(tipo as FinanciadorTipo);
