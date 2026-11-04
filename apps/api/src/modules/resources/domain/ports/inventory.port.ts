
export interface DescontarStockInput {
  insumoId: string;
  cantidad: number;
}

export interface DescontarStockResult {
  insumoId: string;
  cantidadDescontada: number;
  cantidadRestante: number;
}

export interface InventoryPort {
  descontarStock(
    input: DescontarStockInput,
  ): Promise<DescontarStockResult>;
}
