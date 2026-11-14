export type FinanciadorTipo = 'OBRA_SOCIAL_PUBLICA' | 'MEDICINA_PREPAGA';

export interface Plan {
  id: string;
  financiadorId: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
}

export interface Financiador {
  id: string;
  nombre: string;
  tipo: FinanciadorTipo;
  activo: boolean;
  createdAt: string;
}

export interface FinanciadorConPlanes extends Financiador {
  planes: Plan[];
}

export interface CrearFinanciadorBody {
  nombre: string;
  tipo: FinanciadorTipo;
}

export interface ActualizarFinanciadorBody {
  nombre?: string;
  tipo?: FinanciadorTipo;
  activo?: boolean;
}

export interface CrearPlanBody {
  nombre: string;
}

export interface ActualizarPlanBody {
  nombre?: string;
  activo?: boolean;
}
