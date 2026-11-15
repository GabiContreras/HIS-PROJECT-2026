import type {
  OrigenMovimientoInventario,
  TipoMovimientoInventario,
} from '../inventory-movement.js';

export interface MovimientoContexto {
  usuarioId?: string | null;
  origen?: OrigenMovimientoInventario;
  referenciaId?: string | null;
  motivo?: string | null;
}

export interface DescontarStockInput extends MovimientoContexto {
  insumoId: string;
  cantidad: number;
}

export interface DescontarStockResult {
  insumoId: string;
  cantidadDescontada: number;
  cantidadRestante: number;
}

export interface DescontarStockDiferido {
  resultado: DescontarStockResult;
  publicarAlerta: () => void;
}

export interface ReponerStockInput extends MovimientoContexto {
  insumoId: string;
  cantidad: number;
}

export interface ReponerStockResult {
  insumoId: string;
  cantidadRepuesta: number;
  cantidadActual: number;
}

export interface InsumoStock {
  id: string;
  nombre: string;
  unidadMedida: string;
  cantidadDisponible: number;
}

export interface InsumoDetalle extends InsumoStock {
  precioPesos: number;
  stockMinimo: number;
}

export interface CrearInsumoInput {
  nombre: string;
  unidadMedida: string;
  precioPesos?: number;
  stockMinimo?: number;
}

export interface ActualizarInsumoInput {
  unidadMedida?: string;
  precioPesos?: number;
  stockMinimo?: number;
}

export interface MovimientoDetalle {
  id: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  stockResultante: number;
  usuarioId: string | null;
  origen: OrigenMovimientoInventario;
  referenciaId: string | null;
  motivo: string | null;
  fecha: string;
}

export interface ListarMovimientosInput {
  limit: number;
  offset: number;
}

export interface InventoryPort {
  listar(): Promise<InsumoStock[]>;
  crear(input: CrearInsumoInput): Promise<InsumoDetalle>;
  actualizar(
    insumoId: string,
    input: ActualizarInsumoInput,
  ): Promise<InsumoDetalle>;
  descontarStock(
    input: DescontarStockInput,
  ): Promise<DescontarStockResult>;
  reponerStock(input: ReponerStockInput): Promise<ReponerStockResult>;
  listarMovimientos(
    insumoId: string,
    input: ListarMovimientosInput,
  ): Promise<MovimientoDetalle[]>;
}
