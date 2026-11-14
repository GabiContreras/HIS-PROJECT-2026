export interface DescontarStockInput {
  insumoId: string;
  cantidad: number;
}

export interface DescontarStockResult {
  insumoId: string;
  cantidadDescontada: number;
  cantidadRestante: number;
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
}
