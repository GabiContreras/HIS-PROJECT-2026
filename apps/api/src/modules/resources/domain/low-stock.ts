export function cruzaStockMinimo(
  stockAnterior: number,
  stockResultante: number,
  stockMinimo: number,
): boolean {
  return stockMinimo > 0 && stockAnterior > stockMinimo && stockResultante <= stockMinimo;
}
