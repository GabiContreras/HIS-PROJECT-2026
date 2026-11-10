
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

export interface InventoryPort {
  listar(): Promise<InsumoStock[]>;
  descontarStock(
    input: DescontarStockInput,
  ): Promise<DescontarStockResult>;
}
